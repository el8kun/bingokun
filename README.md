# Kun Foot Bingo — MVP 5x5

Première version testable d’un bingo foot multijoueur.

## Ce qui est déjà inclus

- Grille 5x5 commune à toute la room
- Création d’une room avec code
- Rejoindre une room avec pseudo
- Même joueur actuel pour tout le monde
- Placement d’un joueur dans une case
- Validation automatique selon les tags du joueur
- Score personnel
- Détection des lignes/colonnes/diagonales
- Classement live
- Bouton "Joueur suivant" réservé au créateur de la room côté interface

## Installation Firebase

### 1. Crée un projet Firebase

Va sur Firebase Console, crée un projet, puis ajoute une application Web.

### 2. Active l’authentification anonyme

Dans Firebase Console :

Authentication > Sign-in method > Anonymous > Enable

### 3. Active Firestore

Firestore Database > Create database

Tu peux choisir le mode test au début, mais je conseille ensuite de coller les règles du fichier `firestore.rules`.

### 4. Ajoute ta config Firebase

Dans ce dossier :

1. Duplique `firebase-config.sample.js`
2. Renomme la copie en `firebase-config.js`
3. Remplace les valeurs par la config de ton projet Firebase

Exemple :

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

### 5. Publie sur GitHub Pages

Envoie les fichiers sur ton repo GitHub, puis :

Settings > Pages > Deploy from branch > main > /root

Le site sera accessible avec une URL GitHub Pages.

## Fichiers

- `index.html` : structure du site
- `style.css` : design
- `app.js` : logique Firebase + jeu
- `data.js` : joueurs + catégories
- `firebase-config.sample.js` : modèle de config Firebase
- `firestore.rules` : règles de sécurité simples pour tester

## Important

Cette version est un prototype. La validation des réponses est faite côté navigateur avec les tags de `data.js`. Pour une vraie version publique solide, il faudra ensuite :

- verrouiller davantage les règles Firestore,
- empêcher un viewer de modifier le joueur courant via les règles,
- créer un vrai panel streamer/admin,
- ajouter un import CSV pour tes propres joueurs,
- ajouter une meilleure base de données joueurs/catégories.
