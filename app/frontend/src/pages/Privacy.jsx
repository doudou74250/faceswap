export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-slate-900">Politique de confidentialité</h1>
      <p className="text-slate-600 mt-2 text-sm">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

      <h2 className="mt-8 text-xl font-semibold text-slate-900">Données collectées</h2>
      <p className="text-slate-600">Les fichiers importés (vidéo et photo), l'email transmis lors du paiement (via Stripe), et les métadonnées techniques nécessaires au bon fonctionnement du service.</p>

      <h2 className="mt-6 text-xl font-semibold text-slate-900">Utilisation biométrique</h2>
      <p className="text-slate-600">Les photos importées peuvent contenir des données biométriques (visage). Ces données ne sont utilisées <strong>que pour la génération</strong> de la vidéo demandée et sont supprimées automatiquement sous 24h.</p>

      <h2 className="mt-6 text-xl font-semibold text-slate-900">Stockage</h2>
      <p className="text-slate-600">Les fichiers sont stockés chiffrés sur des serveurs sécurisés. Aucun tiers n'y a accès. Suppression automatique après 24h.</p>

      <h2 className="mt-6 text-xl font-semibold text-slate-900">Vos droits (RGPD)</h2>
      <p className="text-slate-600">Vous pouvez à tout moment demander la suppression anticipée de vos fichiers via la page contact.</p>

      <h2 className="mt-6 text-xl font-semibold text-slate-900">Cookies</h2>
      <p className="text-slate-600">Nous utilisons uniquement des cookies strictement nécessaires au fonctionnement (session, paiement).</p>
    </div>
  );
}
