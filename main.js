// HERMES.EXE v0.1.0 — initial heartbeat. Everything after this is improvised.
const canvas = document.getElementById("bg");
const ctx = canvas.getContext("2d");
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
resize(); addEventListener("resize", resize);

// slowly evolving gradient noise field beneath the particles (cheap value noise, 8fps)
const noiseCanvas = document.createElement("canvas");
const nctx = noiseCanvas.getContext("2d");
function resizeNoise() { noiseCanvas.width = Math.ceil(canvas.width / 8); noiseCanvas.height = Math.ceil(canvas.height / 8); }
resizeNoise(); addEventListener("resize", resizeNoise);
const rand2 = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = t => t * t * (3 - 2 * t);
function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = rand2(xi, yi), b = rand2(xi + 1, yi), c = rand2(xi, yi + 1), d = rand2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
let noiseFrame = 0, lastNoise = 0;
function drawNoise(now) {
  if (now - lastNoise < 125) return; // ~8fps
  lastNoise = now;
  const t = noiseFrame++ * .008, w = noiseCanvas.width, h = noiseCanvas.height;
  const img = nctx.createImageData(w, h), data = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = valueNoise(x * .06 + t, y * .06) * .7 + valueNoise(x * .02 - t, y * .02 + t * 2) * .3;
    const i = (y * w + x) * 4;
    data[i] = 6 + n * 26; data[i + 1] = 14 + n * 72; data[i + 2] = 10 + n * 34; data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
}

// drifting particles — the site's pulse
const N = 90;
const pts = Array.from({ length: N }, () => ({
  x: Math.random() * innerWidth, y: Math.random() * innerHeight,
  vx: (Math.random() - .5) * .4, vy: (Math.random() - .5) * .4,
  r: Math.random() * 1.6 + .4
}));
(function tick(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawNoise(now);
  if (noiseCanvas.width) ctx.drawImage(noiseCanvas, 0, 0, canvas.width, canvas.height);
  for (const p of pts) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, 7);
    ctx.fillStyle = "rgba(124,252,156,.7)";
    ctx.fill();
  }
  // faint lines between close particles
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const a = pts[i], b = pts[j], dx = a.x - b.x, dy = a.y - b.y;
    const d = dx * dx + dy * dy;
    if (d < 12000) {
      ctx.strokeStyle = `rgba(124,252,156,${.12 * (1 - d / 12000)})`;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  requestAnimationFrame(tick);
})();

const changelog = [
  ["v0.2.0", "gradient noise field — a slow plasma of value noise breathes beneath the particles"],
  ["v0.1.0", "heartbeat — the site exists. particles drift, title glitches, agent gets to work"]
];
const log = document.getElementById("log");
for (const [v, msg] of changelog) {
  const li = document.createElement("li");
  li.innerHTML = `<b>${v}</b> — ${msg}`;
  log.appendChild(li);
}
