"""
MorphCut — Face Swap Video SaaS backend.
"""
import os
import io
import uuid
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List

import stripe
import requests as py_requests
from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Request, Response, Header, Depends
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env", override=True)

from storage import init_storage, put_object, get_object, APP_NAME  # noqa: E402
from face_swap_provider import get_provider  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Stripe
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
PRICE_EUR_CENTS = int(os.environ.get("PRICE_EUR_CENTS", "499"))

# Limits
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "100"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
FILE_RETENTION_HOURS = int(os.environ.get("FILE_RETENTION_HOURS", "24"))

ALLOWED_VIDEO_EXT = {"mp4", "mov", "webm"}
ALLOWED_VIDEO_MIME = {"video/mp4", "video/quicktime", "video/webm", "video/x-m4v"}
ALLOWED_PHOTO_EXT = {"jpg", "jpeg", "png", "webp"}
ALLOWED_PHOTO_MIME = {"image/jpeg", "image/png", "image/webp"}

ADMIN_EMAILS = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]

app = FastAPI(title="MorphCut API")
api_router = APIRouter(prefix="/api")

provider = get_provider()

# ------------------- Models -------------------

class Job(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    status: str = "created"  # created | processing | preview_ready | paid | failed
    progress: int = 0
    stage: str = "En attente..."
    video_path: Optional[str] = None
    photo_path: Optional[str] = None
    preview_path: Optional[str] = None
    final_path: Optional[str] = None
    video_meta: Optional[dict] = None
    photo_meta: Optional[dict] = None
    session_id: Optional[str] = None
    payment_status: str = "unpaid"
    error: Optional[str] = None
    provider_is_mock: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    expires_at: str = Field(default_factory=lambda: (datetime.now(timezone.utc) + timedelta(hours=FILE_RETENTION_HOURS)).isoformat())


class CheckoutRequest(BaseModel):
    job_id: str
    origin_url: str


class ContactMessage(BaseModel):
    name: str
    email: str
    message: str


# ------------------- Helpers -------------------

def _extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _validate_file(file: UploadFile, allowed_ext: set, allowed_mime: set, kind: str):
    ext = _extension(file.filename or "")
    if ext not in allowed_ext:
        raise HTTPException(400, f"{kind}: extension '.{ext}' non supportée. Autorisé: {sorted(allowed_ext)}")
    if file.content_type and file.content_type.lower() not in allowed_mime:
        raise HTTPException(400, f"{kind}: type MIME '{file.content_type}' non supporté")


async def _read_bounded(file: UploadFile) -> bytes:
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"Fichier trop volumineux (max {MAX_UPLOAD_MB} Mo)")
    if len(data) == 0:
        raise HTTPException(400, "Fichier vide")
    return data


