// recorte por IA (@imgly) das poses da Alia a partir das imagens 4x
// uso: NODE_PATH=<video-studio/.tmp/bg/node_modules>;<alumni-leveling/node_modules> node tools/recorta-alia.cjs [nomes]
const sharp = require("sharp");
const { removeBackground } = require("@imgly/background-removal-node");
const fs = require("fs");
const path = require("path");
const SRC = path.join(__dirname, "../alia-src");
const OUT = path.join(SRC, "cortes");
fs.mkdirSync(OUT, { recursive: true });

// bbox em px da folha ORIGINAL (1536×1024); hero = imagem inteira
const POSES = {
  aceno:        ["folha", 397, 34, 582, 377],   // FRENTE: andando e acenando
  aponta:       ["folha", 599, 34, 786, 377],   // LADO: andando e apontando
  anda:         ["folha", 1014, 34, 1156, 375], // TRÊS QUARTOS: andando
  vibra:        ["folha", 515, 739, 666, 976],  // COMEMORANDO
  ideia:        ["folha", 670, 772, 831, 977],  // IDEIA: sentada nos livros
  corre:        ["folha", 836, 748, 988, 975],  // EM MOVIMENTO
  abre:         ["folha", 999, 747, 1134, 978], // APRESENTANDO
  deitada:      ["folha", 252, 792, 508, 968],  // DESCONTRAÍDA
  chama:        ["hero"],                       // apontando para você, com os livros
};

(async () => {
  const so = process.argv.slice(2);
  for (const [nome, [img, x0, y0, x1, y1]] of Object.entries(POSES)) {
    if (so.length && !so.includes(nome)) continue;
    const arq = path.join(SRC, `${img}_4x.png`);
    let png;
    if (x0 === undefined) png = await sharp(arq).png().toBuffer();
    else {
      const m = await sharp(arq).metadata(), pad = 10;
      const left = Math.max(0, (x0 - pad) * 4), top = Math.max(0, (y0 - pad) * 4);
      const width = Math.min(m.width - left, (x1 - x0 + 1 + pad * 2) * 4), height = Math.min(m.height - top, (y1 - y0 + 1 + pad * 2) * 4);
      png = await sharp(arq).extract({ left, top, width, height }).png().toBuffer();
    }
    const blob = await removeBackground(new Blob([png], { type: "image/png" }), { model: "medium", output: { format: "image/png", quality: 1 } });
    const buf = Buffer.from(await blob.arrayBuffer());
    await sharp(buf).trim({ threshold: 1 }).png().toFile(path.join(OUT, nome + ".png"));
    console.log("ok", nome);
  }
})().catch((e) => { console.error(e); process.exit(1); });
