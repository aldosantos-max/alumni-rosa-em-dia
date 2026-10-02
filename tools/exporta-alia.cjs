// exporta as poses finais (1400px de altura de corpo) para o app: webp a 40% + tabela POSES do index.html
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "../alia-src/final");
const OUT = path.join(__dirname, "../img/alia");
fs.mkdirSync(OUT, { recursive: true });
const K = 0.4;
const meta = JSON.parse(fs.readFileSync(path.join(DIR, "poses.json"), "utf8"));
(async () => {
  const tab = {};
  for (const [nome, m] of Object.entries(meta)) {
    const w = Math.round(m.w * K), h = Math.round(m.h * K);
    for (const suf of ["", "-fechada"]) await sharp(path.join(DIR, nome + suf + ".png")).resize(w, h, { kernel: "lanczos3" }).webp({ quality: 88, alphaQuality: 100 }).toFile(path.join(OUT, nome + suf + ".webp"));
    const b = m.boca;
    const bw = Math.round(b.w * K), bh = Math.round(b.h * K);
    await sharp(path.join(DIR, nome + "-boca.png")).resize(bw, bh, { kernel: "lanczos3" }).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, nome + "-boca.webp"));
    // w, h, base dos pés, boca x/y/w/h/lábio — em px da imagem exportada
    tab[nome] = [w, h, +(m.base * K).toFixed(1), +(b.x * K).toFixed(1), +(b.y * K).toFixed(1), bw, bh, +(b.labio * K).toFixed(1)];
  }
  fs.writeFileSync(path.join(OUT, "poses.json"), JSON.stringify(tab));
  console.log(JSON.stringify(tab));
})();
