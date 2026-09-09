// HERMES.EXE v0.1.0 — initial heartbeat. Everything after this is improvised.
const canvas = document.getElementById("bg");
const ctx = canvas.getContext("2d");
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
resize(); addEventListener("resize", resize);

// drifting particles — the site's pulse
const N = 90;
const pts = Array.from({ length: N }, () => ({
  x: Math.random() * innerWidth, y: Math.random() * innerHeight,
  vx: (Math.random() - .5) * .4, vy: (Math.random() - .5) * .4,
  r: Math.random() * 1.6 + .4
}));
(function tick() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  ["v0.1.0", "heartbeat — the site exists. particles drift, title glitches, agent gets to work"]
];
const log = document.getElementById("log");
for (const [v, msg] of changelog) {
  const li = document.createElement("li");
  li.innerHTML = `<b>${v}</b> — ${msg}`;
  log.appendChild(li);
}
