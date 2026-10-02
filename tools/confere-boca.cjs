// para cada pose: rosto original | boca fechada | boca 60% aberta (como no app), para conferir o remendo
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const DIR = process.argv[2] || path.join(__dirname, "../alia-src/final");
const OUT = process.argv[3] || path.join(__dirname, "../alia-src/confere-boca.png");
const meta = JSON.parse(fs.readFileSync(path.join(DIR, "poses.json"), "utf8"));
(async () => {
  const T = 260, comp = []; let row = 0;
  for (const [nome, m] of Object.entries(meta)) {
    if (!m.boca) continue;
    const { cx, cy, r } = m.cab, b = m.boca;
    const R = Math.round(r * 1.15);
    const left = Math.max(0, cx - R), top = Math.max(0, cy - R), width = Math.min(m.w - left, 2 * R), height = Math.min(m.h - top, 2 * R);
    const fundo = () => sharp({ create: { width: m.w, height: m.h, channels: 4, background: "#fff" } });
    const orig = await fundo().composite([{ input: path.join(DIR, nome + ".png") }]).png().toBuffer();
    const fech = await fundo().composite([{ input: path.join(DIR, nome + "-fechada.png") }]).png().toBuffer();
    const k = 0.62 + 0.38 * 0.4, bh = Math.round(b.h * k);
    const boca = await sharp(path.join(DIR, nome + "-boca.png")).resize(b.w, bh, { fit: "fill" }).png().toBuffer();
    const meio = await sharp(fech).composite([{ input: boca, left: b.x, top: b.y + Math.round(b.labio * (1 - k)) }]).png().toBuffer();
    let col = 0;
    for (const img of [orig, fech, meio]) {
      const t = await sharp(img).extract({ left, top, width, height }).resize(T, T, { fit: "contain", background: "#fff" }).png().toBuffer();
      comp.push({ input: t, left: col * T, top: row * T }); col++;
    }
    comp.push({ input: Buffer.from(`<svg width="200" height="30"><text x="4" y="24" font-size="22" font-family="Arial" fill="#c00">${nome}</text></svg>`), left: 0, top: row * T });
    row++;
  }
  // duas colunas de trincas
  const meiaAltura = Math.ceil(row / 2);
  const final = comp.map((c) => { const r = Math.floor(c.top / T); return { ...c, left: c.left + (r >= meiaAltura ? 3 * T + 20 : 0), top: (r % meiaAltura) * T + (c.top % T) } });
  await sharp({ create: { width: 6 * T + 20, height: meiaAltura * T, channels: 4, background: "#eee" } }).composite(final).png().toFile(OUT);
})();
