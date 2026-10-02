// acha o globo (cabeça) de cada pose: maior mancha de azul vivo na parte de cima,
// com os continentes brancos preenchidos por linha. Grava cx, cy, r em poses.json.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const DIR = process.argv[2] || path.join(__dirname, "../alia-src/final");
const meta = JSON.parse(fs.readFileSync(path.join(DIR, "poses.json"), "utf8"));
(async () => {
  for (const [nome, m] of Object.entries(meta)) {
    const { data, info } = await sharp(path.join(DIR, nome + ".png")).raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    const azul = new Uint8Array(W * H);
    const lim = nome === "deitada" ? H : Math.round(H * 0.6);
    for (let y = 0; y < lim; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
      if (data[i + 3] > 200 && b > 150 && b > r + 70 && g < b - 30) azul[y * W + x] = 1;
    }
    // maior componente
    const lab = new Int32Array(W * H).fill(-1), pilha = new Int32Array(W * H); let melhor = -1, mA = 0, id = 0;
    for (let s = 0; s < W * H; s++) {
      if (!azul[s] || lab[s] >= 0) continue;
      let a = 0, sp = 1; pilha[0] = s; lab[s] = id;
      while (sp) { const i = pilha[--sp], x = i % W; a++; for (const v of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (v >= 0 && v < W * H && azul[v] && lab[v] < 0) { lab[v] = id; pilha[sp++] = v } }
      if (a > mA) { mA = a; melhor = id } id++;
    }
    // preenche por linha (continentes/olhos) e mede a largura de cada linha
    let y0 = H, y1 = 0; const larg = new Map(), meio = new Map();
    for (let y = 0; y < H; y++) { let a = -1, b = -1; for (let x = 0; x < W; x++) if (lab[y * W + x] === melhor) { if (a < 0) a = x; b = x } if (a >= 0) { larg.set(y, b - a); meio.set(y, (a + b) / 2); if (y < y0) y0 = y; if (y > y1) y1 = y } }
    // o globo é a faixa mais larga contínua: diâmetro = largura máxima entre 20% e 70% da altura da mancha
    let dMax = 0, yMax = y0;
    for (let y = Math.round(y0 + (y1 - y0) * 0.2); y <= y0 + (y1 - y0) * 0.7; y++) if ((larg.get(y) || 0) > dMax) { dMax = larg.get(y); yMax = y }
    // linhas de largura parecida em volta → centro vertical
    let ys = [], xs = [];
    for (const [y, l] of larg) if (l > dMax * 0.93) { ys.push(y); xs.push(meio.get(y)) }
    const cy = ys.reduce((s, v) => s + v, 0) / ys.length, cx = xs.reduce((s, v) => s + v, 0) / xs.length;
    m.cab = { cx: Math.round(cx), cy: Math.round(cy), r: Math.round(dMax / 2) };
    console.log(nome, m.cab);
  }
  fs.writeFileSync(path.join(DIR, "poses.json"), JSON.stringify(meta, null, 1));
})();
