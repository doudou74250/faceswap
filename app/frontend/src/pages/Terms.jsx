export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 prose prose-slate">
      <h1 className="text-3xl font-bold text-slate-900">Conditions générales d'utilisation</h1>
      <p className="text-slate-600 mt-2 text-sm">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

      <h2 className="mt-8 text-xl font-semibold text-slate-900">1. Service</h2>
      <p className="text-slate-600">MorphCut propose la génération de vidéos face swap par IA. Chaque vidéo HD téléchargée est facturée 4,99 € TTC en paiement unique, sans abonnement.</p>

      <h2 className="mt-6 text-xl font-semibold text-slate-900">2. Utilisation autorisée</h2>
      <p className="text-slate-600">En utilisant MorphCut, vous certifiez détenir les droits sur les fichiers importés (vidéos et photos) et disposer du consentement explicite de toute personne visible.</p>

      <h2 className="mt-6 text-xl font-semibold text-slate-900">3. Contenu interdit</h2>
      <p className="text-slate-600">Sont formellement interdits : contenu illégal, frauduleux, trompeur, à caractère sexuel non consenti, atteinte à l'image, harcèlement, désinformation, imitation d'identité (deepfake malveillant), et toute utilisation visant à nuire à autrui.</p>

      <h2 className="mt-6 text-xl font-semibold text-slate-900">4. Suppression des fichiers</h2>
      <p className="text-slate-600">Tous les fichiers (originaux et générés) sont automatiquement supprimés 24 heures après leur création.</p>

      <h2 className="mt-6 text-xl font-semibold text-slate-900">5. Paiement</h2>
      <p className="text-slate-600">Les paiements sont traités par Stripe. Le prix est fixe : 4,99 € TTC par vidéo HD. Aucun remboursement automatique une fois la vidéo téléchargée.</p>

      <h2 className="mt-6 text-xl font-semibold text-slate-900">6. Responsabilité</h2>
      <p className="text-slate-600">MorphCut ne pourra être tenu responsable de l'usage détourné du service par l'utilisateur.</p>
    </div>
  );
}