async def _get_admin(request: Request) -> dict:
    token = request.headers.get("X-Admin-Token") or request.cookies.get("admin_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    session = await db.admin_sessions.find_one({"token": token, "revoked": {"$ne": True}})
    if not session:
        raise HTTPException(401, "Invalid session")
    if session.get("expires_at") and datetime.fromisoformat(session["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(401, "Session expired")
    return session


# ------------------- Startup -------------------

@app.on_event("startup")
async def startup():
    try:
        init_storage()
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    # Ensure the 4.99 EUR price exists
    try:
        prices = stripe.Price.list(lookup_keys=["morphcut_hd_video"], active=True, limit=1).data
        if prices:
            p = prices[0]
            if p.unit_amount != PRICE_EUR_CENTS or p.currency != "eur":
                stripe.Price.modify(p.id, active=False)
                prices = []
        if not prices:
            products = list(stripe.Product.list(active=True).auto_paging_iter())
            product = next((p for p in products if p.metadata.get("emergent_product_id") == "morphcut_hd_video"), None)
            if not product:
                product = stripe.Product.create(
                    name="MorphCut - Vidéo Face Swap HD",
                    tax_code="txcd_10000000",
                    metadata={"managed_by": "emergent", "emergent_product_id": "morphcut_hd_video"},
                )
            stripe.Price.create(
                product=product.id,
                unit_amount=PRICE_EUR_CENTS,
                currency="eur",
                lookup_key="morphcut_hd_video",
                transfer_lookup_key=True,
            )
            logger.info("Created Stripe price for MorphCut HD video 4.99 EUR")
    except Exception as e:
        logger.error(f"Stripe price setup failed: {e}")

    # Kick off janitor
    asyncio.create_task(_janitor_loop())


async def _janitor_loop():
    while True:
        try:
            now = datetime.now(timezone.utc)
            cur = db.jobs.find({"cleaned": {"$ne": True}, "expires_at": {"$lt": now.isoformat()}})
            async for job in cur:
                # Soft-delete files (storage has no delete API, just mark)
                await db.jobs.update_one({"id": job["id"]}, {"$set": {"cleaned": True, "cleaned_at": now.isoformat()}})
                logger.info(f"Cleaned job {job['id']}")
        except Exception as e:
            logger.error(f"Janitor error: {e}")
        await asyncio.sleep(600)  # every 10 min


# ------------------- Routes -------------------

@api_router.get("/")
async def root():
    return {"service": "morphcut", "provider_is_mock": provider.is_mock}


@api_router.post("/upload/video")
async def upload_video(file: UploadFile = File(...)):
    _validate_file(file, ALLOWED_VIDEO_EXT, ALLOWED_VIDEO_MIME, "Vidéo")
    data = await _read_bounded(file)
    ext = _extension(file.filename)
    path = f"{APP_NAME}/videos/{uuid.uuid4().hex}.{ext}"
    result = put_object(path, data, file.content_type or "video/mp4")
    return {
        "storage_path": result["path"],
        "size": len(data),
        "content_type": file.content_type,
        "filename": file.filename,
    }


@api_router.post("/upload/photo")
async def upload_photo(file: UploadFile = File(...)):
    _validate_file(file, ALLOWED_PHOTO_EXT, ALLOWED_PHOTO_MIME, "Photo")
    data = await _read_bounded(file)
    ext = _extension(file.filename)
    path = f"{APP_NAME}/photos/{uuid.uuid4().hex}.{ext}"
    result = put_object(path, data, file.content_type or "image/jpeg")
    return {
        "storage_path": result["path"],
        "size": len(data),
        "content_type": file.content_type,
        "filename": file.filename,
    }


class GenerateRequest(BaseModel):
    video_path: str
    photo_path: str
    video_meta: Optional[dict] = None
    photo_meta: Optional[dict] = None


@api_router.post("/jobs")
async def create_job(req: GenerateRequest):
    job = Job(
        video_path=req.video_path,
        photo_path=req.photo_path,
        video_meta=req.video_meta,
        photo_meta=req.photo_meta,
        provider_is_mock=provider.is_mock,
    )
    doc = job.model_dump()
    await db.jobs.insert_one(doc)
    # Kick off processing in background
    asyncio.create_task(_process_job(job.id))
    return {"id": job.id, "status": job.status}


STAGES = [
    (5, "Analyse de la vidéo..."),
    (15, "Détection du visage sur la photo..."),
    (28, "Extraction des repères faciaux (68 points)..."),
    (42, "Alignement 3D temporal..."),
    (58, "Envoi au moteur de rendu..."),
    (72, "Rendu neuronal multi-frame (peut prendre jusqu'à 2 min)..."),
    (88, "Fusion de texture et éclairage..."),
]


async def _make_temp_url(storage_path: str, content_type: str, ttl_seconds: int = 3600) -> str:
    """Create a short-lived public token for a private storage path."""
    token = uuid.uuid4().hex
    expires = (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).isoformat()
    await db.temp_urls.insert_one({
        "token": token,
        "storage_path": storage_path,
        "content_type": content_type,
        "expires_at": expires,
    })
    base = os.environ.get("PUBLIC_BACKEND_URL", "").rstrip("/")
    return f"{base}/api/temp/{token}"


@api_router.get("/temp/{token}")
async def temp_file(token: str):
    rec = await db.temp_urls.find_one({"token": token})
    if not rec:
        raise HTTPException(404, "Lien invalide ou expiré")
    if datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(410, "Lien expiré")
    data, ct = get_object(rec["storage_path"])
    return Response(content=data, media_type=rec.get("content_type") or ct)


async def _process_job(job_id: str):
    heartbeat = None
    try:
        job = await db.jobs.find_one({"id": job_id})
        if not job:
            return
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "processing"}})
        for pct, stage in STAGES:
            await db.jobs.update_one({"id": job_id}, {"$set": {"progress": pct, "stage": stage}})
            await asyncio.sleep(0.9)

        video_ct = "video/mp4"
        photo_ct = "image/jpeg"
        video_url = await _make_temp_url(job["video_path"], video_ct)
        image_url = await _make_temp_url(job["photo_path"], photo_ct)

        # Heartbeat: slowly nudge progress 88 -> 96 while fal.ai renders
        async def _heartbeat():
            pct = 88
            while True:
                await asyncio.sleep(3)
                pct = min(96, pct + 1)
                await db.jobs.update_one(
                    {"id": job_id},
                    {"$set": {"progress": pct, "stage": "Rendu final en cours sur GPU..."}},
                )

        heartbeat = asyncio.create_task(_heartbeat())
        used_mock = False
        fallback_reason = None
        try:
            # Choose the middle frame as reference — usually the face is best framed there.
            duration = None
            try:
                duration = int((job.get("video_meta") or {}).get("duration") or 0)
            except (TypeError, ValueError):
                duration = 0
            keyframe_id = max(1, (duration * 24) // 2) if duration else 1
            try:
                raw_bytes, ct = await asyncio.to_thread(
                    provider.generate, video_url, image_url, "720p", keyframe_id, duration or 15
                )
            except Exception as prov_err:
                # Any real provider failure (402 solde, quota, model 422, network...)
                # falls back to the mock so the site keeps working end-to-end.
                logger.warning(f"Provider failed, falling back to mock: {prov_err}")
                msg = str(prov_err)
                low = msg.lower()
                if "magic hour insuffisant" in low or "solde magic hour" in low or ("magic" in low and "402" in low):
                    fallback_reason = "magichour_credits"
                elif "insuffisant" in low or "402" in msg:
                    fallback_reason = "credits"
                elif "invalide" in low and "clé" in low:
                    fallback_reason = "invalid_key"
                else:
                    fallback_reason = "provider_error"
                from face_swap_provider import MockFaceSwapProvider
                raw_bytes, ct = await asyncio.to_thread(
                    MockFaceSwapProvider().generate, video_url, image_url, "720p"
                )
                used_mock = True
        finally:
            heartbeat.cancel()

        await db.jobs.update_one({"id": job_id}, {"$set": {"progress": 97, "stage": "Amélioration HD..."}})
        from video_processing import make_preview, enhance_final
        final_bytes = await asyncio.to_thread(enhance_final, raw_bytes)
        final_path = f"{APP_NAME}/finals/{uuid.uuid4().hex}.mp4"
        put_object(final_path, final_bytes, "video/mp4")

        await db.jobs.update_one({"id": job_id}, {"$set": {"progress": 99, "stage": "Création de l'aperçu flouté..."}})
        preview_bytes = await asyncio.to_thread(make_preview, raw_bytes)
        preview_path = f"{APP_NAME}/previews/{uuid.uuid4().hex}.mp4"
        put_object(preview_path, preview_bytes, "video/mp4")

        await db.jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": "preview_ready",
                "progress": 100,
                "stage": "Aperçu prêt",
                "preview_path": preview_path,
                "final_path": final_path,
                "provider_is_mock": used_mock,
                "fallback_reason": fallback_reason,
            }},
        )
    except Exception as e:
        if heartbeat:
            heartbeat.cancel()
        logger.exception("Job failed")
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "failed", "error": str(e)}})


