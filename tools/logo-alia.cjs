// troca o "alumni by BETTER" desenhado pelo ChatGPT no moletom pelo logo oficial (vetor branco),
// na mesma inclinação e largura do falso, com a sombra do tecido. Roda sobre final/<pose>.png.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const DIR = process.argv[2] || path.join(__dirname, "../alia-src/final");
// deitada: logo escondido; chama: arte em alta já vem com o logo certo;
// anda/corre: de lado, o logo dobra com o corpo e mal aparece no app (fica o da arte)
const PULA = ["deitada", "chama", "anda", "corre"];
// área de busca em raios da cabeça: [y0, y1, ±x]; aponta tem o logo mais baixo
const REGIAO = { aponta: [0.78, 2.3, 1.3] }, PADRAO = [0.95, 1.95, 0.95];
// logo oficial com letras brancas e a régua vermelha (igual ao do moletom na arte da Alia)
const SVG = fs.readFileSync(path.join(__dirname, "alumni-branco-vermelho.svg"));
const SVG_W = 3961, SVG_H = 1734;
const meta = JSON.parse(fs.readFileSync(path.join(DIR, "poses.json"), "utf8"));

(async () => {
  const larguras = {};
  const alvos = {};
  // 1ª passada: mede o logo falso de cada pose
  for (const [nome, m] of Object.entries(meta)) {
    if (PULA.includes(nome)) continue;
    const { data, info } = await sharp(path.join(DIR, nome + ".png")).raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    const { cx: hx, cy: hy, r: hr } = m.cab;
    const [ry0, ry1, rx] = REGIAO[nome] || PADRAO;
    const y0 = Math.round(hy + ry0 * hr), y1 = Math.min(H, Math.round(hy + ry1 * hr)), x0 = Math.max(0, Math.round(hx - rx * hr)), x1 = Math.min(W, Math.round(hx + rx * hr));
    const pts = [];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 220) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const l = 0.3 * r + 0.59 * g + 0.11 * b, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (l > 150 && mx - mn < 70) pts.push([x, y, 1]);
      else if (r > 140 && g < 90 && b < 110) pts.push([x, y, 2]);
      else if (l > 92) pts.push([x, y, 0]); // borda fraca das letras: entra na máscara, não na medida
    }
    if (pts.length < 200) { console.log("sem logo:", nome); continue; }
    // o logo é o maior bloco de letras: células de 8px com tinta forte, ligadas com folga de 2 células
    const CEL = 8, gw = Math.ceil(W / CEL), gh = Math.ceil(H / CEL);
    const cont = new Int32Array(gw * gh);
    for (const [x, y, forte] of pts) if (forte === 1) cont[((y / CEL) | 0) * gw + ((x / CEL) | 0)]++;
    const labc = new Int32Array(gw * gh).fill(-1);
    let melhorC = -1, melhorN = 0, idc = 0;
    for (let c0 = 0; c0 < gw * gh; c0++) {
      if (cont[c0] < 3 || labc[c0] >= 0) continue;
      const pilha = [c0]; labc[c0] = idc; let n = 0;
      while (pilha.length) {
        const c = pilha.pop(), cx_ = c % gw, cy_ = (c / gw) | 0; n += cont[c];
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const nx = cx_ + dx, ny = cy_ + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const v = ny * gw + nx; if (cont[v] >= 3 && labc[v] < 0) { labc[v] = idc; pilha.push(v); }
        }
      }
      if (n > melhorN) { melhorN = n; melhorC = idc; }
      idc++;
    }
    // células do bloco, com 2 de margem (pega as bordas fracas das letras)
    const noBloco = new Uint8Array(gw * gh);
    for (let c = 0; c < gw * gh; c++) if (labc[c] === melhorC) { const cx_ = c % gw, cy_ = (c / gw) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = cx_ + dx, ny = cy_ + dy; if (nx >= 0 && ny >= 0 && nx < gw && ny < gh) noBloco[ny * gw + nx] = 1; } }
    const todos = pts.filter(([x, y]) => noBloco[((y / CEL) | 0) * gw + ((x / CEL) | 0)]);
    const perto = todos.filter((p) => p[2] === 2 || (p[2] === 1 && labc[((p[1] / CEL) | 0) * gw + ((p[0] / CEL) | 0)] === melhorC));
    // inclinação pelo eixo principal
    let sx = 0, sy = 0; for (const [x, y] of perto) { sx += x; sy += y; }
    const cx = sx / perto.length, cy = sy / perto.length;
    let ang = 0, pico = -1, vReg = 0;
    for (let g = -12; g <= 12; g += 0.5) {
      const r = (g * Math.PI) / 180, c0 = Math.cos(r), s0 = Math.sin(r);
      const hist = new Map();
      for (const [x, y] of perto) { const v = Math.round((-(x - cx) * s0 + (y - cy) * c0) / 2); hist.set(v, (hist.get(v) || 0) + 1); }
      for (const [v, n] of hist) if (n > pico) { pico = n; ang = r; vReg = v * 2; }
    }
    const co = Math.cos(ang), si = Math.sin(ang);
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const [x, y] of perto) { const u = (x - cx) * co + (y - cy) * si, v = -(x - cx) * si + (y - cy) * co; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    m.logoBox = [Math.round(cx - 200), Math.round(cy - 120), Math.round(cx + 200), Math.round(cy + 120)];
    alvos[nome] = { perto, todos, cx, cy, ang, u0, u1, v0, v1, vReg, W, H };
    larguras[nome] = u1 - u0;
  }
  const lista = Object.values(larguras).sort((a, b) => a - b);
  const mediana = lista[lista.length >> 1];

  for (const [nome, A] of Object.entries(alvos)) {
    const { data } = await sharp(path.join(DIR, nome + ".png")).raw().toBuffer({ resolveWithObject: true });
    const { W, H, perto, todos, cx, cy, ang, u0, u1, v0, v1, vReg } = A;
    // máscara = pixels do logo falso dilatados 3px
    const mask = new Uint8Array(W * H);
    for (const [x, y] of todos) for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) mask[yy * W + xx] = 1; }
    const reg = []; for (let i = 0; i < W * H; i++) if (mask[i] && data[i * 4 + 3] > 200) reg.push(i);
    // grão do moletom medido fora da máscara, em volta
    let s = 0, s2 = 0, n = 0;
    for (const i of reg) for (const v of [i - 8, i + 8, i - 8 * W, i + 8 * W]) if (v >= 0 && v < W * H && !mask[v] && data[v * 4 + 3] > 200) { const l = data[v * 4 + 2]; s += l; s2 += l * l; n++; }
    const grao = n ? Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) : 4;
    // apaga: Laplace a partir da borda
    for (const i of reg) { data[i * 4] = 20; data[i * 4 + 1] = 50; data[i * 4 + 2] = 140; }
    for (let it = 0; it < 450; it++) for (const i of reg) for (let c = 0; c < 3; c++) data[i * 4 + c] = (data[(i - 1) * 4 + c] + data[(i + 1) * 4 + c] + data[(i - W) * 4 + c] + data[(i + W) * 4 + c]) / 4;
    let seed = 9; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const i of reg) { const k = (rnd() - 0.5) * Math.min(14, grao * 1.6); for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.max(0, Math.min(255, data[i * 4 + c] + k)); }

    // logo oficial: largura do falso (pensa: logo meio escondido pelo braço → usa a largura típica, alinhado à direita)
    const parcial = (u1 - u0) < mediana * 0.7;
    const Lw = Math.round(parcial ? mediana : u1 - u0), Lh = Math.round((Lw * SVG_H) / SVG_W);
    const png = await sharp(SVG, { density: (72 * Lw * 4) / SVG_W }).resize({ width: Lw }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const L = png.data, lw = png.info.width, lh = png.info.height;
    // centro do logo no referencial inclinado
    // linha da régua no logo rasterizado (a linha com mais tinta)
    let regL = 0, best = -1;
    for (let y = 0; y < lh; y++) { let n = 0; for (let x = 0; x < lw; x++) if (L[(y * lw + x) * 4 + 3] > 128) n++; if (n > best) { best = n; regL = y; } }
    const uc = parcial ? u1 - Lw / 2 : (u0 + u1) / 2, vc = vReg - (regL - lh / 2);
    const co = Math.cos(ang), si = Math.sin(ang);
    const px = cx + uc * co - vc * si, py = cy + uc * si + vc * co;
    // luz local do tecido (depois de apagar) pra modular o branco
    const lumAt = (i) => 0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2];
    let ref = 0, rn = 0; for (const i of reg) { ref += lumAt(i); rn++; } ref /= rn || 1;
    const R = Math.ceil(Math.hypot(lw, lh) / 2) + 2;
    for (let y = Math.floor(py - R); y <= py + R; y++) for (let x = Math.floor(px - R); x <= px + R; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      if (data[i * 4 + 3] < 200) continue;
      if (parcial && ((x - cx) * co + (y - cy) * si) < u0 - 4) continue; // não pinta sobre o braço
      // amostragem inversa bilinear no logo rasterizado
      const dx = x - px, dy = y - py;
      const lu = dx * co + dy * si + lw / 2, lv = -dx * si + dy * co + lh / 2;
      if (lu < 0 || lv < 0 || lu >= lw - 1 || lv >= lh - 1) continue;
      const ix = Math.floor(lu), iy = Math.floor(lv), fx = lu - ix, fy = lv - iy;
      const al = (k) => L[k * 4 + 3];
      const k00 = iy * lw + ix, k10 = k00 + 1, k01 = k00 + lw, k11 = k01 + 1;
      const a = (al(k00) * (1 - fx) * (1 - fy) + al(k10) * fx * (1 - fy) + al(k01) * (1 - fx) * fy + al(k11) * fx * fy) / 255 * 0.97;
      if (a <= 0) continue;
      const sombra = Math.max(0.78, Math.min(1.06, lumAt(i) / ref));
      // cor do próprio logo (branco ou vermelho da régua), com a luz do tecido
      const ws = [al(k00) * (1 - fx) * (1 - fy), al(k10) * fx * (1 - fy), al(k01) * (1 - fx) * fy, al(k11) * fx * fy], ks = [k00, k10, k01, k11], wt = ws[0] + ws[1] + ws[2] + ws[3] || 1;
      const cl = [0, 1, 2].map((c) => (L[ks[0] * 4 + c] * ws[0] + L[ks[1] * 4 + c] * ws[1] + L[ks[2] * 4 + c] * ws[2] + L[ks[3] * 4 + c] * ws[3]) / wt); // média pesada pelo alfa (sem franja preta)
      for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.min(255, data[i * 4 + c] * (1 - a) + Math.min(255, cl[c] * 0.96 * sombra) * a);
    }
    await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(DIR, nome + ".png"));
    console.log(nome, { largura: Lw, grau: +(ang * 180 / Math.PI).toFixed(1), parcial });
  }
  fs.writeFileSync(path.join(DIR, "poses.json"), JSON.stringify(meta, null, 1));
})();
