import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Upload, Image as ImageIcon, Film, X, Loader2, ShieldCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import api from "@/lib/api";

const MAX_MB = 100;

function formatSize(bytes) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} Mo` : `${(bytes / 1024).toFixed(0)} Ko`;
}

function Dropzone({ label, accept, kind, file, previewUrl, meta, onFile, onClear, testid }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      className={`dropzone ${drag ? "drag-active" : ""} rounded-3xl border-2 border-dashed border-slate-200 bg-white p-6 min-h-[280px] flex flex-col`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">{label}</div>
        {file && (
          <button onClick={onClear} className="text-slate-400 hover:text-slate-700" data-testid={`${testid}-clear`}>
            <X size={16} />
          </button>
        )}
      </div>

      {!file ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500 hover:text-slate-800 transition"
          data-testid={testid}
        >
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 grid place-items-center">
            {kind === "video" ? <Film size={22} /> : <ImageIcon size={22} />}
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-slate-800">Cliquez ou déposez un fichier</div>
            <div className="text-xs mt-1 font-mono text-slate-400">{accept.split(",").join(" · ")} · max {MAX_MB} Mo</div>
          </div>
        </button>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 rounded-2xl overflow-hidden bg-slate-100 relative">
            {kind === "video" ? (
              <video src={previewUrl} controls className="w-full h-full object-contain bg-black" />
            ) : (
              <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span className="truncate max-w-[60%]" title={file.name}>{file.name}</span>
            <span>{formatSize(file.size)}{meta?.duration ? ` · ${meta.duration}s` : ""}</span>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </div>
  );
}

export default function Create() {
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoMeta, setVideoMeta] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [consent, setConsent] = useState(false);
  const pollRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, []);

  const onVideoFile = useCallback((f) => {
    const okExt = /\.(mp4|mov|webm)$/i.test(f.name);
    if (!okExt) return toast.error("Format vidéo non supporté (MP4, MOV, WebM)");
    if (f.size > MAX_MB * 1024 * 1024) return toast.error(`Vidéo trop volumineuse (max ${MAX_MB} Mo)`);
    setVideo(f);
    const url = URL.createObjectURL(f);
    setVideoUrl(url);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => setVideoMeta({ duration: Math.round(v.duration), width: v.videoWidth, height: v.videoHeight });
    v.src = url;
  }, []);

  const onPhotoFile = useCallback((f) => {
    const okExt = /\.(jpe?g|png|webp)$/i.test(f.name);
    if (!okExt) return toast.error("Format photo non supporté (JPG, PNG, WebP)");
    if (f.size > MAX_MB * 1024 * 1024) return toast.error(`Photo trop volumineuse`);
    setPhoto(f);
    setPhotoUrl(URL.createObjectURL(f));
  }, []);

  const start = async () => {
    if (!video || !photo) return toast.error("Ajoutez une vidéo ET une photo");
    if (!consent) return toast.error("Merci de confirmer que vous détenez les droits");
    if (uploading || processing) return;
    setUploading(true);
    setStage("Envoi des fichiers...");
    setProgress(3);
    try {
      const fd1 = new FormData();
      fd1.append("file", video);
      const fd2 = new FormData();
      fd2.append("file", photo);
      const [vRes, pRes] = await Promise.all([
        api.post("/upload/video", fd1),
        api.post("/upload/photo", fd2),
      ]);
      setUploading(false);
      setProcessing(true);
      const jobRes = await api.post("/jobs", {
        video_path: vRes.data.storage_path,
        photo_path: pRes.data.storage_path,
        video_meta: videoMeta,
      });
      const jobId = jobRes.data.id;
      // Poll (guarded against unmount)
      const startedAt = Date.now();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        if (!mountedRef.current) { clearInterval(pollRef.current); pollRef.current = null; return; }
        try {
          const { data } = await api.get(`/jobs/${jobId}`);
          if (!mountedRef.current) return;
          setProgress(data.progress);
          setStage(data.stage);
          if (data.status === "preview_ready") {
            clearInterval(pollRef.current); pollRef.current = null;
            // Defer navigate to next tick so React fully commits the current update first
            setTimeout(() => { if (mountedRef.current) navigate(`/preview/${jobId}`); }, 0);
          } else if (data.status === "failed") {
            clearInterval(pollRef.current); pollRef.current = null;
            toast.error("La génération a échoué. Réessayez.");
            setProcessing(false);
          } else if (Date.now() - startedAt > 300000) {
            clearInterval(pollRef.current); pollRef.current = null;
            toast.error("Délai dépassé (5 min).");
            setProcessing(false);
          }
        } catch (e) {
          console.error(e);
        }
      }, 1000);
    } catch (e) {
      setUploading(false);
      setProcessing(false);
      toast.error(e?.response?.data?.detail || "Erreur pendant l'envoi");
    }
  };

  const busy = uploading || processing;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="max-w-2xl">
        <div className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">Étape 1 · 2</div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Créez votre vidéo face swap</h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          Importez la vidéo cible et la photo du visage à intégrer. L'aperçu est gratuit — vous payez seulement si le résultat vous plaît.
        </p>
      </div>

      <div className="mt-10 grid md:grid-cols-2 gap-6">
        <Dropzone
          label="1. Votre vidéo"
          kind="video"
          accept=".mp4,.mov,.webm"
          file={video}
          previewUrl={videoUrl}
          meta={videoMeta}
          onFile={onVideoFile}
          onClear={() => { setVideo(null); setVideoUrl(null); setVideoMeta(null); }}
          testid="video-dropzone-input"
        />
        <Dropzone
          label="2. Photo du visage à utiliser"
          kind="photo"
          accept=".jpg,.jpeg,.png,.webp"
          file={photo}
          previewUrl={photoUrl}
          onFile={onPhotoFile}
          onClear={() => { setPhoto(null); setPhotoUrl(null); }}
          testid="photo-dropzone-input"
        />
      </div>

      <div className="mt-8 p-6 rounded-2xl bg-white border border-slate-100">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-slate-300"
            data-testid="consent-checkbox"
          />
          <span className="text-sm text-slate-600 leading-relaxed">
            Je confirme <strong>détenir les droits</strong> d'utilisation des fichiers importés et disposer du consentement
            de toute personne visible. Aucun contenu illégal, frauduleux, trompeur ou non consenti n'est autorisé.
          </span>
        </label>
      </div>

      {busy && (
        <div className="mt-8 p-6 rounded-3xl bg-white border border-slate-100">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-800">
            <Loader2 className="animate-spin" size={16} />
            <span data-testid="swap-progress-status-text">{stage || "Traitement en cours..."}</span>
            <span className="ml-auto font-mono text-slate-500">{progress}%</span>
          </div>
          <div className="mt-3">
            <Progress value={progress} data-testid="swap-progress-bar" />
          </div>
          <p className="mt-3 text-xs text-slate-500">Ne fermez pas cet onglet pendant le traitement.</p>
        </div>
      )}

      <div className="mt-10 flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={start}
          disabled={busy || !video || !photo}
          data-testid="start-swap-generation-button"
          className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-slate-900 text-white font-medium hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
          <span>{busy ? "Traitement..." : "Générer mon aperçu"}</span>
        </button>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck size={14} className="text-emerald-600" />
          Fichiers chiffrés · Suppression sous 24h
        </div>
      </div>
    </div>
  );
}
