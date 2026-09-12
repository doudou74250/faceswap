import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Download, Loader2, Copy, Sparkles } from "lucide-react";
import api, { API } from "@/lib/api";

export default function Confirmation() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState("checking"); // checking | paid | failed
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!sessionId) { setStatus("failed"); return; }
    let cancel = false;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (cancel) return;
        if (data.payment_status === "paid") { setStatus("paid"); return; }
        if (data.payment_status === "failed" || data.payment_status === "expired") { setStatus("failed"); return; }
        if (attempts < 15) {
          setAttempts((a) => a + 1);
          setTimeout(poll, 2000);
        } else {
          setStatus("failed");
        }
      } catch (e) {
        if (attempts < 5) {
          setAttempts((a) => a + 1);
          setTimeout(poll, 2000);
        } else setStatus("failed");
      }
    };
    poll();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const download = () => {
    window.location.href = `${API}/jobs/${id}/download`;
  };
  const copy = async () => {
    await navigator.clipboard.writeText(`${API}/jobs/${id}/download`);
    toast.success("Lien copié — valable 24h");
  };

  if (status === "checking") {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center">
        <Loader2 className="animate-spin mx-auto text-slate-400" size={32} />
        <h1 className="mt-6 text-2xl font-bold text-slate-900">Confirmation du paiement...</h1>
        <p className="mt-2 text-slate-600 text-sm">Nous vérifions votre transaction auprès de Stripe.</p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Paiement non confirmé</h1>
        <p className="mt-2 text-slate-600 text-sm">Nous n'avons pas pu valider votre paiement.</p>
        <Link to={`/preview/${id}`} className="mt-6 inline-flex items-center gap-2 h-11 px-6 rounded-full bg-slate-900 text-white text-sm font-medium">Retour à l'aperçu</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </div>
        <h1 className="mt-6 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Paiement confirmé 🎉</h1>
        <p className="mt-2 text-slate-600">Votre vidéo HD est prête à être téléchargée.</p>
      </div>

      <div className="mt-10 p-8 rounded-3xl bg-white border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-semibold">
          <Sparkles size={14} /> Votre vidéo HD
        </div>
        <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div>
            <div className="font-mono text-sm text-slate-500">morphcut-{id.slice(0, 8)}.mp4</div>
            <div className="text-xs text-slate-400 mt-1">Lien temporaire valable 24h</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={download}
              data-testid="confirmation-download-hd-button"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
            >
              <Download size={16} /> Télécharger ma vidéo
            </button>
            <button
              onClick={copy}
              data-testid="confirmation-copy-link-button"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white border border-slate-200 text-slate-800 text-sm font-medium hover:bg-slate-50"
            >
              <Copy size={16} /> Copier le lien
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link to="/create" data-testid="confirmation-new-swap-button" className="text-sm text-slate-600 hover:text-slate-900">Créer une nouvelle vidéo →</Link>
      </div>
    </div>
  );
}
