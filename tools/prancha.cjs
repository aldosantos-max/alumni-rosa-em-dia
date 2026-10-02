// prancha de conferência: todas as poses de uma pasta lado a lado sobre fundo rosa
// uso: node tools/prancha.cjs <pasta> <saida.png> [sufixo]
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const [dir, out, suf = ""] = process.argv.slice(2);
(async () => {
  const arqs = fs.readdirSync(dir).filter(f => f.endsWith(suf + ".png") && (suf || !/-(boca|fechada)\.png$/.test(f))).sort();
  const H = 420, itens = [];
  for (const f of arqs) {
    const b = await sharp(path.join(dir, f)).resize({ height: H }).png().toBuffer();
    const m = await sharp(b).metadata();
    itens.push({ b, w: m.width, f });
  }
  const W = itens.reduce((s, i) => s + i.w + 20, 20);
  const comp = []; let x = 20;
  for (const i of itens) {
    comp.push({ input: i.b, left: x, top: 20 });
    comp.push({ input: Buffer.from(`<svg width="${i.w}" height="30"><text x="0" y="22" font-family="Arial" font-size="20" fill="#0E1F4D">${i.f}</text></svg>`), left: x, top: H + 26 });
    x += i.w + 20;
  }
  await sharp({ create: { width: W, height: H + 64, channels: 4, background: "#FCD2E4" } }).composite(comp).png().toFile(out);
  console.log(out, W);
})();
