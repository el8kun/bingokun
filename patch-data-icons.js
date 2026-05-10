// Met à jour data.js pour pointer vers assets/icons/imported/<ID>.webp quand possible.
// À lancer après download-category-icons.js : node patch-data-icons.js
//
// Le script crée une sauvegarde : data.js.backup-before-icons

import fs from "fs/promises";
import path from "path";

const dataPath = "data.js";
const outDir = path.join("assets", "icons", "imported");

function mainSourceIdFromBlock(block) {
  const sourceMatch = block.match(/"sourceIds":\s*\[\s*(\d+)/);
  if (sourceMatch) return sourceMatch[1];

  const idMatch = block.match(/"id":\s*"cat_(\d+)"/);
  if (idMatch) return idMatch[1];

  return null;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let data = await fs.readFile(dataPath, "utf8");
  await fs.writeFile("data.js.backup-before-icons", data);

  // Découpe approximativement chaque objet catégorie et remplace les chemins image si l'ID existe.
  data = data.replace(/\{\n    "id": "cat_\d+"[\s\S]*?\n  \}/g, (block) => {
    const id = mainSourceIdFromBlock(block);
    if (!id) return block;

    const imgPath = `./assets/icons/imported/${id}.webp`;
    const localFile = path.join(outDir, `${id}.webp`);

    // On met le chemin même si le fichier manque : le navigateur affichera le fallback si ton code en a un.
    let updated = block.replace(/"image": "\.\/assets\/icons\/[^"]+"/g, `"image": "${imgPath}"`);

    updated = updated.replace(
      /"visuals": \[\n      \{\n        "visualType": "([^"]+)",\n        "image": "\.\/assets\/icons\/[^"]+",\n        "shortLabel": "([^"]+)"\n      \}\n    \]/g,
      `"visuals": [\n      {\n        "visualType": "$1",\n        "image": "${imgPath}",\n        "shortLabel": "$2"\n      }\n    ]`
    );

    return updated;
  });

  await fs.writeFile(dataPath, data);
  console.log("data.js mis à jour.");
  console.log("Sauvegarde créée : data.js.backup-before-icons");
}

main();
