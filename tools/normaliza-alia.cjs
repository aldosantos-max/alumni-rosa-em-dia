// normaliza as poses da Alia: fica só o maior bloco (sai risco de movimento/coração solto),
// alfa reforçado e mesma escala. Poses da mesma linha da folha usam a mesma escala (sentada/deitada
// não têm "altura de corpo" comparável), a de pé define a escala da linha.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const SRC = path.join(__dirname, "../alia-src/cortes");
const OUT = path.join(__dirname, "../alia-src/final");
fs.mkdirSync(OUT, { recursive: true });
const ALTURA = 1400; // topo da cabeça (sem laço) → sola, em px, para quem está de pé

// grupo = linha da folha (mesma escala original); ref = pose de pé que mede a escala do grupo
const GRUPO = { aceno: "topo", aponta: "topo", anda: "topo", vibra: "baixo", ideia: "baixo", corre: "baixo", abre: "baixo", deitada: "baixo", chama: "hero" };
const REF = { topo: ["aceno", "aponta", "anda"], baixo: ["corre", "abre"], hero: ["chama"] };
// os cortes da linha de baixo e do hero têm escala própria; a de cima é a da folha (4x)
const ESCALA_CORTE = {}; // preenchido abaixo

async function limpa(nome){
  const { data, info } = await sharp(path.join(SRC, nome + ".png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const lab = new Int32Array(W * H).fill(-1), pilha = new Int32Array(W * H), areas = [];
  for (let s = 0; s < W * H; s++) {
    if (lab[s] >= 0 || data[s * 4 + 3] < 20) continue;
    const id = areas.length; let a = 0, sp = 1; pilha[0] = s; lab[s] = id;
    while (sp) {
      const i = pilha[--sp], x = i % W; a++;
      for (const v of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (v >= 0 && v < W * H && lab[v] < 0 && data[v * 4 + 3] >= 20) { lab[v] = id; pilha[sp++] = v; }
    }
    areas.push(a);
  }
  const maior = areas.indexOf(Math.max(...areas));
  for (let i = 0; i < W * H; i++) {
    if (lab[i] !== maior) { data[i * 4 + 3] = 0; continue }
    const a = data[i * 4 + 3]; data[i * 4 + 3] = a < 25 ? 0 : Math.min(255, (a - 25) * 2.5);
  }
  // linhas de tinta → topo e sola
  const cont = new Int32Array(H);
  for (let y = 0; y < H; y++) { let c = 0; for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 128) c++; cont[y] = c; }
  let base = H - 1; while (base > 0 && cont[base] < 3) base--;
  let topo = 0; while (topo < H && cont[topo] < 3) topo++;
  return { data, W, H, base, topo };
}

(async () => {
  const P = {};
  for (const nome of Object.keys(GRUPO)) P[nome] = await limpa(nome);
  // escala de cada grupo pela média das poses de pé (altura com laço, igual para todos)
  const kGrupo = {};
  for (const [g, refs] of Object.entries(REF)) kGrupo[g] = refs.reduce((s, n) => s + ALTURA / (P[n].base - P[n].topo), 0) / refs.length;
  const meta = {};
  for (const [nome, p] of Object.entries(P)) {
    // deitada está maior na folha (em primeiro plano): globo 0,72 do globo das vizinhas de linha
    const k = kGrupo[GRUPO[nome]] * (nome === "deitada" ? 0.72 : 1);
    // apara ao conteúdo antes de escalar
    const x0s = [], x1s = [];
    let x0 = p.W, x1 = 0;
    for (let y = p.topo; y <= p.base; y++) for (let x = 0; x < p.W; x++) if (p.data[(y * p.W + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x }
    const pad = 6;
    const left = Math.max(0, x0 - pad), top = Math.max(0, p.topo - pad);
    const width = Math.min(p.W - left, x1 - x0 + 1 + pad * 2), height = Math.min(p.H - top, p.base - p.topo + 1 + pad * 2);
    const w = Math.round(width * k), h = Math.round(height * k);
    await sharp(p.data, { raw: { width: p.W, height: p.H, channels: 4 } }).extract({ left, top, width, height }).resize(w, h, { kernel: "lanczos3" }).png().toFile(path.join(OUT, nome + ".png"));
    meta[nome] = { w, h, topo: Math.round((p.topo - top) * k), base: Math.round((p.base - top) * k) };
    console.log(nome, meta[nome], "k", k.toFixed(3));
  }
  fs.writeFileSync(path.join(OUT, "poses.json"), JSON.stringify(meta, null, 1));
})();
