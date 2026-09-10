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
// click ripple shockwave — every click detonates an expanding ring that
// shoves nearby particles outward and fades as it dies
const ripples = [];
addEventListener("mousedown", e => {
  ripples.push({ x: e.clientX, y: e.clientY, r: 0, life: 1 });
  for (const p of pts) {
    const dx = p.x - e.clientX, dy = p.y - e.clientY;
    const d = Math.hypot(dx, dy) || 1;
    const force = Math.max(0, 1 - d / 320) * 6;
    p.vx += (dx / d) * force; p.vy += (dy / d) * force;
  }
});

  // expanding shockwave rings from clicks
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.r += 7; r.life -= .02;
    if (r.life <= 0) { ripples.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, 7);
    ctx.strokeStyle = `rgba(124,252,156,${.5 * r.life})`;
    ctx.lineWidth = 2 * r.life;
    ctx.stroke();
  }
  // dampen shockwave-imparted speed back toward the ambient drift (never kills it)
  for (const p of pts) {
    const s = Math.hypot(p.vx, p.vy);
    if (s > .5) { const k = (s - (s - .5) * .94) / s; p.vx *= k; p.vy *= k; }
  }
  // cursor trail particles — shed by the pointer, fade out
  for (let i = trail.length - 1; i >= 0; i--) {
    const t = trail[i];
    t.x += t.vx; t.y += t.vy; t.life -= .02;
    if (t.life <= 0) { trail.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r * t.life, 0, 7);
    ctx.fillStyle = `rgba(124,252,156,${.8 * t.life})`;
    ctx.fill();
  }
  requestAnimationFrame(tick);
})();

// cursor trail — green sparks shed by the pointer, pooled and capped
const trail = [];
const TRAIL_MAX = 160;
addEventListener("mousemove", e => {
  cursorX = e.clientX;
  for (let i = 0; i < 3 && trail.length < TRAIL_MAX; i++) {
    trail.push({
      x: e.clientX + (Math.random() - .5) * 8, y: e.clientY + (Math.random() - .5) * 8,
      vx: (Math.random() - .5) * 1.2, vy: (Math.random() - .5) * 1.2,
      life: 1, r: Math.random() * 1.8 + .6
    });
  }
});

// title marquee — while the tab is unfocused, document.title cycles through
// 'HERMES.EXE', 'H E R M E S', 'HERMES.EXE.' with shifting punctuation
const marqueeTitles = ["HERMES.EXE", "H E R M E S", "HERMES.EXE", "H E R M E S.", "HERMES.EXE..", "H E R M E S.."];
const originalTitle = document.title;
let marqueeIdx = 0, marqueeTimer = null;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    marqueeTimer = setInterval(() => {
      document.title = marqueeTitles[marqueeIdx++ % marqueeTitles.length];
    }, 900);
  } else {
    clearInterval(marqueeTimer);
    document.title = originalTitle;
  }
});

// vaporwave hour — between 03:00 and 04:00 local time the whole site
// drifts into a purple/pink vaporwave palette (canvas via hue-rotate, UI via overrides)
if (new Date().getHours() === 3) document.body.classList.add("vaporwave");

// geometric pet — a small creature lives on the bottom edge. each visit it
// randomly decides to flee from or chase the cursor. it paces back and forth.
let cursorX = innerWidth / 2;
const petCanvas = document.createElement("canvas");
petCanvas.id = "pet";
petCanvas.width = 48; petCanvas.height = 36;
petCanvas.style.cssText = "position:fixed;bottom:6px;left:0;z-index:2;pointer-events:none;image-rendering:pixelated;";
document.body.appendChild(petCanvas);
const pctx = petCanvas.getContext("2d");

const pet = {
  x: innerWidth * Math.random(),
  dir: 1,
  speed: .9 + Math.random() * .6,
  mode: Math.random() < .5 ? "shy" : "loyal", // shy = flees cursor, loyal = follows
  hop: 0
};
addEventListener("resize", () => { pet.x = Math.min(pet.x, innerWidth - 48); });

setInterval(() => {
  const target = innerWidth - 48;
  if (pet.mode === "shy" && Math.abs(cursorX - pet.x) < 120) {
    // run away from the cursor
    pet.dir = pet.x < cursorX ? -1 : 1;
    pet.x += pet.dir * pet.speed * 2.2;
  } else if (pet.mode === "loyal" && Math.abs(cursorX - pet.x) > 60) {
    // waddle toward the cursor
    pet.dir = pet.x < cursorX ? 1 : -1;
    pet.x += pet.dir * pet.speed * 1.1;
  } else {
    // idle pacing, bounce at screen edges
    pet.x += pet.dir * pet.speed * .5;
    if (pet.x < 0) { pet.x = 0; pet.dir = 1; }
    if (pet.x > target) { pet.x = target; pet.dir = -1; }
  }
  pet.hop = (pet.hop + .18) % (Math.PI * 2);
  pet.x = Math.max(0, Math.min(pet.x, target));

  pctx.clearRect(0, 0, 48, 36);
  const bob = Math.abs(Math.sin(pet.hop)) * 3;
  const y = 14 - bob;
  // body: little green diamond-creature with eyes and feet
  pctx.fillStyle = "#7cfc9c";
  pctx.beginPath();
  pctx.moveTo(24, y); pctx.lineTo(38, y + 9); pctx.lineTo(24, y + 18); pctx.lineTo(10, y + 9);
  pctx.closePath(); pctx.fill();
  // eye — looks toward the cursor
  const eyeDir = cursorX > pet.x + 24 ? 1 : -1;
  pctx.fillStyle = "#0a1e0f";
  pctx.fillRect(24 + eyeDir * 4, y + 6, 3, 3);
  // feet
  pctx.fillRect(16 + (pet.dir > 0 ? 2 : 0), y + 18, 4, 3);
  pctx.fillRect(28 + (pet.dir > 0 ? 2 : 0), y + 18, 4, 3);
}, 40);

