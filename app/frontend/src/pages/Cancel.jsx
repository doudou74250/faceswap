import { Link } from "react-router-dom";
export default function Cancel() {
  return (
    <div className="max-w-2xl mx-auto py-24 text-center px-4">
      <h1 className="text-3xl font-bold text-slate-900">Paiement annulé</h1>
      <p className="mt-3 text-slate-600">Votre aperçu est toujours disponible. Aucun montant n'a été prélevé.</p>
      <Link to="/create" className="mt-6 inline-flex items-center gap-2 h-11 px-6 rounded-full bg-slate-900 text-white text-sm font-medium">Retour</Link>
    </div>
  );
}
