import { Link, Outlet, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";

export default function Layout() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA]">
      <header className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group" data-testid="nav-home-link">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white grid place-items-center">
              <Sparkles size={18} />
            </div>
            <span className="font-heading font-bold text-lg tracking-tight text-slate-900">MorphCut</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <Link to="/create" className="hover:text-slate-900" data-testid="nav-create-link">Créer</Link>
            <a href="/#comment-ca-marche" className="hover:text-slate-900">Fonctionnement</a>
            <a href="/#pricing" className="hover:text-slate-900" data-testid="nav-pricing-link">Tarifs</a>
            <Link to="/admin" className="hover:text-slate-900" data-testid="nav-admin-link">Admin</Link>
          </nav>
          <Link
            to="/create"
            data-testid="nav-create-cta-button"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
          >
            Créer ma vidéo
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {!isAdmin && (
        <footer className="mt-24 border-t border-slate-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid gap-8 md:grid-cols-4 text-sm">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-slate-900 text-white grid place-items-center">
                  <Sparkles size={14} />
                </div>
                <span className="font-heading font-bold text-slate-900">MorphCut</span>
              </div>
              <p className="mt-3 text-slate-500 leading-relaxed">
                Face swap vidéo IA. Paiement unique 4,99 €. Suppression sous 24h.
              </p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Produit</div>
              <ul className="space-y-2 text-slate-600">
                <li><Link to="/create" className="hover:text-slate-900">Créer une vidéo</Link></li>
                <li><a href="/#pricing" className="hover:text-slate-900">Tarifs</a></li>
              </ul>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Légal</div>
              <ul className="space-y-2 text-slate-600">
                <li><Link to="/terms" className="hover:text-slate-900">CGU</Link></li>
                <li><Link to="/privacy" className="hover:text-slate-900">Confidentialité</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Support</div>
              <ul className="space-y-2 text-slate-600">
                <li><Link to="/contact" className="hover:text-slate-900">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
              <span>© {new Date().getFullYear()} MorphCut. Tous droits réservés.</span>
              <span className="font-mono">Paiement sécurisé Stripe · Chiffrement SSL</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
