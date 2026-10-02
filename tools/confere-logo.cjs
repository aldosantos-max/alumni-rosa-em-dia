// recorte do peito de cada pose (onde fica o logo), lado a lado, para conferir a troca do logo
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const DIR = process.argv[2] || path.join(__dirname, "../alia-src/final");
const OUT = process.argv[3] || path.join(__dirname, "../alia-src/confere-logo.png");
const meta = JSON.parse(fs.readFileSync(path.join(DIR, "poses.json"), "utf8"));
(async () => {
  const comp = []; let x = 0; const T = 380;
  for (const [nome, m] of Object.entries(meta)) {
    const { cx, cy, r } = m.cab;
    const left = Math.max(0, Math.round(cx - 1.4 * r)), top = Math.max(0, Math.round(cy + 0.7 * r));
    const width = Math.min(m.w - left, Math.round(2.8 * r)), height = Math.min(m.h - top, Math.round(1.6 * r));
    const img = await sharp({ create: { width: m.w, height: m.h, channels: 4, background: "#fff" } }).composite([{ input: path.join(DIR, nome + ".png") }]).png().toBuffer();
    const b = await sharp(img).extract({ left, top, width, height }).resize(T, Math.round(T * 0.6), { fit: "contain", background: "#fff" }).png().toBuffer();
    comp.push({ input: b, left: x, top: 0 });
    comp.push({ input: Buffer.from(`<svg width="${T}" height="30"><text x="4" y="24" font-size="22" font-family="Arial" fill="#c00">${nome}</text></svg>`), left: x, top: Math.round(T * 0.6) });
    x += T + 8;
  }
  await sharp({ create: { width: x, height: Math.round(T * 0.6) + 32, channels: 4, background: "#eee" } }).composite(comp).png().toFile(OUT);
})();