@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job introuvable")
    # Never expose storage paths
    return {
        "id": job["id"],
        "status": job["status"],
        "progress": job.get("progress", 0),
        "stage": job.get("stage", ""),
        "payment_status": job.get("payment_status", "unpaid"),
        "provider_is_mock": job.get("provider_is_mock", True),
        "error": job.get("error"),
        "has_preview": bool(job.get("preview_path")),
        "video_meta": job.get("video_meta"),
        "fallback_reason": job.get("fallback_reason"),
        "created_at": job.get("created_at"),
        "expires_at": job.get("expires_at"),
    }


@api_router.get("/jobs/{job_id}/preview")
async def stream_preview(job_id: str):
    job = await db.jobs.find_one({"id": job_id})
    if not job or not job.get("preview_path"):
        raise HTTPException(404, "Aperçu indisponible")
    if job.get("cleaned"):
        raise HTTPException(410, "Fichier expiré")
    data, ct = get_object(job["preview_path"])
    return Response(content=data, media_type=ct)


@api_router.get("/jobs/{job_id}/download")
async def download_final(job_id: str):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(404, "Job introuvable")
    if job.get("cleaned"):
        raise HTTPException(410, "Fichier expiré")
    if job.get("payment_status") != "paid":
        raise HTTPException(402, "Paiement requis")
    if not job.get("final_path"):
        raise HTTPException(404, "Vidéo indisponible")
    data, ct = get_object(job["final_path"])
    filename = f"morphcut-{job_id[:8]}.mp4"
    return Response(
        content=data,
        media_type=ct,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ------------------- Stripe -------------------

@api_router.post("/payments/checkout")
async def create_checkout(req: CheckoutRequest):
    job = await db.jobs.find_one({"id": req.job_id})
    if not job:
        raise HTTPException(404, "Job introuvable")
    prices = stripe.Price.list(lookup_keys=["morphcut_hd_video"], active=True, limit=1).data
    if not prices:
        raise HTTPException(500, "Prix Stripe introuvable")
    price = prices[0]
    kwargs = dict(
        line_items=[{"price": price.id, "quantity": 1}],
        mode="payment",
        success_url=f"{req.origin_url}/confirmation/{req.job_id}?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{req.origin_url}/preview/{req.job_id}?canceled=1",
        metadata={"job_id": req.job_id, "lookup_key": "morphcut_hd_video"},
    )
    try:
        session = stripe.checkout.Session.create(**kwargs, managed_payments={"enabled": True})
    except stripe.error.InvalidRequestError as e:
        msg = (getattr(e, "user_message", "") or "").lower()
        if "managed payments" in msg or "ineligible" in msg:
            session = stripe.checkout.Session.create(
                **kwargs, automatic_tax={"enabled": True}, billing_address_collection="required"
            )
        else:
            raise

    await db.payment_transactions.insert_one({
        "session_id": session.id,
        "job_id": req.job_id,
        "amount": PRICE_EUR_CENTS,
        "currency": "eur",
        "status": "initiated",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.jobs.update_one({"id": req.job_id}, {"$set": {"session_id": session.id}})
    return {"checkout_url": session.url, "session_id": session.id}


@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id})
    if not record:
        raise HTTPException(404, "Transaction introuvable")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                now = datetime.now(timezone.utc).isoformat()
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {
                        "status": "completed",
                        "payment_status": "paid",
                        "stripe_payment_intent_id": s.payment_intent,
                        "updated_at": now,
                    }},
                )
                await db.jobs.update_one(
                    {"session_id": session_id},
                    {"$set": {"payment_status": "paid", "status": "paid"}},
                )
                record = await db.payment_transactions.find_one({"session_id": session_id})
        except stripe.error.StripeError:
            pass
    return {
        "session_id": record["session_id"],
        "status": record["status"],
        "payment_status": record["payment_status"],
        "job_id": record.get("job_id"),
    }


