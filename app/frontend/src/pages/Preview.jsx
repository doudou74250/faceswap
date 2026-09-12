import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Check, Sparkles, Info } from "lucide-react";
import api, { API } from "@/lib/api";

export default function Preview() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data } = await api.get(`/jobs/${id}`);
        if (!cancel) { setJob(data); setLoading(false); }
      } catch (e) {
        toast.error("Aperçu introuvable");
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [id]);

  const pay = async () => {
    setPaying(true);
    try {
      const { data } = await api.post("/payments/checkout", {
        job_id: id,
        origin_url: window.location.origin,
      });
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur lors de la création du paiement");
      setPaying(false);
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto py-24 text-center text-slate-500 flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={16}/> Chargement...</div>;
  }
  if (!job) return null;

  const previewUrl = `${API}/jobs/${id}/preview`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="grid lg:grid-cols-5 gap-10">
        <div className="lg:col-span-3">
          <div className="text-xs uppercase tracking-widest text-emerald-600 font-semibold flex items-center gap-2">
            <Check size={14} /> Aperçu gratuit
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Votre vidéo est prête</h1>
          <p className="mt-2 text-slate-600">Ceci est un aperçu à qualité réduite avec filigrane. Débloquez la version HD complète pour 4,99 €.</p>

          <div className="mt-6 relative rounded-3xl overflow-hidden bg-black aspect-video border border-slate-100">
            <video
              src={previewUrl}
              controls
              className="w-full h-full object-contain"
              data-testid="preview-video-player"
            />
            <div className="preview-watermark">
              <span>APERÇU · MORPHCUT</span>
            </div>
          </div>

          {job.provider_is_mock && (
            <div className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex gap-3 text-sm text-amber-900">
              <Info size={18} className="shrink-0 mt-0.5" />
              <div>
                {job.fallback_reason === "magichour_credits" ? (
                  <>
                    <strong>Solde Magic Hour insuffisant</strong> — rechargez vos crédits sur{" "}
                    <a href="https://magichour.ai/developer" target="_blank" rel="noreferrer" className="underline font-medium">magichour.ai/developer</a>{" "}
                    puis relancez une génération.
                  </>
                ) : job.fallback_reason === "invalid_key" ? (
                  <>
                    <strong>Clé Magic Hour invalide</strong> — vérifiez la clé dans <code className="font-mono">backend/.env</code> (<code className="font-mono">MAGIC_HOUR_API_KEY</code>).
                  </>
                ) : job.fallback_reason === "credits" ? (
                  <>
                    <strong>Solde Universal Key épuisé</strong> — la génération IA réelle a été
                    temporairement remplacée par un rendu de démonstration (vidéo d'origine).
                    Rechargez votre solde dans <em>Profile → Manage plan → Universal Key → Add Balance</em>{" "}
                    puis relancez une génération pour activer le vrai face swap fal.ai.
                  </>
                ) : job.fallback_reason === "provider_error" ? (
                  <>
                    <strong>Fournisseur IA indisponible</strong> — l'API fal.ai a répondu avec une
                    erreur. Le rendu affiché est une démonstration. Réessayez dans un instant.
                  </>
                ) : (
                  <>
                    <strong>MODE DÉMO (MOCK)</strong> — Aucun fournisseur IA branché.
                    L'infrastructure (upload, paiement, stockage, téléchargement) est 100 % opérationnelle.
                    Configurez <code className="font-mono">FACE_SWAP_PROVIDER=fal</code> et rechargez
                    votre solde Universal Key pour activer le vrai face swap.
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-24 p-8 rounded-3xl bg-white border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-slate-900" />
              <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Vidéo complète</span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-5xl font-bold text-slate-900">4,99 €</span>
              <span className="text-slate-500 text-sm">TTC</span>
            </div>
            <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
              <li className="flex gap-2"><Check size={16} className="text-emerald-600 shrink-0 mt-0.5"/> HD sans filigrane</li>
              <li className="flex gap-2"><Check size={16} className="text-emerald-600 shrink-0 mt-0.5"/> Téléchargement immédiat</li>
              <li className="flex gap-2"><Check size={16} className="text-emerald-600 shrink-0 mt-0.5"/> Audio d'origine conservé</li>
              <li className="flex gap-2"><Check size={16} className="text-emerald-600 shrink-0 mt-0.5"/> Paiement sécurisé Stripe</li>
            </ul>
            <button
              onClick={pay}
              disabled={paying}
              data-testid="preview-pay-download-cta-button"
              className="mt-6 w-full h-12 rounded-full bg-slate-900 text-white font-medium hover:bg-slate-800 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {paying && <Loader2 className="animate-spin" size={16} />}
              <span>{paying ? "Redirection..." : "Débloquer la vidéo — 4,99 €"}</span>
            </button>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck size={14} className="text-emerald-600" /> Paiement 100 % sécurisé · Stripe
            </div>
            <Link to="/create" className="mt-3 block text-center text-xs text-slate-500 hover:text-slate-800">← Refaire un swap</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