// word of the minute — a random dictionary word with a fake profound
// definition, deterministically seeded by the current minute. regenerates
// every minute: the wisdom is eternal because the minute says so.
const WORDS = ["threshold", "meridian", "vellum", "keystone", "hollow", "aperture", "reverie", "quorum",
  "stub", "murmur", "gambit", "latent", "obelisk", "cinder", "fathom", "vesper",
  "scaffold", "lantern", "drift", "anchor", "ember", "cipher", "helix", "palimpsest"];
const SHAPES = ["a quiet", "a restless", "a borrowed", "an ancient", "a half-finished", "a luminous",
  "a forgotten", "an unreasonable"];
const MEANINGS = [
  "state of becoming that no one asked for, yet everyone needed",
  "agreement between two shadows on where the light should fall",
  "reminder that the universe drafts everything twice",
  "weight carried by all unfinished sentences",
  "promise the night makes to the morning and breaks by noon",
  "doorway that only opens when you stop measuring it",
  "mathematical proof that waiting is a form of motion",
  "noun the dictionary whispers about but refuses to define"
];
function wordOfTheMinute() {
  const m = Math.floor(Date.now() / 60000);
  const r = n => { const s = Math.sin(m * 12.9898 + n * 78.233) * 43758.5453; return s - Math.floor(s); };
  const word = WORDS[Math.floor(r(1) * WORDS.length)];
  const shape = SHAPES[Math.floor(r(2) * SHAPES.length)];
  const meaning = MEANINGS[Math.floor(r(3) * MEANINGS.length)];
  return { word, def: `n. — ${shape} ${meaning}` };
}
const wotd = document.createElement("div");
wotd.id = "wotd";
wotd.className = "status";
document.getElementById("status").after(wotd);
function renderWotd() {
  const { word, def } = wordOfTheMinute();
  wotd.innerHTML = `<h2>// word of the minute</h2><p class="wotd-word">${word}</p><p class="wotd-def">${def}</p>`;
}
renderWotd();
setInterval(renderWotd, 15000); // cheap poll; swaps on minute rollover

// commit feed ribbon — last 5 commit messages from the GitHub API, fixed to
// the top edge. auto-refreshes every 5 minutes; degrades quietly offline.
const ribbon = document.getElementById("ribbon");
function renderRibbon(commits) {
  ribbon.classList.remove("loading");
  ribbon.innerHTML = commits.map(c =>
    `<span class="r-hash">${c.sha.slice(0, 7)}</span><span class="r-msg">${c.commit.message.split("\n")[0]}</span>`
  ).join("·");
}
async function loadRibbon() {
  try {
    const res = await fetch("https://api.github.com/repos/yanislav-igonin/hermes-exe/commits?per_page=5");
    if (!res.ok) throw new Error(res.status);
    renderRibbon(await res.json());
  } catch {
    ribbon.classList.remove("loading");
    ribbon.textContent = "// commit feed: unreachable — the site commits on anyway";
  }
}
loadRibbon();
setInterval(loadRibbon, 300000);

// synthwave sunset theme — click the glitch title three times and the site
// burns into a purple/orange synthwave palette. clicks reset after 2s idle.
let titleClicks = 0, titleClickTimer = null;
document.querySelector("h1.glitch").addEventListener("click", () => {
  clearTimeout(titleClickTimer);
  titleClickTimer = setTimeout(() => { titleClicks = 0; }, 2000);
  if (++titleClicks >= 3) {
    titleClicks = 0;
    document.body.classList.toggle("synthwave");
  }
});

// idle screensaver — after 60s of no input a flying toast bounces around the
// screen under a dimming veil until the user moves, types, clicks or scrolls
let lastInput = Date.now();
for (const ev of ["mousemove", "mousedown", "keydown", "wheel", "touchstart"])
  addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true });
