"""
Face Swap Provider abstraction.

Two providers currently supported:
  * mock  — returns the uploaded video bytes unchanged. Kept for local dev / cost-free tests.
  * fal   — fal.ai Pixverse Swap (endpoint `fal-ai/pixverse/swap`) via Emergent Universal Key.

Selected via env var FACE_SWAP_PROVIDER=fal|mock.

Interface (URL-based):
    provider.generate(video_url: str, image_url: str, resolution: str) -> (bytes, content_type)

The caller (server.py) is responsible for:
  - creating short-lived public URLs for the uploaded files
  - uploading the returned bytes back to object storage
"""
import os
import time
import logging
import requests
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

FACE_SWAP_PROVIDER_NAME = os.environ.get("FACE_SWAP_PROVIDER", "mock").lower()


class MockFaceSwapProvider:
    name = "mock"
    is_mock = True

    def generate(self, video_url: str, image_url: str, resolution: str = "720p"):
        # Fetch the original video bytes and return them unchanged (mock).
        time.sleep(1.0)
        r = requests.get(video_url, timeout=120)
        r.raise_for_status()
        return r.content, "video/mp4"


class FalPixverseSwapProvider:
    """fal.ai Pixverse Swap via Emergent Universal Key. Fast but lower quality."""

    name = "fal-pixverse"
    is_mock = False
    ENDPOINT_ID = "fal-ai/pixverse/swap"
    QUEUE_ORIGIN = "https://queue.fal.run"

    def __init__(self):
        self.key = os.environ["EMERGENT_LLM_KEY"]
        base = (os.environ.get("INTEGRATION_PROXY_URL") or "https://integrations.emergentagent.com").rstrip("/")
        self.proxy_base = f"{base}/api/v1/fal"
        self.expected_queue_prefix = f"{self.proxy_base}/queue/"

    def _headers(self, extra=None):
        h = {"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"}
        if extra:
            h.update(extra)
        return h

    def _trusted_queue_url(self, url: str) -> str:
        if not url.startswith(self.expected_queue_prefix):
            raise RuntimeError("Untrusted queue url returned by proxy")
        return url

    def _build_payload(self, video_url: str, image_url: str, resolution: str, keyframe_id: int = 1) -> dict:
        return {
            "video_url": video_url,
            "image_url": image_url,
            "mode": "person",
            "resolution": resolution,
            "keyframe_id": max(1, int(keyframe_id)),
            "original_sound_switch": True,
        }

    def _extract_video_url(self, result: dict) -> tuple[str, str]:
        v = result.get("video") or {}
        return v.get("url", ""), v.get("content_type", "video/mp4")

    def generate(self, video_url: str, image_url: str, resolution: str = "720p", keyframe_id: int = 1):
        payload = self._build_payload(video_url, image_url, resolution, keyframe_id)
        logger.info(f"Submitting {self.ENDPOINT_ID} ({resolution})")
        r = requests.post(
            f"{self.proxy_base}/proxy",
            headers=self._headers({"X-Fal-Target-Url": f"{self.QUEUE_ORIGIN}/{self.ENDPOINT_ID}"}),
            json=payload,
            timeout=60,
        )
        if r.status_code == 402:
            raise RuntimeError("Solde Universal Key insuffisant")
        r.raise_for_status()
        submission = r.json()
        status_url = self._trusted_queue_url(submission["status_url"])
        response_url = self._trusted_queue_url(submission["response_url"])

        deadline = time.monotonic() + 900
        while time.monotonic() < deadline:
            time.sleep(3)
            sr = requests.get(status_url, headers=self._headers(), timeout=30)
            sr.raise_for_status()
            body = sr.json()
            status = (body.get("status") or "").upper()
            logger.info(f"fal.ai status: {status}")
            if status in {"COMPLETED", "OK"}:
                if body.get("error"):
                    raise RuntimeError(f"fal.ai a échoué: {body['error']}")
                rr = requests.get(response_url, headers=self._headers(), timeout=60)
                rr.raise_for_status()
                result = rr.json()
                out_url, ct = self._extract_video_url(result)
                if not out_url:
                    raise RuntimeError("Réponse fal.ai sans URL de vidéo")
                dl = requests.get(out_url, timeout=300)
                dl.raise_for_status()
                return dl.content, ct
            if status in {"FAILED", "CANCELLED", "CANCELED", "ERROR"}:
                raise RuntimeError(f"fal.ai a échoué: {status}")
        raise RuntimeError("Timeout fal.ai")


class FalWanAnimateReplaceProvider(FalPixverseSwapProvider):
    """fal.ai Wan v2.2-14B Animate Replace — meilleur rendu naturel (lumière/tons),
    Turbo activé pour rester rapide. Facturé sur Universal Key."""

    name = "fal-wan-animate-replace"
    ENDPOINT_ID = "fal-ai/wan/v2.2-14b/animate/replace"

    def _build_payload(self, video_url: str, image_url: str, resolution: str, keyframe_id: int = 1) -> dict:
        return {
            "video_url": video_url,
            "image_url": image_url,
            "resolution": resolution,
            "use_turbo": True,
            "video_quality": "high",
            "video_write_mode": "fast",
        }


