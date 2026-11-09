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

## Données de base

- `src/data/exercises.json` : catalogue d'exercices (`kind` : `heavy`, `isolation`, `timed`, `bodyweight` ; `step` : pas de charge ; `startWeight` : charge de départ).
- `src/data/templates.json` : séances A, B et C du programme (`day` : 1 = lundi … 7 = dimanche ; un bloc avec plusieurs exercices est un superset).

## Développement

```bash
npm install
npm run dev      # serveur local
npm test         # tests de la logique de progression
npm run build    # build dans dist/
```

Chaque push sur `main` lance les tests, le build et le déploiement sur GitHub Pages.
