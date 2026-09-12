import { Link } from "react-router-dom";
import { Sparkles, Upload, Play, Download, ShieldCheck, Zap, Star, Check } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const STEPS = [
  { n: "01", icon: Upload, title: "Importez votre vidéo", desc: "MP4, MOV ou WebM — jusqu'à 100 Mo." },
  { n: "02", icon: Sparkles, title: "Ajoutez une photo", desc: "Le visage à intégrer, en JPG, PNG ou WebP." },
  { n: "03", icon: Play, title: "Prévisualisez & téléchargez", desc: "Aperçu gratuit. HD sans filigrane à 4,99 €." },
];

const FEATURES = [
  { icon: Zap, title: "Rendu rapide", desc: "Aperçu en quelques secondes, HD prêt à télécharger." },
  { icon: ShieldCheck, title: "Confidentiel", desc: "Vos fichiers sont chiffrés et supprimés sous 24h." },
  { icon: Star, title: "Studio-grade", desc: "Alignement 3D des visages, cohérence temporelle." },
];

export default function Landing() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-slate-900/5 text-xs font-medium text-slate-700 border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Nouveau · Face swap vidéo IA
              </div>
              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05]">
                Échangez n'importe quel visage<br />
                <span className="text-slate-500">en vidéo, en quelques secondes.</span>
              </h1>
              <p className="mt-6 text-lg text-slate-600 max-w-2xl leading-relaxed">
                Importez une vidéo, ajoutez une photo. Notre IA fusionne le visage image par image
                avec un rendu naturel. Aperçu gratuit, vidéo HD à <span className="font-semibold text-slate-900">4,99 €</span>.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/create"
                  data-testid="hero-create-swap-button"
                  className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-slate-900 text-white font-medium hover:bg-slate-800 transition shadow-sm"
                >
                  Créer ma vidéo →
                </Link>
                <a
                  href="#comment-ca-marche"
                  data-testid="hero-view-demo-button"
                  className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-white border border-slate-200 text-slate-800 font-medium hover:bg-slate-50 transition"
                >
                  Voir comment ça marche
                </a>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-slate-500">
                <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-600" /> Suppression sous 24h</div>
                <div className="flex items-center gap-2"><Check size={16} className="text-emerald-600" /> Paiement Stripe</div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-slate-900 shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"
                  alt="Face swap preview"
                  className="absolute inset-0 w-full h-full object-cover opacity-95"
                />
                <div className="preview-watermark">
                  <span>APERÇU · MORPHCUT</span>
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white text-xs font-mono">
                  <span>PREVIEW · 5s · 480p</span>
                  <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20">HD 4,99 €</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 ÉTAPES */}
      <section id="comment-ca-marche" className="py-20 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">Fonctionnement</div>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Trois étapes. Zéro complexité.
            </h2>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.n} className="p-8 rounded-3xl bg-white border border-slate-100 hover:border-slate-300 hover:shadow-lg transition">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 text-white grid place-items-center">
                      <Icon size={20} />
                    </div>
                    <span className="font-mono text-sm text-slate-400">{s.n}</span>
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-slate-600 leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="p-6 rounded-2xl bg-white border border-slate-100">
                <Icon size={22} className="text-slate-900" />
                <h4 className="mt-4 text-lg font-semibold text-slate-900">{f.title}</h4>
                <p className="mt-1 text-slate-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 bg-white border-y border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">Tarif unique</div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Simple. Rapide. 4,99 € par vidéo.
          </h2>
          <p className="mt-4 text-slate-600">Aucun abonnement. Aucun engagement. Vous ne payez que si l'aperçu vous plaît.</p>

          <div className="mt-10 p-8 rounded-3xl bg-slate-50 border border-slate-100 text-left">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-slate-900">4,99 €</span>
              <span className="text-slate-500 text-sm">TTC · par vidéo HD</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              <li className="flex gap-2"><Check size={18} className="text-emerald-600 shrink-0" /> Aperçu <strong>gratuit</strong> avant paiement</li>
              <li className="flex gap-2"><Check size={18} className="text-emerald-600 shrink-0" /> Téléchargement HD sans filigrane</li>
              <li className="flex gap-2"><Check size={18} className="text-emerald-600 shrink-0" /> Fichiers chiffrés, supprimés sous 24h</li>
              <li className="flex gap-2"><Check size={18} className="text-emerald-600 shrink-0" /> Paiement sécurisé Stripe</li>
            </ul>
            <Link
              to="/create"
              className="mt-8 inline-flex items-center justify-center gap-2 h-12 w-full rounded-full bg-slate-900 text-white font-medium hover:bg-slate-800 transition"
            >
              <Download size={16} /> Créer ma vidéo maintenant
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">Questions fréquentes</div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Tout ce qu'il faut savoir</h2>
          <Accordion type="single" collapsible className="mt-8">
            <AccordionItem value="q1">
              <AccordionTrigger>Puis-je essayer avant de payer ?</AccordionTrigger>
              <AccordionContent>Oui. Vous générez un aperçu court avec filigrane gratuitement. Le paiement (4,99 €) débloque la vidéo HD complète, sans filigrane.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger>Quels formats sont acceptés ?</AccordionTrigger>
              <AccordionContent>Vidéo : MP4, MOV, WebM (max 100 Mo). Photo : JPG, PNG, WebP.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger>Qu'advient-il de mes fichiers ?</AccordionTrigger>
              <AccordionContent>Ils sont stockés de façon chiffrée sur nos serveurs et automatiquement supprimés après 24h. Personne d'autre que vous n'y a accès.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4">
              <AccordionTrigger>Ai-je le droit d'utiliser n'importe quelle photo ?</AccordionTrigger>
              <AccordionContent>Vous devez posséder les droits sur les images et vidéos importées, et disposer du consentement des personnes visibles. L'usage à des fins illégales, frauduleuses ou non consenties est strictement interdit.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>
    </div>
  );
}