class MagicHourFaceSwapProvider:
    """Magic Hour AI face swap video via https://api.magichour.ai.

    Flow: request signed upload URLs → PUT video/photo → POST /v1/face-swap →
    poll /v1/video-projects/{id} until status='complete' → download output.
    Facturé sur le compte Magic Hour du user (clé mhk_live_...), pas sur les crédits Emergent.
    """

    name = "magic-hour"
    is_mock = False
    BASE = "https://api.magichour.ai"

    IMAGE_EXT = {
        "image/jpeg": "jpg", "image/jpg": "jpg",
        "image/png": "png", "image/webp": "webp",
    }

    def __init__(self):
        self.key = os.environ["MAGIC_HOUR_API_KEY"]

    def _auth(self, json_body: bool = False):
        h = {"Authorization": f"Bearer {self.key}", "Accept": "application/json"}
        if json_body:
            h["Content-Type"] = "application/json"
        return h

    def generate(self, video_url: str, image_url: str, resolution: str = "720p", keyframe_id: int = 1, duration_seconds: float = 15):
        # 1) pull the user's files from our own temporary URLs
        vr = requests.get(video_url, timeout=180)
        vr.raise_for_status()
        video_bytes = vr.content
        ir = requests.get(image_url, timeout=60)
        ir.raise_for_status()
        image_bytes = ir.content

        image_ct = (ir.headers.get("Content-Type") or "image/jpeg").split(";")[0].strip().lower()
        image_ext = self.IMAGE_EXT.get(image_ct, "jpg")
        video_ext = "mp4"

        # 2) request signed upload slots
        logger.info("Magic Hour: requesting upload URLs")
        r = requests.post(
            f"{self.BASE}/v1/files/upload-urls",
            headers=self._auth(json_body=True),
            json={"items": [
                {"type": "video", "extension": video_ext},
                {"type": "image", "extension": image_ext},
            ]},
            timeout=60,
        )
        if r.status_code == 402:
            raise RuntimeError("Solde Magic Hour insuffisant")
        if r.status_code == 401:
            raise RuntimeError("Clé Magic Hour invalide")
        r.raise_for_status()
        items = r.json().get("items") or []
        if len(items) < 2:
            raise RuntimeError("Réponse Magic Hour upload-urls invalide")
        video_slot, image_slot = items[0], items[1]

        # 3) PUT the raw bytes to the signed URLs
        logger.info("Magic Hour: uploading video + image")
        pv = requests.put(video_slot["upload_url"], data=video_bytes, timeout=300)
        pv.raise_for_status()
        pi = requests.put(image_slot["upload_url"], data=image_bytes, timeout=120)
        pi.raise_for_status()

        # 4) create the face-swap job
        end_seconds = max(0.5, min(float(duration_seconds or 15), 60.0))
        payload = {
            "name": "MorphCut face swap",
            "start_seconds": 0,
            "end_seconds": end_seconds,
            "style": {"version": "default"},
            "assets": {
                "video_source": "file",
                "video_file_path": video_slot["file_path"],
                "image_file_path": image_slot["file_path"],
                "face_swap_mode": "all-faces",
            },
        }
        logger.info(f"Magic Hour: submitting face-swap (end_seconds={end_seconds})")
        r = requests.post(f"{self.BASE}/v1/face-swap", headers=self._auth(json_body=True), json=payload, timeout=60)
        if r.status_code == 402:
            raise RuntimeError("Solde Magic Hour insuffisant")
        if r.status_code in (400, 422):
            raise RuntimeError(f"Magic Hour a rejeté la requête: {r.text[:200]}")
        r.raise_for_status()
        project_id = r.json().get("id")
        if not project_id:
            raise RuntimeError("Magic Hour: pas d'ID retourné")

        # 5) poll
        deadline = time.monotonic() + 900
        while time.monotonic() < deadline:
            time.sleep(3)
            sr = requests.get(
                f"{self.BASE}/v1/video-projects/{project_id}",
                headers=self._auth(),
                timeout=30,
            )
            sr.raise_for_status()
            body = sr.json()
            status = body.get("status")
            logger.info(f"Magic Hour status: {status}")
            if status == "complete":
                downloads = body.get("downloads") or []
                if not downloads:
                    raise RuntimeError("Magic Hour: pas d'URL de sortie")
                out_url = downloads[0]["url"]
                dl = requests.get(out_url, timeout=300)
                dl.raise_for_status()
                return dl.content, "video/mp4"
            if status in ("error", "canceled"):
                err = body.get("error") or {}
                raise RuntimeError(f"Magic Hour {status}: {err.get('message') or err}")
        raise RuntimeError("Timeout Magic Hour")


def get_provider():
    if FACE_SWAP_PROVIDER_NAME in {"magichour", "magic-hour", "magic_hour"}:
        try:
            return MagicHourFaceSwapProvider()
        except Exception as e:
            logger.error(f"magic-hour provider init failed: {e} — falling back to mock")
    if FACE_SWAP_PROVIDER_NAME in {"fal", "fal-pixverse", "pixverse"}:
        try:
            return FalPixverseSwapProvider()
        except Exception as e:
            logger.error(f"fal pixverse provider init failed: {e} — falling back to mock")
    if FACE_SWAP_PROVIDER_NAME in {"fal-wan", "wan"}:
        try:
            return FalWanAnimateReplaceProvider()
        except Exception as e:
            logger.error(f"fal wan provider init failed: {e} — falling back to mock")
    return MockFaceSwapProvider()
