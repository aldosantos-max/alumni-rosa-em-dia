// para cada pose: acha a boca aberta (só dentro da cabeça), gera
//  <pose>-fechada.png  → rosto sem a metade de baixo da boca (preenchido com o azul do rosto)
//  <pose>-boca.png     → a boca aberta original, com borda suave
// A fala escala a boca entre ~50% e 100% da altura, a partir do lábio de cima: nunca some o sorriso.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const DIR = process.argv[2] || path.join(__dirname, "../alia-src/final");
const meta = JSON.parse(fs.readFileSync(path.join(DIR, "poses.json"), "utf8"));

(async () => {
  const bocas = {};
  for (const [nome, m] of Object.entries(meta)) {
    const { data, info } = await sharp(path.join(DIR, nome + ".png")).raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    const P = (x, y) => (y * W + x) * 4;
    const lum = (i) => 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
    // a boca parte da LÍNGUA (toda pose tem): maior mancha vermelha na metade de baixo da cabeça
    const { cx: hx, cy: hy, r: hr } = m.cab;
    // área da língua em raios do globo; aponta tem a boca mais baixa e de lado
    const [lr, lx] = nome === "aponta" ? [1.05, 0.7] : [0.92, 0.6];
    const vermelho = (i) => data[i + 3] > 200 && data[i] > 140 && data[i + 1] < 90 && data[i + 2] < 110;
    const escuro = (i) => data[i + 3] > 200 && lum(i) < 42;
    const lab = new Int32Array(W * H).fill(-1);
    let lingua = null;
    for (let y = Math.round(hy - 0.1 * hr); y < Math.min(H, hy + 1.05 * hr); y++) for (let x = Math.max(0, Math.round(hx - 0.8 * hr)); x < Math.min(W, hx + 0.8 * hr); x++) {
      const s = y * W + x;
      if ((x - hx) ** 2 + (y - hy) ** 2 > (lr * hr) ** 2 || y < hy || Math.abs(x - hx) > lx * hr) continue; // só dentro do globo (a alça da mochila também é vermelha)
      if (lab[s] >= 0 || !vermelho(s * 4)) continue;
      const pilha = [s]; lab[s] = 1; const pts = [];
      while (pilha.length) {
        const i = pilha.pop(), xx = i % W, yy = (i / W) | 0; pts.push(i);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = xx + dx, ny = yy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const v = ny * W + nx; if (lab[v] < 0 && vermelho(v * 4)) { lab[v] = 1; pilha.push(v); }
        }
      }
      if (!lingua || pts.length > lingua.length) lingua = pts;
    }
    if (!lingua) { console.log("sem língua:", nome); continue; }
    let tx0 = W, ty0 = H, tx1 = 0, ty1 = 0;
    for (const i of lingua) { const x = i % W, y = (i / W) | 0; if (x < tx0) tx0 = x; if (x > tx1) tx1 = x; if (y < ty0) ty0 = y; if (y > ty1) ty1 = y; }
    const tcx = (tx0 + tx1) / 2;
    // cresce a partir da língua por escuro/vermelho, só numa caixa em volta dela (não desce pro pescoço)
    const X0 = tcx - 0.75 * hr, X1 = tcx + 0.75 * hr, Y0 = ty0 - 0.36 * hr, Y1 = ty1 + 0.03 * hr; // a gola encosta no queixo em algumas poses
    const dentro = (x, y) => x >= X0 && x <= X1 && y >= Y0 && y <= Y1;
    const visto = new Uint8Array(W * H);
    const melhor = [];
    const pilha = [...lingua]; for (const i of lingua) visto[i] = 1;
    while (pilha.length) {
      const i = pilha.pop(), xx = i % W, yy = (i / W) | 0; melhor.push(i);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = xx + dx, ny = yy + dy; if (!dentro(nx, ny)) continue;
        const v = ny * W + nx; if (!visto[v] && (escuro(v * 4) || vermelho(v * 4))) { visto[v] = 1; pilha.push(v); }
      }
    }
    if (!melhor || melhor.length < 800) { console.log("sem boca:", nome); continue; }
    const set = new Uint8Array(W * H); for (const i of melhor) set[i] = 1;
    let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
    for (const i of melhor) { const x = i % W, y = (i / W) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    // fecha buracos (dentes)
    for (let y = by0; y <= by1; y++) { let a = -1, b = -1; for (let x = bx0; x <= bx1; x++) if (set[y * W + x]) { if (a < 0) a = x; b = x; } if (a >= 0) for (let x = a; x <= b; x++) set[y * W + x] = 1; }
    for (let x = bx0; x <= bx1; x++) { let a = -1, b = -1; for (let y = by0; y <= by1; y++) if (set[y * W + x]) { if (a < 0) a = y; b = y; } if (a >= 0) for (let y = a; y <= b; y++) set[y * W + x] = 1; }
    // máscara dilatada (dentes, lábios e a sombra escura do contorno)
    const R = 16, dil = new Uint8Array(W * H);
    for (let y = Math.max(0, by0 - R); y <= Math.min(H - 1, by1 + R); y++) for (let x = Math.max(0, bx0 - R); x <= Math.min(W - 1, bx1 + R); x++) {
      let hit = false;
      for (let dy = -R; dy <= R && !hit; dy += 2) for (let dx = -R; dx <= R; dx += 2) { if (dx * dx + dy * dy > R * R) continue; const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && set[yy * W + xx]) { hit = true; break; } }
      if (hit) dil[y * W + x] = 1;
    }
    const cx0 = Math.max(0, bx0 - R - 8), cy0 = Math.max(0, by0 - R - 8), cx1 = Math.min(W - 1, bx1 + R + 8), cy1 = Math.min(H - 1, by1 + R + 8);
    const cw = cx1 - cx0 + 1, ch = cy1 - cy0 + 1;

    // sprite da boca aberta
    const sprite = Buffer.alloc(cw * ch * 4), alfa = Buffer.alloc(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = P(x + cx0, y + cy0), o = (y * cw + x) * 4;
      sprite[o] = data[i]; sprite[o + 1] = data[i + 1]; sprite[o + 2] = data[i + 2]; sprite[o + 3] = 255;
      alfa[y * cw + x] = dil[(y + cy0) * W + x + cx0] ? 255 : 0;
    }
    // borda suave: 3 passadas de média 5x5 só no alfa
    let A = Float32Array.from(alfa);
    for (let it = 0; it < 1; it++) {
      const B = new Float32Array(cw * ch);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        let s = 0, n = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= cw || yy >= ch) continue; s += A[yy * cw + xx]; n++; }
        B[y * cw + x] = s / n;
      }
      A = B;
    }
    for (let k = 0; k < cw * ch; k++) sprite[k * 4 + 3] = Math.round(A[k]);
    await sharp(sprite, { raw: { width: cw, height: ch, channels: 4 } }).png().toFile(path.join(DIR, `${nome}-boca.png`));

    // rosto sem a boca: cada pixel = média ponderada do azul limpo mais próximo nas 4 direções
    const out = Buffer.from(data);
    const limpo = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return false; const i = y * W + x; if (dil[i]) return false; const j = i * 4; return data[j + 3] > 220 && lum(j) > 30 && data[j + 2] > 110 && data[j + 2] > data[j] + 50; }; // o globo da Alia é mais escuro na base
    const busca = (x, y, dx, dy) => { let d = 0, xx = x, yy = y; while (d < 400) { xx += dx; yy += dy; d++; if (limpo(xx, yy)) return { d, i: P(xx, yy) }; if (xx < 0 || yy < 0 || xx >= W || yy >= H) return null; } return null; };
    for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) {
      const i = y * W + x; if (!dil[i]) continue;
      let r = 0, g = 0, b = 0, ws = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const hit = busca(x, y, dx, dy); if (!hit) continue;
        const w = 1 / (hit.d * hit.d);
        r += data[hit.i] * w; g += data[hit.i + 1] * w; b += data[hit.i + 2] * w; ws += w;
      }
      if (ws) { out[i * 4] = r / ws; out[i * 4 + 1] = g / ws; out[i * 4 + 2] = b / ws; out[i * 4 + 3] = 255; }
    }
    // alisa por difusão (tira a trama das 8 direções) e devolve um grão fino igual ao do rosto
    const reg = [];
    for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) if (dil[y * W + x]) reg.push(y * W + x);
    // só entra na média vizinho que é rosto azul ou já está na região (a gola escura não puxa a cor)
    const vale = new Uint8Array(W * H);
    for (const i of reg) { vale[i] = 1; for (const v of [i - 1, i + 1, i - W, i + W]) if (!dil[v] && limpo(v % W, (v / W) | 0)) vale[v] = 1; }
    const viz = reg.map((i) => [i - 1, i + 1, i - W, i + W].filter((v) => vale[v]));
    // pixel sem nenhuma fonte limpa vira o azul médio das bordas limpas
    for (let it = 0; it < 500; it++) reg.forEach((i, k) => { const vs = viz[k]; if (!vs.length) return; for (let c = 0; c < 3; c++) { let s = 0; for (const v of vs) s += out[v * 4 + c]; out[i * 4 + c] = s / vs.length; } });
    let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const i of reg) { const k = (rnd() - 0.5) * 5; for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.max(0, Math.min(255, out[i * 4 + c] + k)); }
    await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(DIR, `${nome}-fechada.png`));
    bocas[nome] = { x: cx0, y: cy0, w: cw, h: ch, labio: by0 - cy0 };
    m.boca = bocas[nome]; m.bocaBox = [cx0, cy0, cx0 + cw, cy0 + ch];
    console.log(nome, bocas[nome]);
  }
  fs.writeFileSync(path.join(DIR, "bocas.json"), JSON.stringify(bocas, null, 1));
  fs.writeFileSync(path.join(DIR, "poses.json"), JSON.stringify(meta, null, 1));
})();
