// Télécharge les visuels de catégories PlayFootball vers Bingo Kun.
// Usage :
// 1) Mets ce fichier à la racine de ton projet Bingo Kun, au même niveau que data.js
// 2) Ouvre un terminal dans ce dossier
// 3) Lance : node download-category-icons.js
//
// Les images seront placées dans : assets/icons/imported/<ID>.webp

import fs from "fs/promises";
import path from "path";

const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 33, 34, 35, 36, 37, 38, 39, 41, 52, 55, 57, 58, 83, 84, 85, 86, 92, 93, 99, 109, 112, 113, 114, 117, 120, 123, 129, 133, 135, 141, 147, 148, 149, 151, 153, 155, 159, 160, 167, 172, 176, 177, 179, 183, 186, 191, 204, 207, 215, 217, 219, 262, 300, 301, 302, 303, 304, 305, 306, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 354, 355, 356, 357, 358, 400, 402, 403, 425, 426, 427, 546, 547, 548, 549, 550, 552, 553, 554, 555, 556, 558, 560, 562, 563, 564, 565, 566, 567, 568, 569, 598, 599, 600, 601, 602, 603, 604, 606, 607, 608, 609, 610, 611, 612, 613, 614, 620];

const BASE_URL = "https://playfootball.games/media/categories";
const OUT_DIR = path.join("assets", "icons", "imported");

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadOne(id) {
  const url = `${BASE_URL}/${id}.webp`;
  const out = path.join(OUT_DIR, `${id}.webp`);

  if (await exists(out)) {
    console.log(`déjà présent : ${id}.webp`);
    return { id, ok: true, skipped: true };
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.log(`introuvable : ${id}.webp (${response.status})`);
      return { id, ok: false, status: response.status };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(out, buffer);
    console.log(`OK : ${id}.webp`);
    return { id, ok: true };
  } catch (error) {
    console.log(`erreur : ${id}.webp`, error.message);
    return { id, ok: false, error: error.message };
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const results = [];
  for (const id of IDS) {
    results.push(await downloadOne(id));
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  const ok = results.filter((item) => item.ok).length;
  const fail = results.length - ok;

  await fs.writeFile(
    path.join(OUT_DIR, "_download-report.json"),
    JSON.stringify({ total: results.length, ok, fail, results }, null, 2)
  );

  console.log(`\nTerminé : ${ok}/${results.length} images récupérées.`);
  console.log(`Rapport : ${path.join(OUT_DIR, "_download-report.json")}`);
}

main();
