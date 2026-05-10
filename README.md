# Outils logos PlayFootball → Bingo Kun

Le HAR que tu as envoyé confirme le modèle d'URL :

`https://playfootball.games/media/categories/ID.webp`

Images vues dans ton HAR : 8, 11, 15, 24, 27, 41, 84, 99, 172, 219, 306, 316, 333, 336, 427, 598

J'ai aussi préparé une liste de 169 IDs détectés dans ton `data.js`.

## Étapes

1. Copie `download-category-icons.js` à la racine de ton projet Bingo Kun.
2. Lance :

```bash
node download-category-icons.js
```

3. Les images seront téléchargées ici :

```txt
assets/icons/imported/
```

4. Ensuite, tu peux lancer :

```bash
node patch-data-icons.js
```

pour faire pointer `data.js` vers :

```txt
./assets/icons/imported/ID.webp
```

Un backup sera créé :

```txt
data.js.backup-before-icons
```

## Conseil

Teste d'abord avec `download-category-icons.js` seul.  
Si les images se téléchargent bien, lance ensuite `patch-data-icons.js`.
