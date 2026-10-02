// grade 3×3 com o círculo da cabeça (verde) e as caixas de boca (vermelho) e logo (amarelo), se houver
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const DIR = process.argv[2] || path.join(__dirname, "../alia-src/final");
const OUT = process.argv[3] || path.join(__dirname, "../alia-src/confere.png");
const meta = JSON.parse(fs.readFileSync(path.join(DIR, "poses.json"), "utf8"));
(async () => {
  const T = 420, comp = []; let k = 0;
  for (const [nome, m] of Object.entries(meta)) {
    const c = m.cab, extra = [];
    if (m.bocaBox) { const b = m.bocaBox; extra.push(`<rect x="${b[0]}" y="${b[1]}" width="${b[2] - b[0]}" height="${b[3] - b[1]}" fill="none" stroke="red" stroke-width="5"/>`) }
    if (m.logoBox) { const b = m.logoBox; extra.push(`<rect x="${b[0]}" y="${b[1]}" width="${b[2] - b[0]}" height="${b[3] - b[1]}" fill="none" stroke="#fc0" stroke-width="5"/>`) }
    const svg = Buffer.from(`<svg width="${m.w}" height="${m.h}" xmlns="http://www.w3.org/2000/svg"><circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="none" stroke="#0c0" stroke-width="5"/>${extra.join("")}<text x="10" y="${m.h - 20}" font-size="60" fill="#c00">${nome}</text></svg>`);
    const img = await sharp({ create: { width: m.w, height: m.h, channels: 4, background: "#fff" } }).composite([{ input: path.join(DIR, nome + ".png") }, { input: svg }]).png().toBuffer();
    const b = await sharp(img).resize(T, T, { fit: "contain", background: "#fff" }).png().toBuffer();
    comp.push({ input: b, left: (k % 3) * T, top: Math.floor(k / 3) * T }); k++;
  }
  await sharp({ create: { width: T * 3, height: T * Math.ceil(k / 3), channels: 4, background: "#eee" } }).composite(comp).png().toFile(OUT);
})();
