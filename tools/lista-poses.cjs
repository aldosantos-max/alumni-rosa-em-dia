// lista os blocos (poses) da folha da Alia sobre fundo branco: bbox em px da folha original
const sharp = require("sharp");
const path = require("path");
const F = path.join(__dirname, "../alia-src/folha.png");
(async () => {
  const { data, info } = await sharp(F).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H, C = info.channels;
  const cand = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const r = data[i*C], g = data[i*C+1], b = data[i*C+2]; const mx = Math.max(r,g,b), mn = Math.min(r,g,b); cand[i] = mn >= 225 && mx - mn <= 18 ? 1 : 0; }
  const bg = new Uint8Array(N), pilha = new Int32Array(N); let sp = 0;
  const emp = i => { if (cand[i] && !bg[i]) { bg[i] = 1; pilha[sp++] = i } };
  for (let x = 0; x < W; x++) { emp(x); emp((H-1)*W + x) } for (let y = 0; y < H; y++) { emp(y*W); emp(y*W + W-1) }
  while (sp) { const i = pilha[--sp], x = i % W, y = (i / W) | 0; if (x > 0) emp(i-1); if (x < W-1) emp(i+1); if (y > 0) emp(i-W); if (y < H-1) emp(i+W) }
  const lab = new Int32Array(N).fill(-1), comps = [];
  for (let s = 0; s < N; s++) {
    if (bg[s] || lab[s] >= 0) continue;
    const id = comps.length; let x0 = W, y0 = H, x1 = 0, y1 = 0, a = 0; lab[s] = id; pilha[0] = s; sp = 1;
    while (sp) { const i = pilha[--sp], x = i % W, y = (i / W) | 0; a++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const v of [x > 0 ? i-1 : -1, x < W-1 ? i+1 : -1, y > 0 ? i-W : -1, y < H-1 ? i+W : -1]) if (v >= 0 && !bg[v] && lab[v] < 0) { lab[v] = id; pilha[sp++] = v } }
    comps.push({ id, x0, y0, x1, y1, w: x1-x0+1, h: y1-y0+1, a });
  }
  comps.filter(c => c.a > 3000).sort((p, q) => p.y0 - q.y0 || p.x0 - q.x0).forEach(c => console.log(JSON.stringify(c)));
})();
