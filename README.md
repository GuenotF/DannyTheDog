# Danny the DOG

Pousser ouai ouais pousser et suer oui monsieur.

Application web (PWA) de suivi de séances de musculation : https://guenotf.github.io/DannyTheDog/

Sur Android, ouvre le lien dans Chrome puis « Ajouter à l'écran d'accueil » pour l'installer. Elle fonctionne ensuite hors ligne.

## Fonctionnalités (V1)

- **Séance en cours sur une seule page** : charges et reps pré-remplies, validation d'une série d'un tap, charge modifiable à tout moment (avec option « appliquer aux séries suivantes »), supersets regroupés.
- **Minuteur de repos** fixé en bas de l'écran, lancé automatiquement à la validation d'une série (vibration et bip à la fin). L'écran reste allumé pendant la séance.
- **Progression automatique** à la fin de la séance, modifiable avant d'enregistrer :
  - exercices lourds (squat, développé couché, soulevé de terre, rowing) : toutes les séries faites avec au moins le minimum de reps → +pas ; 2e échec consécutif → −10 % arrondi au pas ;
  - isolation : double progression, +pas quand toutes les séries atteignent le haut de la fourchette ;
  - gainage / poids du corps : pas de charge, objectif indiqué.
- **Données** : tout est stocké dans le navigateur (localStorage). Export / import JSON complet (fusion ou remplacement) et partage d'un modèle de séance.

## Suivi (V2)

- **Barre d'onglets** : Accueil, Historique, Progrès, Corps (masquée pendant une séance).
- **Historique** : séances groupées par semaine, filtre par séance, détail dépliable (reps, charge, évolution), « Refaire cette séance », suppression.
- **Progrès** : courbe de la charge de travail par exercice (tap sur un point pour le détail), départ, record, tableau de toutes les charges.
- **Corps** : saisie du poids et du tour de taille (une mesure par jour), courbes et dernières mesures.

## Éditeur de séances (V3)

- **Mes séances** (lien « Gérer mes séances » sur l'accueil) : modifier, dupliquer, supprimer, créer.
- **Modifier une séance** : lettre, nom, jour prévu, séance optionnelle ; pour chaque exercice séries, reps min/max (ou durée), repos ; réordonner (↑ ↓), lier/dissocier les supersets, changer ou retirer un exercice.
- **Réglages d'exercice** (⚙) : type (lourd, isolation, temps, poids du corps), pas de charge, charge actuelle — valables dans toutes les séances.
- **Catalogue** : recherche, filtre par type, création d'un exercice.
- Rien n'est modifié avant « Enregistrer » ; une séance en cours n'est pas affectée.

## Données de base

- `src/data/exercises.json` : catalogue d'exercices (`kind` : `heavy`, `isolation`, `timed`, `bodyweight` ; `step` : pas de charge ; `startWeight` : charge de départ).
- `src/data/templates.json` : séances A, B et C du programme (`day` : 1 = lundi … 7 = dimanche ; un bloc avec plusieurs exercices est un superset).

## Développement

```bash
npm install
npm run dev      # serveur local
npm test         # tests unitaires (progression, statistiques, éditeur)
npm run test:e2e # tests d'interface sur un mobile simulé (Playwright)
npm run build    # build dans dist/
```

Pour les tests d'interface, installe une fois le navigateur : `npx playwright install chromium`.

Chaque push sur `main` lance les tests unitaires puis les tests d'interface ; le déploiement sur GitHub Pages n'a lieu que si tout passe. Les pull requests sont testées sans être déployées.

### Tests d'interface (`e2e/`)

- `session.spec.ts` : accueil, séance en cours (charges, reps, minuteur, supersets, rechargement, annulation), fin de séance et règles de progression.
- `tracking.spec.ts` : historique (filtre, détail, suppression), progrès (courbe, infobulle), corps (mesures).
- `editor.spec.ts` : éditeur de séances et catalogue d'exercices.
- `data.spec.ts` : export / import, partage de modèle, fichiers invalides, effacement, compatibilité V1.

Chaque test démarre avec un navigateur vierge et échoue si l'appli lève une erreur JavaScript.