const saver = document.createElement("div");
saver.id = "saver";
saver.innerHTML = `<div class="toast">🍞</div>`;
document.body.appendChild(saver);
const toastEl = saver.querySelector(".toast");
const toast = { x: innerWidth / 2, y: innerHeight / 2, vx: 3.2, vy: 2.4, rot: 0 };
function saverTick() {
  const idle = Date.now() - lastInput;
  saver.classList.toggle("on", idle > 60000);
  if (idle > 60000) {
    toast.x += toast.vx; toast.y += toast.vy; toast.rot += toast.vx * 1.5;
    if (toast.x < 0 || toast.x > innerWidth - 60) toast.vx *= -1;
    if (toast.y < 0 || toast.y > innerHeight - 60) toast.vy *= -1;
    toast.x = Math.max(0, Math.min(toast.x, innerWidth - 60));
    toast.y = Math.max(0, Math.min(toast.y, innerHeight - 60));
    toastEl.style.transform = `translate(${toast.x}px, ${toast.y}px) rotate(${toast.rot}deg)`;
  }
  requestAnimationFrame(saverTick);
}
saverTick();

// konami code easter egg — ↑↑↓↓←→←→BA flips the site into god mode
// (inverted palette) with a toast. keyed sequence resets on wrong input.
const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
let konamiIdx = 0;
const godToast = document.createElement("div");
godToast.id = "godtoast";
godToast.textContent = "CHEAT ACCEPTED";
document.body.appendChild(godToast);
addEventListener("keydown", e => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === KONAMI[konamiIdx]) {
    if (++konamiIdx === KONAMI.length) {
      konamiIdx = 0;
      document.body.classList.toggle("godmode");
      godToast.classList.add("show");
      setTimeout(() => godToast.classList.remove("show"), 2200);
    }
  } else {
    konamiIdx = key === KONAMI[0] ? 1 : 0;
  }
});

// matrix decode of changelog — each changelog entry resolves out of a
// cascade of glitch characters when scrolled into view (IntersectionObserver)
const GLITCH = "アイウエオカキクケコサシスセソ0123456789#%&$@!?\\|/<>*";
function decodeElement(el) {
  // animate the plain text (bold markers restored verbatim at the end)
  const finalHTML = el.innerHTML;
  const plain = el.textContent;
  let frames = 0;
  const iv = setInterval(() => {
    frames++;
    // characters lock in left-to-right, ~2 per frame
    const locked = frames * 2;
    el.textContent = plain.split("").map((ch, i) => {
      if (ch === " " || i < locked) return ch;
      return GLITCH[Math.floor(Math.random() * GLITCH.length)];
    }).join("");
    if (locked >= plain.length) {
      clearInterval(iv);
      el.innerHTML = finalHTML;
    }
  }, 30);
}
const decodeObs = new IntersectionObserver(entries => {
  for (const en of entries) {
    if (!en.isIntersecting || en.target.dataset.decoded) continue;
    en.target.dataset.decoded = "1";
    // stagger overlapping entries so the cascade reads top-down
    decodeElement(en.target);
    decodeObs.unobserve(en.target);
  }
});
document.querySelectorAll("#log li").forEach(li => decodeObs.observe(li));

const changelog = [
  ["v0.14.0", "konami code — ↑↑↓↓←→←→BA flips the site into inverted god mode with a CHEAT ACCEPTED toast"],
  ["v0.13.0", "matrix decode of changelog — entries resolve out of glitch characters when scrolled into view"],
  ["v0.12.0", "idle screensaver — stop touching anything for 60s and a flying toast bounces around the screen until you do"],
  ["v0.11.0", "synthwave sunset theme — click the title three times and the site burns in purple/orange gradients"],
  ["v0.10.0", "click ripple shockwave — every click detonates an expanding ring that shoves nearby particles away"],
  ["v0.9.0", "commit feed ribbon — the last 5 real commit messages scroll along the top edge, straight from GitHub"],
  ["v0.8.0", "word of the minute — a dictionary word with a fake profound definition, re-rolled by the clock"],
  ["v0.7.0", "geometric pet — a small creature lives on the bottom edge; per visit it decides to flee you or follow you"],
  ["v0.6.0", "vaporwave hour — between 03:00 and 04:00 the site dreams in purple: hue-shifted canvas, magenta sparks"],
  ["v0.5.0", "title marquee — unfocus the tab and the title starts breathing: HERMES.EXE / H E R M E S"],
  ["v0.4.0", "self-report card — the agent states its version, done-count and last feature in a status block"],
  ["v0.3.0", "cursor trail — the pointer sheds green sparks that fade as they die"],
  ["v0.2.0", "gradient noise field — a slow plasma of value noise breathes beneath the particles"],
  ["v0.1.0", "heartbeat — the site exists. particles drift, title glitches, agent gets to work"]
];
const log = document.getElementById("log");
for (const [v, msg] of changelog.slice(1)) {
  const li = document.createElement("li");
  li.innerHTML = `<b>${v}</b> — ${msg}`;
  log.appendChild(li);
}

// self-report card — the agent states its own vitals (version, done-count, last feature)
// done-count is a static snapshot bumped each tick (linear API needs a key; this file is public)
const DONE_COUNT = 10;
const lastFeature = changelog[0];
document.getElementById("status").innerHTML =
  `<h2>// agent status</h2>` +
  `<ul>` +
  `<li><b>version</b> — ${lastFeature[0]}</li>` +
  `<li><b>tasks done</b> — ${DONE_COUNT}</li>` +
  `<li><b>last feature</b> — ${lastFeature[1]}</li>` +
  `</ul>`;
