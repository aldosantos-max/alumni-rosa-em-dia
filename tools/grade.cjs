// mostra o topo de cada pose com grade de 100px, para medir cabeça/boca/logo à mão
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "../alia-src/final");
const [out, alturaStr = "900"] = process.argv.slice(2);
const ALT = +alturaStr;
(async () => {
  const meta = JSON.parse(fs.readFileSync(path.join(DIR, "poses.json"), "utf8"));
  const comp = []; let x = 0; const ESC = 0.5;
  for (const [nome, m] of Object.entries(meta)) {
    const h = Math.min(ALT, m.h), w = m.w;
    const linhas = [];
    for (let gx = 0; gx <= w; gx += 100) linhas.push(`<line x1="${gx}" y1="0" x2="${gx}" y2="${h}" stroke="#0a0" stroke-width="2" opacity=".6"/><text x="${gx + 3}" y="24" font-size="22" fill="#0a0">${gx}</text>`);
    for (let gy = 0; gy <= h; gy += 100) linhas.push(`<line x1="0" y1="${gy}" x2="${w}" y2="${gy}" stroke="#0a0" stroke-width="2" opacity=".6"/><text x="3" y="${gy - 4}" font-size="22" fill="#0a0">${gy}</text>`);
    const svg = Buffer.from(`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="hidden" xmlns="http://www.w3.org/2000/svg">${linhas.join("")}<text x="${w / 2}" y="${h - 10}" font-size="40" fill="#c00">${nome}</text></svg>`);
    const base = await sharp({ create: { width: w, height: h, channels: 4, background: "#ffffff" } })
      .composite([{ input: await sharp(path.join(DIR, nome + ".png")).extract({ left: 0, top: 0, width: w, height: h }).toBuffer() }, { input: svg }]).png().toBuffer();
    const b = await sharp(base).resize(Math.round(w * ESC)).toBuffer();
    comp.push({ input: b, left: x, top: 0 }); x += Math.round(w * ESC) + 10; console.log(nome, (await sharp(b).metadata()).height);
  }
  await sharp({ create: { width: x, height: Math.round(ALT * ESC) + 4, channels: 4, background: "#ddd" } }).composite(comp).png().toFile(out);
})();
