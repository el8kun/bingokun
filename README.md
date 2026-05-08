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


## V2 ajoutée

Cette version ajoute :

- défilement automatique du joueur toutes les 15 secondes ;
- bouton "Passer maintenant" pour le créateur de la room ;
- verdict caché : le site ne dit plus si la réponse est juste ou fausse avant que la grille soit complète ;
- score final affiché seulement quand les 25 cases sont remplies ;
- badges/logos d'équipes et de sélections.

## Logos réels

Le dossier `logos` est optionnel. Si tu ajoutes des vrais fichiers PNG dedans, ils seront affichés automatiquement.

Exemples de noms attendus :

```text
logos/om.png
logos/psg.png
logos/lyon.png
logos/monaco.png
logos/barca.png
logos/real.png
logos/milan.png
logos/inter.png
logos/juve.png
logos/manutd.png
logos/arsenal.png
logos/chelsea.png
logos/liverpool.png
logos/bayern.png
logos/france.png
logos/brazil.png
logos/argentina.png
logos/spain.png
logos/italy.png
logos/germany.png
logos/netherlands.png
logos/portugal.png
```

Si un fichier n'existe pas, le site affiche un badge texte automatiquement.

## Important pour le défilement automatique

Pour ce prototype, le défilement automatique est lancé par l'onglet du créateur de la room. Donc pendant le live, il faut garder l'onglet de l'hôte ouvert.
