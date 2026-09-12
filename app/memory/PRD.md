# MorphCut - Face Swap Video SaaS

## Problem Statement
Site web moderne pour créer une vidéo face-swap : l'utilisateur importe une vidéo + une photo, obtient un aperçu gratuit, puis paie 4,99 € via Stripe pour télécharger la vidéo HD complète. Design premium, fond clair, responsive, admin dashboard.

## Architecture
- **Frontend**: React 19 + React Router 7 + Tailwind + shadcn/ui + Sonner + Recharts. Fonts: Outfit / IBM Plex Sans / JetBrains Mono.
- **Backend**: FastAPI + Motor (MongoDB async) + Stripe SDK + Emergent Object Storage. All routes prefixed `/api`.
- **Storage**: Emergent Object Storage (private, backend-proxied). Auto-cleanup after 24h via janitor loop.
- **Payments**: Stripe Checkout (claimable sandbox), server-side webhook `/api/stripe/webhook` + polling `/api/payments/status/{sid}` fallback. Idempotent update guarded by `payment_status != "paid"`.
- **Face Swap**: `face_swap_provider.py` abstraction. Currently `MockFaceSwapProvider` (returns original video). Ready to plug real HTTP-based provider via env `FACE_SWAP_PROVIDER`, `FACE_SWAP_API_KEY`, `FACE_SWAP_ENDPOINT`.
- **Admin auth**: Emergent-managed Google Auth. Session token stored in Mongo (`admin_sessions`) with 7d TTL. Optional `ADMIN_EMAILS` allowlist.

## Personas
- **Créateur casual**: veut essayer un swap sur une courte vidéo pour rire / réseaux sociaux.
- **Créateur pro**: attend un rendu HD propre pour usage éditorial.
- **Admin**: propriétaire du site qui suit CA, générations, échecs.

## Core Requirements (static)
- Upload vidéo (MP4/MOV/WebM ≤ 100 Mo) + photo (JPG/PNG/WebP).
- Génération avec barre de progression et étapes lisibles.
- Aperçu gratuit avec filigrane + basse résolution.
- Paiement Stripe 4,99 € TTC unique, sans abonnement.
- Vérification serveur du paiement avant download.
- Suppression auto sous 24h. Liens temporaires.
- Pages légales : CGU, Confidentialité, Contact.
- Dashboard admin protégé.

## Implemented (2026-02)
- Landing (Hero, 3 étapes, Features, Pricing, FAQ)
- Page /create avec dropzones + previews + consent + progress
- Page /preview/:id avec player watermarké + panneau paywall
- Page /confirmation/:id avec polling paiement + download HD + copie lien
- Page /cancel
- Pages /terms /privacy /contact
- Admin: /admin/login (Google) + /admin dashboard (stats, chart Recharts, transactions, jobs)
- Backend: 15+ endpoints, storage, **fal.ai Pixverse Swap** face-swap réel via Emergent Universal Key, Stripe sandbox provisionné, webhook + polling
- Janitor loop supprime les jobs expirés (soft-delete)
- Endpoint temporaire signé `/api/temp/{token}` pour exposer fichiers privés à fal.ai (TTL 1h)
- Tests: 100% passing (backend + frontend loading + fal.ai e2e vérifié)

## Face Swap Provider (RÉEL)
- **Magic Hour AI** (`api.magichour.ai/v1/face-swap`, style `default`, mode `all-faces`) via clé user `MAGIC_HOUR_API_KEY`. Facturé sur le compte Magic Hour, **aucun crédit Emergent consommé**.
- Providers alternatifs restent branchables : `fal-pixverse`, `fal-wan`, `mock`. Switch via `FACE_SWAP_PROVIDER` dans backend/.env.
- Fallback automatique vers `mock` en cas d'échec provider (402 solde / 401 clé invalide / erreur réseau). L'UI affiche la raison exacte à l'utilisateur.

## Backlog (P0/P1/P2)
- P1: Brancher un vrai fournisseur de face-swap (fal.ai ou Reface). Le code est prêt (GenericHTTPProvider).
- P1: Email de confirmation post-paiement avec le lien de téléchargement.
- P2: Sample gallery de vidéos/visages pour tester sans upload.
- P2: Analytics dans admin (device, source, taux d'abandon).
- P2: Rendus multiples résolutions (720p/1080p/4K) avec tarification différenciée.