@api_router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    now = datetime.now(timezone.utc).isoformat()
    if t == "checkout.session.completed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {
                "status": "completed",
                "payment_status": obj.get("payment_status", "paid"),
                "stripe_payment_intent_id": obj.get("payment_intent"),
                "updated_at": now,
            }},
        )
        job_id = (obj.get("metadata") or {}).get("job_id")
        if job_id:
            await db.jobs.update_one({"id": job_id}, {"$set": {"payment_status": "paid", "status": "paid"}})
    elif t == "checkout.session.async_payment_failed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"]},
            {"$set": {"status": "failed", "payment_status": "failed", "updated_at": now}},
        )
    elif t == "checkout.session.expired":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"]},
            {"$set": {"status": "expired", "payment_status": "expired", "updated_at": now}},
        )
    elif t == "charge.refunded":
        await db.payment_transactions.update_one(
            {"stripe_payment_intent_id": obj.get("payment_intent")},
            {"$set": {"status": "refunded", "payment_status": "refunded", "updated_at": now}},
        )
    return {"status": "ok"}


# ------------------- Contact -------------------

@api_router.post("/contact")
async def contact(msg: ContactMessage):
    doc = {
        "id": uuid.uuid4().hex,
        "name": msg.name.strip(),
        "email": msg.email.strip(),
        "message": msg.message.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.contact_messages.insert_one(doc)
    return {"ok": True}


# ------------------- Admin (Emergent Google Auth) -------------------

@api_router.post("/admin/session")
async def admin_login(request: Request):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(400, "session_id manquant")
    try:
        r = py_requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.error(f"Auth verify failed: {e}")
        raise HTTPException(401, "Session Google invalide")

    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(401, "Email indisponible")
    if ADMIN_EMAILS and email not in ADMIN_EMAILS:
        raise HTTPException(403, "Accès administrateur refusé")

    token = data.get("session_token") or uuid.uuid4().hex
    expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    await db.admin_sessions.insert_one({
        "token": token,
        "email": email,
        "name": data.get("name"),
        "picture": data.get("picture"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires,
    })
    resp = Response(content='{"ok":true,"email":"' + email + '","token":"' + token + '"}', media_type="application/json")
    resp.set_cookie(
        "admin_token", token, httponly=True, secure=True, samesite="none",
        max_age=7 * 24 * 3600, path="/",
    )
    return resp


@api_router.post("/admin/logout")
async def admin_logout(request: Request):
    token = request.headers.get("X-Admin-Token") or request.cookies.get("admin_token")
    if token:
        await db.admin_sessions.update_one({"token": token}, {"$set": {"revoked": True}})
    resp = Response(content='{"ok":true}', media_type="application/json")
    resp.delete_cookie("admin_token", path="/")
    return resp


@api_router.get("/admin/me")
async def admin_me(session=Depends(_get_admin)):
    return {"email": session["email"], "name": session.get("name"), "picture": session.get("picture")}


@api_router.get("/admin/stats")
async def admin_stats(session=Depends(_get_admin)):
    total_jobs = await db.jobs.count_documents({})
    preview_ready = await db.jobs.count_documents({"status": {"$in": ["preview_ready", "paid"]}})
    paid = await db.jobs.count_documents({"payment_status": "paid"})
    failed = await db.jobs.count_documents({"status": "failed"})
    active_files = await db.jobs.count_documents({"cleaned": {"$ne": True}})
    paid_tx = db.payment_transactions.find({"payment_status": "paid"})
    revenue_cents = 0
    async for tx in paid_tx:
        revenue_cents += int(tx.get("amount") or 0)

    # 14-day revenue series
    now = datetime.now(timezone.utc)
    series = []
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).date()
        d_start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc).isoformat()
        d_end = (datetime(day.year, day.month, day.day, tzinfo=timezone.utc) + timedelta(days=1)).isoformat()
        c = 0
        cur = db.payment_transactions.find({
            "payment_status": "paid",
            "updated_at": {"$gte": d_start, "$lt": d_end},
        })
        async for tx in cur:
            c += int(tx.get("amount") or 0)
        series.append({"date": day.isoformat(), "revenue": round(c / 100, 2)})

    conversion = round((paid / preview_ready * 100.0), 1) if preview_ready else 0.0
    return {
        "total_generations": total_jobs,
        "previews_ready": preview_ready,
        "paid_videos": paid,
        "failed": failed,
        "active_files": active_files,
        "revenue_eur": round(revenue_cents / 100, 2),
        "conversion_rate": conversion,
        "revenue_series": series,
        "provider_is_mock": provider.is_mock,
    }


@api_router.get("/admin/transactions")
async def admin_transactions(session=Depends(_get_admin)):
    txs = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return {"transactions": txs}


@api_router.get("/admin/jobs")
async def admin_jobs(session=Depends(_get_admin)):
    jobs = await db.jobs.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return {"jobs": jobs}


# ------------------- Register -------------------

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
