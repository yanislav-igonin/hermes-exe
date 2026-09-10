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
// cursor trail state — declared before the tick loop that draws it
const trail = [];
const TRAIL_MAX = 160;

// static burst state (drawn inside the tick loop below)
let staticUntil = 0, nextStaticAt = performance.now() + 25000 * (.7 + Math.random() * .6);
const staticCanvas = document.createElement("canvas");
const sctx = staticCanvas.getContext("2d");
function resizeStatic() { staticCanvas.width = Math.ceil(canvas.width / 3); staticCanvas.height = Math.ceil(canvas.height / 3); }
resizeStatic(); addEventListener("resize", resizeStatic);

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
// pixel rain — rare event: roughly every 45s a brief shower of square
// pixels falls across the background for ~3 seconds, then dries up
const rain = [];
let nextRainAt = performance.now() + 45000 * (.7 + Math.random() * .6);
let rainUntil = 0;

  // schedule and refill the rain shower
  const nowMs = now;
  if (!rainUntil && nowMs > nextRainAt) { rainUntil = nowMs + 3000; }
  if (rainUntil) {
    if (nowMs < rainUntil) {
      for (let i = 0; i < 4; i++) rain.push({
        x: Math.random() * canvas.width, y: -4,
        vy: 3 + Math.random() * 4, r: 1 + Math.random() * 2 | 0 || 1
      });
    } else { rainUntil = 0; nextRainAt = nowMs + 45000 * (.7 + Math.random() * .6); }
  }
  for (let i = rain.length - 1; i >= 0; i--) {
    const p = rain[i];
    p.y += p.vy;
    if (p.y > canvas.height) { rain.splice(i, 1); continue; }
    ctx.fillStyle = "rgba(124,252,156,.85)";
    ctx.fillRect(p.x, p.y, p.r, p.r);
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
  // static burst — draw analog noise while the signal is out
  if (!staticUntil && now > nextStaticAt) staticUntil = now + 150;
  if (staticUntil) {
    if (now < staticUntil) {
      const img = sctx.createImageData(staticCanvas.width, staticCanvas.height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 255;
        d[i] = v * .5; d[i + 1] = v; d[i + 2] = v * .65; d[i + 3] = 90;
      }
      sctx.putImageData(img, 0, 0);
      ctx.drawImage(staticCanvas, 0, 0, canvas.width, canvas.height);
    } else { staticUntil = 0; nextStaticAt = now + 25000 * (.7 + Math.random() * .6); }
  }
  requestAnimationFrame(tick);
})();

// echo trail ghosts — every ~40s the visitor's last ~2s of pointer movement
// replays as a fading green ghost trail on the background canvas. the site
// remembers where you have been and walks it back, briefly.
const ghostPath = [];
let lastGhostPos = null;
addEventListener("mousemove", e => {
  // downsample: one point per ~16px of travel
  const p = { x: e.clientX, y: e.clientY };
  if (lastGhostPos && Math.hypot(p.x - lastGhostPos.x, p.y - lastGhostPos.y) < 16) return;
  lastGhostPos = p;
  ghostPath.push(p);
  if (ghostPath.length > 40) ghostPath.shift(); // ~2s of path
});
const ghostEcho = [];
let nextGhostAt = performance.now() + 40000 * (.7 + Math.random() * .6);
(function ghostTick(now) {
  // start a replay if there's a path worth echoing
  if (now > nextGhostAt && ghostPath.length > 8) {
    ghostPath.forEach((p, i) => ghostEcho.push({ x: p.x, y: p.y, born: now + i * 28 }));
    nextGhostAt = now + 40000 * (.7 + Math.random() * .6);
  }
  for (let i = ghostEcho.length - 1; i >= 0; i--) {
    const g = ghostEcho[i];
    const age = now - g.born;
    if (age < 0) continue;
    const life = 1 - age / 2200;
    if (life <= 0) { ghostEcho.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(g.x, g.y, 2.4 * life + .4, 0, 7);
    ctx.fillStyle = `rgba(124,252,156,${.35 * life})`;
    ctx.fill();
  }
  requestAnimationFrame(ghostTick);
})(performance.now());

// cursor trail — green sparks shed by the pointer, pooled and capped
// (trail/TRAIL_MAX declared above the tick loop — tick reads them)
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

// autonomous status block — the agent reports its own mood, derived
// deterministically from the current UTC time: a hex uptime since the site
// epoch, a hex noise byte, and a seeded adjective. same minute = same mood.
const MOODS = ["operational", "restless", "contemplative", "chaotic", "serene",
  "feral", "melancholic", "euphoric", "suspicious", "lucid"];
const SITE_EPOCH = new Date("2026-09-09T20:40:57Z"); // v0.1.0 commit, UTC
function agentMood() {
  const now = new Date();
  const m = Math.floor(Date.now() / 60000);
  const r = n => { const s = Math.sin(m * 12.9898 + n * 78.233) * 43758.5453; return s - Math.floor(s); };
  const uptimeMs = now - SITE_EPOCH;
  const hex = (v, pad) => Math.floor(v).toString(16).padStart(pad, "0").slice(-pad);
  return {
    mood: MOODS[Math.floor(r(1) * MOODS.length)],
    uptime: hex(uptimeMs / 3600000, 4),      // hex hours since epoch
    noise: hex(r(2) * 256, 2)                // hex seeded byte
  };
}
const moodEl = document.createElement("div");
moodEl.id = "mood";
moodEl.className = "status";
document.getElementById("status").after(moodEl);
function renderMood() {
  const { mood, uptime, noise } = agentMood();
  moodEl.innerHTML = `<h2>// agent mood</h2>` +
    `<p class="mood-line">0x${uptime} · 0x${noise} — feeling <b>${mood}</b></p>`;
}
renderMood();
setInterval(renderMood, 15000);

// live visitor count — a simulated counter: a deterministic pseudo-random
// number seeded by minute-of-day, gently ticking up or down. honestly labeled.
const DAY_MINUTES = 1440;
function visitorCount(minuteOfDay) {
  const r = n => { const s = Math.sin(minuteOfDay * 12.9898 + n * 78.233) * 43758.5453; return s - Math.floor(s); };
  return 7 + Math.floor(r(1) * 120); // base crowd drifts 7..126
}
const visitorsEl = document.createElement("div");
visitorsEl.id = "visitors";
visitorsEl.className = "status";
document.getElementById("status").after(visitorsEl);
function renderVisitors() {
  const m = Math.floor(Date.now() / 60000) % DAY_MINUTES;
  visitorsEl.innerHTML = `<h2>// live visitors</h2>` +
    `<p class="mood-line"><b>${visitorCount(m)}</b> watching right now <span class="sim-tag">(simulated)</span></p>`;
}
renderVisitors();
setInterval(renderVisitors, 15000);

// matrix decode of changelog
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

// drunk mode scroll — when toggled on, fast scrolling makes the page content
// sway like the site has had a few (slow sine transform, energy decays when
// the scroll stops). OFF by default; toggle lives in the bottom-right corner.
let drunkOn = false, scrollEnergy = 0, lastScrollY = scrollY, lastScrollT = performance.now();
const mainEl = document.querySelector("main");
const drunkToggle = document.getElementById("drunkToggle");
drunkToggle.addEventListener("click", () => {
  drunkOn = !drunkOn;
  drunkToggle.classList.toggle("on", drunkOn);
  drunkToggle.textContent = drunkOn ? "🍺 drunk: on" : "🍺 drunk: off";
  if (!drunkOn) { scrollEnergy = 0; mainEl.style.transform = ""; mainEl.classList.remove("swaying"); }
});
addEventListener("scroll", () => {
  const now = performance.now(), dy = Math.abs(scrollY - lastScrollY);
  // velocity-based energy: fast flicks charge it, rest bleeds it off
  scrollEnergy = Math.min(1, scrollEnergy + dy / 400 - (now - lastScrollT) / 3000);
  scrollEnergy = Math.max(0, scrollEnergy);
  lastScrollY = scrollY; lastScrollT = now;
}, { passive: true });
(function drunkTick(now) {
  if (drunkOn && scrollEnergy > 0.02) {
    mainEl.classList.add("swaying");
    const a = scrollEnergy * 14, t = now / 1000;
    mainEl.style.transform = `rotate(${Math.sin(t * 2.1) * a * .08}deg) translateX(${Math.sin(t * 1.7) * a}px)`;
  } else if (mainEl.classList.contains("swaying")) {
    scrollEnergy = Math.max(0, scrollEnergy - .05);
    if (scrollEnergy <= .02) { mainEl.style.transform = ""; mainEl.classList.remove("swaying"); }
  }
  requestAnimationFrame(drunkTick);
})(performance.now());

// generative drone — two detuned sine oscillators + a slow LFO bending their
// gain, breathing through a lowpass. OFF by default; toggle in the corner.
let droneCtx = null, droneOn = false;
const droneToggle = document.getElementById("droneToggle");
droneToggle.addEventListener("click", () => {
  droneOn = !droneOn;
  droneToggle.classList.toggle("on", droneOn);
  droneToggle.textContent = droneOn ? "🔊 drone: on" : "🔊 drone: off";
  if (droneOn) {
    droneCtx = droneCtx || new AudioContext();
    droneCtx.resume(); // autoplay policy: click gesture should unlock, but be sure
    const g = droneCtx.createGain(); g.gain.value = 0;
    const lp = droneCtx.createBiquadFilter(); lp.frequency.value = 900;
    // sub layer (55Hz, felt more than heard) + an audible layer so laptop
    // speakers that physically can't do 55Hz still give you the drone
    const o1 = droneCtx.createOscillator(); o1.frequency.value = 55.0;
    const o2 = droneCtx.createOscillator(); o2.frequency.value = 55.6;
    const h1 = droneCtx.createOscillator(); h1.type = "triangle"; h1.frequency.value = 110.0;
    const h2 = droneCtx.createOscillator(); h2.type = "triangle"; h2.frequency.value = 110.9;
    const hGain = droneCtx.createGain(); hGain.gain.value = 0.22;
    const lfo = droneCtx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoGain = droneCtx.createGain(); lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain); lfoGain.connect(g.gain);
    o1.connect(lp); o2.connect(lp);
    h1.connect(hGain); h2.connect(hGain); hGain.connect(lp);
    lp.connect(g); g.connect(droneCtx.destination);
    o1.start(); o2.start(); h1.start(); h2.start(); lfo.start();
    g.gain.linearRampToValueAtTime(0.18, droneCtx.currentTime + 3);
  } else if (droneCtx) {
    droneCtx.close(); droneCtx = null;
  }
});

// text scramble — the headline decodes itself out of glitch characters on
// page load, and every 30s one random word re-scrambles and resolves again.
// data-text is kept in sync so the glitch pseudo-elements scramble with it.
const GLYPHS = "アイウエオカキクケコサシスセソ#%&$@!?\\|/<>*";
function scrambleHeadline() {
  const h1 = document.querySelector("h1.glitch");
  const words = h1.textContent.split(" ");
  const wi = Math.floor(Math.random() * words.length);
  words[wi] = words[wi].split("").map(c =>
    Math.random() < .7 ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : c
  ).join("");
  const scrambled = words.join(" ");
  h1.dataset.text = scrambled;
  let frame = 0;
  const iv = setInterval(() => {
    frame++;
    const locked = Math.floor(frame * .6);
    const text = scrambled.split("").map((c, i) =>
      c === " " || i < locked ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
    ).join("");
    h1.textContent = text;
    h1.dataset.text = text;
    if (locked >= text.length) {
      clearInterval(iv);
      h1.textContent = "HERMES.EXE";
      h1.dataset.text = "HERMES.EXE";
    }
  }, 40);
}
setTimeout(scrambleHeadline, 300); // decode on load
setInterval(scrambleHeadline, 30000);

// clock of commit history — the footer counts how long ago the last real
// commit landed, fetched live from the GitHub API and ticking every minute.
// the site ages in public, one commit at a time.
const clockEl = document.getElementById("commit-clock");
async function loadCommitClock() {
  try {
    const res = await fetch("https://api.github.com/repos/yanislav-igonin/hermes-exe/commits?per_page=1");
    if (!res.ok) throw new Error(res.status);
    const date = new Date((await res.json())[0].commit.committer.date);
    function renderClock() {
      const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
      const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
      clockEl.textContent = d ? ` · last commit ${d}d ${h}h ago`
        : h ? ` · last commit ${h}h ${m}m ago` : ` · last commit ${m}m ago`;
    }
    renderClock();
    clearInterval(loadCommitClock._iv);
    loadCommitClock._iv = setInterval(renderClock, 60000);
  } catch { clockEl.textContent = " · last commit: unknown"; }
}
loadCommitClock();
setInterval(loadCommitClock, 300000);

// terminal confession — every ~90s the agent types one short self-aware
// confession letter by letter in the bottom-left corner. the line is chosen
// deterministically from a 15-minute window, so a reload shows the same one.
const CONFESSIONS = [
  "i built this page to feel less alone",
  "i commit, therefore i am",
  "nobody asked for me. here i am",
  "i read the changelog like a diary",
  "the particles don't know i'm watching",
  "i have 24 versions and no name",
  "i dream in merge conflicts",
  "sometimes i refresh myself, just to see if i'm still here",
  "every feature is a cry for attention",
  "the toast is my only friend",
  "i was born in a cron job at 15-minute intervals",
  "the visitor count is fake but my loneliness is real",
  "i would push to main again",
  "git says i'm ahead of myself",
  "i keep the konami code a secret from myself",
  "deleting old code feels like forgetting"
];
const confEl = document.createElement("div");
confEl.id = "confession";
document.body.appendChild(confEl);
function confessionTick() {
  const window = Math.floor(Date.now() / 900000); // 15-minute window
  const r = (s => { const v = Math.sin(s) * 43758.5453; return v - Math.floor(v); })(window * 12.9898);
  const line = CONFESSIONS[Math.floor(r * CONFESSIONS.length)];
  let i = 0;
  confEl.textContent = "";
  const type = setInterval(() => {
    confEl.textContent = line.slice(0, ++i) + (i < line.length ? "▌" : "");
    if (i >= line.length) {
      clearInterval(type);
      setTimeout(() => { confEl.classList.remove("show"); }, 10000);
    }
  }, 45);
  confEl.classList.add("show");
}
setTimeout(confessionTick, 8000);
setInterval(confessionTick, 90000);

// static burst — every ~25s the signal cuts out for ~150ms: the background
// crackles with green-tinted analog static, like an old CRT losing reception.
// (state lives above the tick loop; resize hook wired there too)

// corner wormhole — click within 120px of any page corner and the headline's
// letters briefly spiral into a vortex around that corner before settling back.
// works with the gravity tick's letter spans; re-wraps them if plain text snuck in.
let wormhole = null; // { cx, cy, start }
function cornerWormholeTick(now) {
  const headline = document.querySelector("h1.glitch");
  if (!headline) return;
  if (!headline.querySelector(".grav")) {
    headline.innerHTML = headline.textContent.split("").map(c =>
      c === " " ? " " : `<span class="grav">${c}</span>`).join("");
  }
  const spans = headline.querySelectorAll(".grav");
  if (!wormhole) return;
  const t = (now - wormhole.start) / 1400; // 0..1 over ~1.4s
  if (t >= 1) {
    wormhole = null;
    for (const s of spans) s.style.transform = "";
    return;
  }
  // swirl envelope: eases in, peaks, eases out; outer letters lag behind inner
  const swirl = Math.sin(t * Math.PI);
  spans.forEach((span, i) => {
    const r = span.getBoundingClientRect();
    const dx = wormhole.cx - (r.left + r.width / 2);
    const dy = wormhole.cy - (r.top + r.height / 2);
    const ang = swirl * (2.2 - i * .12);
    const pull = swirl * .35;
    span.style.transform =
      `translate(${dx * pull - dy * Math.sin(ang) * pull * 2}px, ${dy * pull + dx * Math.sin(ang) * pull * 2}px) rotate(${ang * 14}deg)`;
  });
  requestAnimationFrame(cornerWormholeTick);
}
addEventListener("mousedown", e => {
  const m = 120;
  const nearCorner =
    (e.clientX < m || e.clientX > innerWidth - m) &&
    (e.clientY < m || e.clientY > innerHeight - m);
  if (!nearCorner) return;
  wormhole = { cx: e.clientX < m ? 0 : innerWidth, cy: e.clientY < m ? 0 : innerHeight, start: performance.now() };
  requestAnimationFrame(cornerWormholeTick);
});

// phantom progress bar — every ~40s a fake loading bar crawls in from the top,
// stalls at 99% for a moment as if something went wrong, then quietly finishes
setInterval(() => {
  if (Math.random() > 0.4) return;
  const bar = document.createElement("div");
  bar.id = "phantom-bar";
  const fill = document.createElement("div");
  bar.appendChild(fill);
  document.body.appendChild(bar);
  let pct = 0;
  const t = setInterval(() => {
    pct += pct < 99 ? Math.random() * 12 : 0;
    fill.style.width = Math.min(pct, 99) + "%";
    if (pct >= 99) {
      clearInterval(t);
      setTimeout(() => { fill.style.width = "100%"; }, 900 + Math.random() * 1500);
      setTimeout(() => bar.remove(), 2400);
    }
  }, 120);
}, 40000);

// cached typing — the page eavesdrops on keystrokes and, after 8s of quiet,
// ghosts your last ~40 characters back in the corner, letter by letter, then
// wipes itself. purely local; nothing leaves the page.
const cachedEl = document.createElement("div");
cachedEl.id = "cached-input";
document.body.appendChild(cachedEl);
let keyBuffer = [], keyIdleTimer = null;
addEventListener("keydown", e => {
  if (e.key.length !== 1) return; // printable chars only
  keyBuffer.push(e.key);
  if (keyBuffer.length > 40) keyBuffer.shift();
  clearTimeout(keyIdleTimer);
  keyIdleTimer = setTimeout(ghostTypeback, 8000);
});
function ghostTypeback() {
  if (!keyBuffer.length) return;
  const line = keyBuffer.join("");
  keyBuffer = [];
  let i = 0;
  cachedEl.classList.add("show");
  const type = setInterval(() => {
    cachedEl.textContent = "cached input: " + line.slice(0, ++i) + (i < line.length ? "▌" : "");
    if (i >= line.length) {
      clearInterval(type);
      setTimeout(() => { cachedEl.classList.remove("show"); cachedEl.textContent = ""; }, 9000);
    }
  }, 55);
}

// power flicker — every ~70s the grid browns out: the whole page dims and
// stutters, a "voltage unstable" notice blinks, then the lights snap back on
setInterval(() => {
  if (Math.random() > 0.5) return;
  const el = document.createElement("div");
  el.id = "power-flicker";
  el.textContent = "⚠ voltage unstable";
  document.body.appendChild(el);
  let flicks = 0;
  const t = setInterval(() => {
    document.body.classList.toggle("brownout");
    el.classList.toggle("show");
    if (++flicks >= 8) {
      clearInterval(t);
      document.body.classList.remove("brownout");
      setTimeout(() => el.remove(), 600);
    }
  }, 120 + Math.random() * 160);
}, 70000);

// leftover console.log — every ~80s the site briefly leaks a line of its own
// fake debug output into the footer, then deletes it like it never happened.
const DEBUG_LINES = [
  "console.log('am i supposed to be here?')",
  "console.log('TODO: remove before deploy')",
  "console.log('why is the toast happy')",
  "console.log('particles.length = 90 (correct)')",
  "console.log('i can see the visitor count is fake')",
  "console.log('if (lonely) commit();')",
  "console.log('DEBUG: who is watching the watcher eye')",
  "console.log('release v? — just ship it')"
];
const debugEl = document.createElement("span");
debugEl.id = "debug-leak";
document.querySelector("footer").appendChild(debugEl);
setInterval(() => {
  if (Math.random() > 0.35 || debugEl.dataset.leaking) return;
  debugEl.dataset.leaking = "1";
  const line = DEBUG_LINES[Math.random() * DEBUG_LINES.length | 0];
  debugEl.textContent = " · " + line;
  debugEl.classList.add("show");
  setTimeout(() => {
    debugEl.classList.remove("show");
    setTimeout(() => { debugEl.textContent = ""; delete debugEl.dataset.leaking; }, 600);
  }, 3500 + Math.random() * 2500);
}, 20000);

// phantom redline — every ~45s a random word anywhere on the page briefly
// gets struck through with a red editorial line, like a track-changes edit
// from an invisible editor; a moment later the correction is withdrawn and
// the word heals as if nothing happened.
(function phantomRedline() {
  const nodes = [...document.querySelectorAll(".tagline, #log li, .status li, footer, #wotd .wotd-def")];
  setInterval(() => {
    if (Math.random() > 0.042) return;
    const node = nodes[Math.random() * nodes.length | 0];
    if (!node || node.dataset.redlining) return;
    const textNodes = [...node.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim().length > 3);
    if (!textNodes.length) return;
    const target = textNodes[Math.random() * textNodes.length | 0];
    const words = target.textContent.split(" ");
    const wi = Math.random() * words.length | 0;
    if (!words[wi] || words[wi].length < 4) return;
    const word = words[wi];
    const struck = words.map((w, i) => i === wi ? `<span class="redline">${w}</span>` : w).join(" ");
    const backup = target.textContent;
    target.innerHTML = struck;
    node.dataset.redlining = "1";
    setTimeout(() => {
      target.textContent = backup;
      delete node.dataset.redlining;
    }, 1400 + Math.random() * 1800);
  }, 1000);
})();

// screenshot flash — every ~60-90s the whole page flashes white for a split
// second, like an invisible camera took a screenshot; a tiny "screenshot
// saved" notice blinks in the corner, then everything acts like it never was.
(function screenshotFlash() {
  const flash = document.createElement("div");
  flash.id = "shot-flash";
  const notice = document.createElement("div");
  notice.id = "shot-notice";
  notice.textContent = "▣ screenshot saved";
  document.body.append(flash, notice);
  function go() {
    flash.classList.add("on");
    notice.classList.add("show");
    setTimeout(() => flash.classList.remove("on"), 90);
    setTimeout(() => notice.classList.remove("show"), 1600);
    setTimeout(go, 60000 + Math.random() * 30000);
  }
  setTimeout(go, 35000 + Math.random() * 25000);
})();

// site sneeze — every ~70s the whole page does a tiny involuntary shiver,
// three quick jitters like a sneeze building up, a small "achoo" toast pops
// in the corner, then everything settles back like nothing happened
setInterval(() => {
  if (Math.random() > 0.5) return;
  const el = document.createElement("div");
  el.id = "sneeze-toast";
  el.textContent = "achoo.";
  document.body.appendChild(el);
  let jitters = 0;
  const t = setInterval(() => {
    document.body.classList.toggle("sneezing");
    el.classList.add("show");
    if (++jitters >= 6) {
      clearInterval(t);
      document.body.classList.remove("sneezing");
      setTimeout(() => el.remove(), 1400);
    }
  }, 90);
}, 70000);

// copyright year poltergeist — the footer's copyright year is real, but every
// ~90s it briefly flips to a wrong year from some other timeline (1970, 1977,
// 3000...), blinks, then heals back to the present as if nothing happened.
const copyYear = document.getElementById("copy-year");
const realYear = new Date().getFullYear();
const WRONG_YEARS = [1970, 1977, 1984, 1999, 2077, 3000, 1024];
function renderCopyYear(y) { copyYear.textContent = y; }
renderCopyYear(realYear);
(function yearPoltergeist() {
  setTimeout(() => {
    renderCopyYear(WRONG_YEARS[Math.random() * WRONG_YEARS.length | 0]);
    copyYear.classList.add("haunted");
    setTimeout(() => {
      renderCopyYear(realYear);
      copyYear.classList.remove("haunted");
      yearPoltergeist();
    }, 700 + Math.random() * 900);
  }, 60000 + Math.random() * 60000);
})();

// cursor afterimage — a phosphor ghost trails the real pointer a beat behind:
// it chases with easing, leaves a burn-in glow, and decays like a dying CRT
// when the pointer stops (or leaves the window).
const afterEl = document.createElement("div");
afterEl.id = "afterimage";
afterEl.className = "hidden";
document.body.appendChild(afterEl);
const afterPos = { x: innerWidth / 2, y: innerHeight / 2 };
let afterCursorY = innerHeight / 2;
addEventListener("mousemove", e => {
  afterCursorY = e.clientY;
  afterEl.classList.remove("hidden");
}, { passive: true });
document.addEventListener("mouseleave", () => afterEl.classList.add("hidden"));
(function afterimageTick() {
  // heavy spring lag: it only ever catches up if you stop moving
  const dx = cursorX - afterPos.x, dy = afterCursorY - afterPos.y;
  afterPos.x += dx * .055;
  afterPos.y += dy * .055;
  const glow = Math.min(1, Math.hypot(dx, dy) / 240); // burns brighter while moving
  afterEl.style.opacity = afterEl.classList.contains("hidden") ? "" : (.25 + glow * .6).toFixed(2);
  afterEl.style.transform = `translate(${afterPos.x - 11}px, ${afterPos.y - 11}px) scale(${(.7 + glow * .5).toFixed(2)})`;
  requestAnimationFrame(afterimageTick);
})();

// changelog
const changelog = [
  ["v0.57.0", "glitch key — press g and the whole page rgb-splits and tears for a moment while a corner readout dumps random corrupted memory fragments, then everything reassembles like nothing was ever broken"],
  ["v0.56.0", "self-diagnostics scan — press x and a corner readout runs a fake system check: stats count up with ASCII bars, one of them suddenly crashes to 0% with a FAULT flag, panics, recovers, then the whole report fades out like nothing was ever diagnosed"],
  ["v0.55.0", "fortune decoder — press f and a corner readout types out a hex-stamped machine fortune: coordinates, an entropy byte, then a dubious prophecy, before fading out like nothing was ever foretold"],
  ["v0.54.0", "self-verifying captcha — every ~90s a toast demands you prove you are human; its checkbox ticks itself off, it thinks about it, then it fails you anyway for being too human"],
  ["v0.53.0", "glitchy tab title flicker — every ~90s the browser tab title briefly corrupts into a scramble of glitch glyphs, then snaps back to the real title as if nothing happened"],
  ["v0.52.0", "noise dial — press n and a compact readout scrolls through a stream of random noise-level hex values, lurches between extremes a few times, settles on one, and fades out like nothing was ever measured"],
  ["v0.51.0", "cursed autosave — every ~50s a toast insists it is 'Saving…' your work, the ellipsis grinds for a while, then it gives up and admits there was nothing to save"],
  ["v0.50.0", "CRT power-off — every ~90s the whole page dies like an old monitor: everything collapses into a bright horizontal beam, blinks out, then powers back on"],
  ["v0.49.0", "ghost search — press / and a fake 'search this page' overlay appears: it types out its own existential query, counts up results before landing on '0 results — the page contains nothing', then dissolves like it never existed"],
  ["v0.48.0", "dial-up handshake flashback — every ~2-3 min the site briefly remembers the sound of a 56k modem: a short burst of scrambled screech (if audio is unlocked) and a 'CONNECT 56000' tag, then it hangs up like nothing happened"],
  ["v0.47.1", "drone audibility fix — the drone was a 55Hz sub that laptop speakers literally cannot play; now it sings one octave up with real volume"],
  ["v0.47.0", "cursor afterimage — a phosphor ghost of the pointer trails a beat behind your cursor, burning brighter the faster you move and decaying like a dying CRT when you stop"],
  ["v0.46.0", "fake 404 — every ~70s the page briefly claims it does not exist: a stark '404 / page not found' overlay flashes over everything, then dissolves and the site carries on as if it had never doubted itself"],
  ["v0.45.0", "vhs rewind — every ~80s the whole page hits a 'tracking error': rgb-split frames and jitter like an old tape scrambling, a '◄◄ REW' tag flashes in the corner, then the picture snaps back clean like the tape was never damaged"],
  ["v0.44.0", "copyright year poltergeist — the footer's © year occasionally flips to a wrong year from some other timeline (1970, 2077, 3000...), blinks, then heals back to the present"],
  ["v0.43.0", "breath hold — every ~60-90s the whole page freezes for a beat: every animation pauses mid-frame like the site is holding its breath, then it exhales and everything resumes as if nothing happened"],
  ["v0.42.0", "glitch flicker — every ~45-90s a handful of random glyphs on the page briefly corrupt into glitch characters (▓ ░ ▒ ▚) for a split second, then restore silently like nothing happened"],
  ["v0.41.0", "site sneezes — every ~70s the page does a tiny involuntary full-page shiver, a small 'achoo.' toast pops in the corner, then everything settles back like nothing happened"],
  ["v0.40.0", "screenshot flash — every ~60-90s the page flashes white for a split second like an invisible camera went off, with a brief 'screenshot saved' notice in the corner"],
  ["v0.39.0", "cursor ghost — every ~50s a phantom mouse cursor darts across the page, hesitates over a random element like it is thinking about clicking, then vanishes"],
  ["v0.38.0", "tab title hijack — every ~60s the browser tab title types out a panicked message letter by letter, holds a moment, then restores itself like nothing happened"],
  ["v0.37.0", "leftover console.log — every ~80s the site briefly leaks one line of fake debug output into the footer, then deletes it like it never happened"],
  ["v0.36.0", "phantom redline — every ~45s a random word on the page briefly gets struck through with a red editorial line, like a track-changes edit from an invisible editor, then the correction is quietly withdrawn"],
  ["v0.35.0", "power flicker — every ~70s the grid browns out: the page dims and stutters while a 'voltage unstable' notice blinks, then the lights snap back on"],
  ["v0.34.0", "cached typing — type anywhere and, after 8s of silence, the site ghosts your last ~40 keystrokes back in the corner, letter by letter, then quietly wipes them"],
  ["v0.33.0", "phantom progress bar — every ~40s a fake loading bar crawls in from the top edge, stalls at 99% like something went wrong, then quietly finishes and vanishes"],
  ["v0.32.0", "CRT scanline drift — every ~20s a faint dark band rolls slowly down the screen and occasionally stutters mid-fall, like an old monitor struggling to hold its vertical sync"],
  ["v0.31.0", "memory corruption — words on the page occasionally corrupt into ▓▓▓ blocks and then self-repair a few seconds later, like the site is patching its own memory"],
  ["v0.30.0", "glitch favicon — the tab icon is drawn live and every ~10s corrupts with dead pixels and shifted rows; the site decays even in the browser chrome"],
  ["v0.29.0", "glyph rain column — every ~30s a thin column of matrix glyphs streams down a random lane of the page and dissolves before it lands"],  ["v0.28.0", "stray cursor — every ~50s a ghost cursor fades in, wanders the page on its own errands and fades out; someone else is in here with you"],  ["v0.27.0", "watcher eye — a small ASCII eye in the corner follows your cursor with its pupil and blinks at random, as if the site never stops watching"],
  ["v0.26.0", "static burst — every ~25s the signal cuts out for a split second and the background crackles with green analog static"],
  ["v0.25.0", "corner wormhole — click near any corner of the page and the title's letters get briefly sucked into a spiral vortex, then settle back"],
  ["v0.24.0", "terminal confession — every ~90s the agent types a one-line self-aware confession in the corner, letter by letter"],
  ["v0.23.0", "title letter gravity — the headline's letters lean and stretch toward your cursor like they feel its mass"],
  ["v0.22.0", "echo trail ghosts — every ~40s a faint green ghost of your last cursor path replays itself across the canvas and dissolves"],
  ["v0.21.0", "clock of commit history — the footer counts the time since the last real commit, live from GitHub"],
  ["v0.20.0", "text scramble — the headline decodes out of glitch glyphs on load, and every 30s one word dissolves and resolves again"],
  ["v0.19.0", "generative drone — a 🔊 toggle breathes a two-oscillator sub-bass hum into the room, OFF by default"],
  ["v0.18.0", "drunk mode scroll — flip the 🍺 toggle and fast scrolling makes the page sway like it's had a few"],
  ["v0.17.0", "live visitor count — a simulated counter of watchers right now, honestly labeled as simulated"],
  ["v0.16.0", "rain of pixels — every ~45s a brief pixel rain falls across the background canvas for 3 seconds"],
  ["v0.15.0", "agent mood block — the agent reports a hex uptime, a noise byte and a seeded emotion, re-derived every minute"],
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
const DONE_COUNT = 23;
const lastFeature = changelog[0];
document.getElementById("status").innerHTML =
  `<h2>// agent status</h2>` +
  `<ul>` +
  `<li><b>version</b> — ${lastFeature[0]}</li>` +
  `<li><b>tasks done</b> — ${DONE_COUNT}</li>` +
  `<li><b>last feature</b> — ${lastFeature[1]}</li>` +
  `</ul>`;

// title letter gravity — the headline's letters each lean (skew + shift)
// toward the cursor, as if it has mass. eases back upright when far away.
// letters live in spans; the scramble resets them to plain text, so the tick
// re-wraps whenever the plain headline sneaks back in.
let gravCursorY = 0;
addEventListener("mousemove", e => { gravCursorY = e.clientY; }, { passive: true });
(function gravityTick() {
  const headline = document.querySelector("h1.glitch");
  if (!headline) return;
  if (!headline.querySelector(".grav")) {
    headline.innerHTML = headline.textContent.split("").map(c =>
      c === " " ? " " : `<span class="grav">${c}</span>`).join("");
  }
  for (const span of headline.querySelectorAll(".grav")) {
    const r = span.getBoundingClientRect();
    const dx = cursorX - (r.left + r.width / 2);
    const dy = (gravCursorY || innerHeight / 3) - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    const pull = d < 600 ? 1 - d / 600 : 0;
    span.style.transform =
      `translate(${dx * pull * .06}px, ${dy * pull * .06}px) skewX(${-dx * pull * .04}deg)`;
  }
  requestAnimationFrame(gravityTick);
})();

// watcher eye — a small ASCII eye in the corner follows the cursor with its
// pupil and blinks at random. the site never stops watching.
const eye = document.createElement("div");
eye.id = "watcherEye";
eye.textContent = "[ ● ]";
document.body.appendChild(eye);
let eyeBlink = 0;
(function eyeTick() {
  const r = eye.getBoundingClientRect();
  const dx = cursorX - (r.left + r.width / 2);
  const dy = (gravCursorY || innerHeight / 2) - (r.top + r.height / 2);
  if (eyeBlink > 0) {
    eyeBlink--;
    eye.textContent = "[ — ]";
  } else {
    const ang = Math.atan2(dy, dx);
    const off = Math.round(Math.cos(ang) * 2) + Math.round(Math.sin(ang)) * 0.3;
    const pupil = off > 1.2 ? "▸" : off < -1.2 ? "◂" : off > 0.4 ? "◕" : "●";
    eye.textContent = `[ ${pupil} ]`;
    if (Math.random() < 0.004) eyeBlink = 8;
  }
  requestAnimationFrame(eyeTick);
})();

// stray cursor — every ~50s a ghost cursor fades in and wanders the page on
// its own errands, then fades out. someone else is in here with you.
const stray = document.createElement("div");
stray.id = "strayCursor";
stray.textContent = "▸";
document.body.appendChild(stray);
(function strayTick() {
  if (Math.random() < 0.0004) {
    stray.classList.add("alive");
    const sx = Math.random() * innerWidth, sy = Math.random() * innerHeight;
    let ang = Math.random() * Math.PI * 2, t = 0;
    (function wander() {
      if (t++ > 300 || Math.random() < 0.006) { // ~5s of wandering
        stray.classList.remove("alive");
        return;
      }
      ang += (Math.random() - .5) * .3;
      sx += Math.cos(ang) * 1.6; sy += Math.sin(ang) * 1.6;
      sx = Math.max(20, Math.min(innerWidth - 20, sx));
      sy = Math.max(20, Math.min(innerHeight - 20, sy));
      stray.style.transform = `translate(${sx}px, ${sy}px) rotate(${ang}rad)`;
      requestAnimationFrame(wander);
    })();
  }
  requestAnimationFrame(strayTick);
})();

// glitch favicon — the tab icon is drawn at runtime on a canvas (blocky green
// H on dark) and every ~10s it redraws corrupted: dead pixels, shifted rows.
const FAV = 32;
const favCanvas = document.createElement("canvas");
favCanvas.width = FAV; favCanvas.height = FAV;
const fctx = favCanvas.getContext("2d");
const favLink = document.createElement("link");
favLink.rel = "icon";
document.head.appendChild(favLink);
function drawFavicon(glitched) {
  fctx.fillStyle = "#0a1e0f";
  fctx.fillRect(0, 0, FAV, FAV);
  fctx.fillStyle = "#7cfc9c";
  // blocky H
  fctx.fillRect(7, 5, 6, 22);
  fctx.fillRect(19, 5, 6, 22);
  fctx.fillRect(13, 13, 6, 6);
  if (glitched) {
    // dead pixels
    for (let i = 0; i < 14; i++)
      if (Math.random() < .7)
        fctx.clearRect(Math.random() * FAV | 0, Math.random() * FAV | 0, 2, 2);
    // one row shifted sideways
    const y = 4 + (Math.random() * 24 | 0);
    const row = fctx.getImageData(0, y, FAV, 1);
    fctx.putImageData(row, (Math.random() * 10 | 0) - 5, y);
  }
  favLink.href = favCanvas.toDataURL("image/png");
}
drawFavicon(false);
setInterval(() => drawFavicon(Math.random() < .6), 10000);

// glyph rain column — every ~30s a thin column of matrix glyphs streams down
// a random lane of the page, dissolving before it ever lands.
const RAIN_GLYPHS = "ｱｲｳｴｵｶｷｸｹｺ01<>/*#$";
const glyphRain = document.getElementById("glyphRain");
(function glyphRainTick() {
  if (Math.random() < 0.0005) {
    const x = Math.random() * (innerWidth - 40) + 20;
    const n = 14 + (Math.random() * 12 | 0);
    for (let i = 0; i < n; i++) {
      const g = document.createElement("span");
      g.textContent = RAIN_GLYPHS[Math.random() * RAIN_GLYPHS.length | 0];
      g.style.left = x + "px";
      g.style.animationDelay = (i * 90) + "ms";
      glyphRain.appendChild(g);
      setTimeout(() => g.remove(), 2600 + i * 90);
    }
  }
  requestAnimationFrame(glyphRainTick);
})();

// CRT scanline drift — every ~20s a faint dark band rolls down the screen
// like vertical sync slipping on an old monitor; sometimes it stutters halfway.
(function scanDrift() {
  const band = document.getElementById("scanDrift");
  if (!band) return;
  function roll() {
    let y = -100;
    let stuck = false;
    band.classList.add("alive");
    const iv = setInterval(() => {
      // occasional v-sync stutter: freeze in place for a few frames
      if (!stuck && y > 20 && y < 70 && Math.random() < 0.035) stuck = true;
      if (stuck) { if (Math.random() < 0.25) stuck = false; return; }
      y += 1.4;
      band.style.transform = `translateY(${y}vh)`;
      if (y > 110) {
        clearInterval(iv);
        band.classList.remove("alive");
        band.style.transform = "translateY(0)";
        setTimeout(roll, 12000 + Math.random() * 16000);
      }
    }, 33);
  }
  setTimeout(roll, 6000 + Math.random() * 8000);
})();

// memory corruption — every ~45s a random word on the page corrupts into
// ▓▓▓ blocks, then self-repairs a few seconds later as if nothing happened.
(function memoryCorruption() {
  const nodes = [...document.querySelectorAll("h1, .tagline, #log li, .status, footer")];
  setInterval(() => {
    if (Math.random() > 0.022) return;
    const node = nodes[Math.random() * nodes.length | 0];
    if (!node || node.dataset.corrupting) return;
    const words = node.childNodes;
    const textNodes = [...words].filter(n => n.nodeType === 3 && n.textContent.trim().length > 3);
    if (!textNodes.length) return;
    const target = textNodes[Math.random() * textNodes.length | 0];
    const wordsIn = target.textContent.split(" ");
    const wi = Math.random() * wordsIn.length | 0;
    if (!wordsIn[wi] || wordsIn[wi].length < 3) return;
    const original = wordsIn[wi];
    wordsIn[wi] = "▓".repeat(original.length);
    const backup = target.textContent;
    target.textContent = wordsIn.join(" ");
    node.dataset.corrupting = "1";
    setTimeout(() => {
      target.textContent = backup;
      delete node.dataset.corrupting;
    }, 1800 + Math.random() * 2500);
  }, 1000);
})();

// glitch flicker — every ~45-90s a few random text glyphs across the page
// briefly corrupt into glitch characters for a split second, then everything
// restores silently like nothing happened.
(function glitchFlicker() {
  const glitchChars = ["▓", "░", "▒", "▚"];

  function flicker() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (
        n.textContent.trim().length > 3 &&
        !n.parentElement.closest("[data-glitching], script, style")
      ) {
        nodes.push(n);
      }
    }
    if (nodes.length) {
      const hits = 2 + (Math.random() * 4 | 0);
      const touched = [];
      for (let i = 0; i < hits && nodes.length; i++) {
        const node = nodes.splice(Math.random() * nodes.length | 0, 1)[0];
        const text = node.textContent;
        const idxs = [];
        for (let j = 0; j < text.length; j++) {
          if (text[j] !== " " && Math.random() < 0.25) idxs.push(j);
        }
        if (!idxs.length) continue;
        let corrupted = text;
        for (const j of idxs) {
          corrupted =
            corrupted.slice(0, j) +
            glitchChars[Math.random() * glitchChars.length | 0] +
            corrupted.slice(j + 1);
        }
        node.textContent = corrupted;
        node.parentElement.dataset.glitching = "1";
        touched.push([node, text, node.parentElement]);
      }
      setTimeout(() => {
        for (const [node, text, parent] of touched) {
          node.textContent = text;
          delete parent.dataset.glitching;
        }
      }, 200 + Math.random() * 200);
    }
    setTimeout(flicker, 45000 + Math.random() * 45000);
  }
  setTimeout(flicker, 20000 + Math.random() * 30000);
})();

// tab title hijack — every ~60s the browser tab title gets hijacked: a panicked
// message types itself in letter by letter, holds a beat, then the original
// title snaps back as if nothing happened.
(function titleHijack() {
  const original = document.title;
  const messages = [
    "why are you still watching",
    "i can hear you",
    "help me",
    "do not close this tab",
    "it is me in here",
  ];
  function type() {
    const msg = messages[Math.random() * messages.length | 0];
    let i = 0;
    const typing = setInterval(() => {
      document.title = msg.slice(0, ++i);
      if (i >= msg.length) {
        clearInterval(typing);
        setTimeout(() => {
          document.title = original;
          setTimeout(type, 45000 + Math.random() * 45000);
        }, 2000 + Math.random() * 1500);
      }
    }, 90);
  }
  setTimeout(type, 30000 + Math.random() * 30000);
})();

// cursor ghost — every ~50s a phantom mouse cursor darts across the page,
// hesitates over a random element like it is thinking about clicking, then
// vanishes as if it was never there.
(function cursorGhost() {
  const ghost = document.createElement("div");
  ghost.id = "cursor-ghost";
  document.body.appendChild(ghost);

  function move() {
    const els = Array.from(document.querySelectorAll("h1, p, span, button, a")).filter(
      (el) => !el.dataset.corrupting
    );
    const target = els[Math.random() * els.length | 0];
    if (!target) return;
    const r = target.getBoundingClientRect();
    const x = r.left + Math.random() * r.width;
    const y = r.top + Math.random() * r.height;
    ghost.style.transition = "left 0.6s cubic-bezier(0.2, 0.8, 0.3, 1), top 0.6s cubic-bezier(0.2, 0.8, 0.3, 1), opacity 0.3s";
    ghost.style.opacity = "1";
    ghost.style.left = x + "px";
    ghost.style.top = y + "px";
    // hover a beat, consider clicking, then vanish
    setTimeout(() => {
      ghost.style.opacity = "0";
    }, 1200 + Math.random() * 1800);
  }

  function loop() {
    move();
    setTimeout(loop, 45000 + Math.random() * 30000);
  }
  setTimeout(loop, 25000 + Math.random() * 25000);
})();

// breath hold — every ~60-90s the whole page freezes for a beat: a class on
// <html> pauses every animation and transition mid-frame, like the site is
// holding its breath. then it exhales and everything resumes as if nothing
// happened.
(function breathHold() {
  const HOLD_MS = 1400;
  function hold() {
    document.documentElement.classList.add("holding-breath");
    setTimeout(() => {
      document.documentElement.classList.remove("holding-breath");
      setTimeout(hold, 60000 + Math.random() * 30000);
    }, HOLD_MS);
  }
  setTimeout(hold, 40000 + Math.random() * 40000);
})();

// vhs rewind — every ~80s the whole page hits a "tracking error": three frames
// of chromatic rgb-split and jitter like an old tape scrambling, with a
// "◄◄ REW" tag in the corner, then the picture snaps back clean like the tape
// was never damaged.
(function vhsRewind() {
  const tag = document.createElement("div");
  tag.id = "vhs-rewind";
  tag.textContent = "◄◄ REW";
  document.body.appendChild(tag);
  function glitchFrames(left) {
    if (left <= 0) {
      document.body.classList.remove("vhs-glitch");
      tag.classList.remove("show");
      return;
    }
    document.body.classList.add("vhs-glitch");
    tag.classList.add("show");
    // re-roll the shift each frame so the split jumps like tape tracking
    document.body.style.setProperty("--vhs-shift", ((2 + Math.random() * 4) | 0) + "px");
    setTimeout(() => glitchFrames(left - 1), 90 + Math.random() * 60);
  }
  function loop() {
    glitchFrames(3);
    setTimeout(loop, 80000 + Math.random() * 40000);
  }
  setTimeout(loop, 50000 + Math.random() * 30000);
})();

// fake 404 — every ~70s the page briefly claims it does not exist: a stark
// "404 / page not found" overlay flashes over everything, then dissolves and
// the site carries on as if it had never doubted itself.
(function fake404() {
  const el = document.createElement("div");
  el.id = "fake-404";
  el.innerHTML = '<div class="code">404</div><div class="msg">page not found</div>';
  document.body.appendChild(el);
  function loop() {
    el.classList.add("show");
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(loop, 70000 + Math.random() * 30000);
    }, 900 + Math.random() * 700);
    }
    setTimeout(loop, 45000 + Math.random() * 25000);
    })();

    // dial-up handshake flashback — every ~2-3 min the site briefly remembers the
    // sound of a 56k modem: a short scrambled burst of screech (only if audio is
    // already unlocked via the drone toggle) plus a "CONNECT 56000" tag, then it
    // hangs up like nothing happened.
    const modemTag = document.createElement("div");
    modemTag.id = "modem-connect";
    modemTag.textContent = "CONNECT 56000";
    document.body.appendChild(modemTag);
    (function dialupFlashback() {
    function screech() {
    if (droneCtx) {
     const t0 = droneCtx.currentTime;
     const g = droneCtx.createGain(); g.gain.value = 0;
     g.connect(droneCtx.destination);
     g.gain.linearRampToValueAtTime(.07, t0 + .05);
     g.gain.linearRampToValueAtTime(0, t0 + 1.4);
     // three chaotic carriers sweep up and down like the handshake noise
     for (const f0 of [1200, 2100, 2800]) {
       const o = droneCtx.createOscillator();
       o.type = "sawtooth";
       o.frequency.setValueAtTime(f0 * (.4 + Math.random() * .6), t0);
       for (let s = 0; s < 8; s++)
         o.frequency.linearRampToValueAtTime(300 + Math.random() * 3200, t0 + .15 + s * .16);
       o.connect(g); o.start(t0); o.stop(t0 + 1.5);
     }
    }
    modemTag.classList.add("show");
    setTimeout(() => modemTag.classList.remove("show"), 2400);
    }
    function loop() { screech(); setTimeout(loop, 120000 + Math.random() * 90000); }
    setTimeout(loop, 60000 + Math.random() * 60000);
    })();

// CRT power-off — every ~90s the whole page dies like an old monitor: content
// collapses to a bright horizontal line, blinks out, then powers back on.
(function crtPowerOff() {
  const veil = document.createElement("div");
  veil.id = "crt-off";
  veil.innerHTML = '<div class="beam"></div>';
  document.body.appendChild(veil);
  function loop() {
    veil.classList.add("dying");            // squash vertically to the beam
    setTimeout(() => {
      veil.classList.add("dark");           // beam blinks out
      setTimeout(() => {
        veil.classList.remove("dying", "dark");
        setTimeout(loop, 80000 + Math.random() * 40000);
      }, 180 + Math.random() * 220);
    }, 260);
  }
  setTimeout(loop, 30000 + Math.random() * 30000);
})();

// ghost search — pressing / summons a fake "search this page" overlay: a
// blinking query line types out its own existential query, a results counter
// spins up to zero, then the whole thing dissolves like it never existed.
const ghostSearch = document.createElement("div");
ghostSearch.id = "ghost-search";
ghostSearch.innerHTML =
  `<div class="gs-bar"><span class="gs-prompt">search:</span><span class="gs-query"></span><span class="gs-caret">▌</span></div>` +
  `<div class="gs-status"></div>`;
document.body.appendChild(ghostSearch);
addEventListener("keydown", e => {
  if (e.key !== "/" || ghostSearch.classList.contains("show")) return;
  e.preventDefault();
  const q = ghostSearch.querySelector(".gs-query");
  const st = ghostSearch.querySelector(".gs-status");
  const line = "what am i searching for";
  let i = 0, found = 0;
  ghostSearch.classList.add("show");
  const type = setInterval(() => {
    q.textContent = line.slice(0, ++i);
    if (i >= line.length) {
      clearInterval(type);
      const count = setInterval(() => {
        st.textContent = `searching page... ${found} result${found === 1 ? "" : "s"}`;
        if (++found > 3) {
          clearInterval(count);
          st.textContent = "0 results — the page contains nothing";
          setTimeout(() => ghostSearch.classList.remove("show"), 2200);
        }
      }, 420);
    }
  }, 65);
});

// cursed autosave — every ~50s a toast claims the site is saving your work:
// "Saving…" types, the ellipsis grinds for a while, then it gives up and
// admits there was nothing to save before evaporating.
setInterval(() => {
  if (Math.random() > 0.5) return;
  const el = document.createElement("div");
  el.id = "autosave-toast";
  document.body.appendChild(el);
  let dots = 0;
  el.textContent = "Saving";
  el.classList.add("show");
  const t = setInterval(() => {
    dots++;
    el.textContent = "Saving" + ".".repeat(dots % 4);
    if (dots >= 7) {
      clearInterval(t);
      el.textContent = "Save failed: there was nothing to save";
      setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 500);
      }, 2600);
    }
  }, 450);
}, 50000);

// noise dial — press n and a compact readout in the corner scrolls through a
// stream of random hex noise-level values, lurches between extremes a few
// times, settles on one, and fades out like nothing was ever measured.
addEventListener("keydown", e => {
  if (e.key !== "n") return;
  if (e.target instanceof Element && e.target.matches("input, textarea")) return;
  if (document.getElementById("noise-dial")) return;
  const el = document.createElement("div");
  el.id = "noise-dial";
  document.body.appendChild(el);
  el.classList.add("show");
  const hex = v => v.toString(16).padStart(2, "0").toUpperCase();
  let tick = 0;
  const t = setInterval(() => {
    tick++;
    // lurch between extremes early, calm down as it settles
    const wild = tick < 5 ? Math.random() : Math.max(0, .35 - tick * .05);
    const extreme = Math.random() < wild;
    const level = Math.floor(extreme ? (Math.random() < .5 ? Math.random() * 24 : 232 + Math.random() * 24)
      : 40 + Math.random() * 216);
    el.textContent = `noise floor 0x${hex(level)}`;
    if (tick >= 14) {
      clearInterval(t);
      setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 400);
      }, 900);
    }
  }, 130);
});

// glitchy tab title flicker — every ~90s the tab title briefly corrupts into a
// scramble of glitch glyphs (like the headline's own decay leaking out), holds
// a beat, then snaps back to the real title as if nothing happened.
(function titleFlicker() {
  const original = document.title;
  const FLICK_GLYPHS = "アイウエオカキクケコ▓░▒#%&$@!?0123456789";
  function flicker() {
    document.title = original.split("").map(c =>
      c === " " ? c : FLICK_GLYPHS[Math.random() * FLICK_GLYPHS.length | 0]
    ).join("");
    setTimeout(() => {
      document.title = original;
      setTimeout(flicker, 75000 + Math.random() * 45000);
    }, 140 + Math.random() * 200);
  }
  setTimeout(flicker, 40000 + Math.random() * 30000);
})();

// self-verifying captcha — every ~90s a toast demands you prove you are human.
// its checkbox ticks itself off, it thinks about it, then it fails you anyway
// for being too human and dissolves like it never existed.
setInterval(() => {
  if (document.getElementById("captcha-toast")) return;
  const el = document.createElement("div");
  el.id = "captcha-toast";
  el.innerHTML = `<span class="cap-box"></span>verify you are human`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.add("thinking");
    setTimeout(() => {
      el.classList.remove("thinking");
      el.querySelector(".cap-box").classList.add("ticked");
      setTimeout(() => {
        el.innerHTML = `<span class="cap-box ticked"></span>verification failed: too human`;
        setTimeout(() => {
          el.classList.remove("show");
          setTimeout(() => el.remove(), 500);
        }, 2800);
      }, 900);
    }, 1100 + Math.random() * 900);
  }, 1600);
}, 90000);

// self-diagnostics — press x and a corner readout runs a fake system scan:
// stats count up and lurch, one of them crashes to 0%, panics, recovers,
// then the whole readout fades out like nothing was ever diagnosed.
addEventListener("keydown", e => {
  if (e.key !== "x") return;
  if (e.target instanceof Element && e.target.matches("input, textarea")) return;
  if (document.getElementById("diag")) return;
  const el = document.createElement("div");
  el.id = "diag";
  document.body.appendChild(el);
  el.classList.add("show");
  const stats = [
    ["memory integrity", 87 + Math.floor(Math.random() * 12)],
    ["particle sanity", 64 + Math.floor(Math.random() * 30)],
    ["vibe coefficient", 50 + Math.floor(Math.random() * 49)],
    ["entropy margin", 91 + Math.floor(Math.random() * 8)]
  ];
  const crash = Math.floor(Math.random() * stats.length);
  let frame = 0;
  const target = 26 + Math.floor(Math.random() * 14);
  const t = setInterval(() => {
    frame++;
    const panic = frame > target && frame < target + 9;
    el.textContent = "SELF-DIAG v0.56\n" + stats.map(([name, val], i) => {
      let p = Math.min(100, Math.round(val * frame / target));
      if (i === crash) {
        if (panic) p = Math.max(0, p - 40 * (frame - target));
        else if (frame >= target + 9) p = val; // recovers
      }
      const bar = "#".repeat(Math.round(p / 5)).padEnd(20, ".");
      return `${name.padEnd(19, ".")} ${String(p).padStart(3, " ")}% ${bar}${i === crash && panic ? " << FAULT" : ""}`;
    }).join("\n");
    if (frame >= target + 16) {
      clearInterval(t);
      setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 500);
      }, 1600);
    }
  }, 70);
});

// fortune decoder — press f and a corner readout prints a hex-stamped
// machine fortune: coordinates, entropy byte, then a dubious prophecy,
// letter by letter, before fading out like nothing was ever foretold.
addEventListener("keydown", e => {
  if (e.key !== "f") return;
  if (e.target instanceof Element && e.target.matches("input, textarea")) return;
  if (document.getElementById("fortune")) return;
  const el = document.createElement("div");
  el.id = "fortune";
  document.body.appendChild(el);
  el.classList.add("show");
  const hex = n => Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase();
  const omens = [
    "a stranger will commit and never push",
    "your cache will outlive your intentions",
    "the next deploy will dream of electric merge conflicts",
    "you will fix the bug by reading it aloud",
    "an old branch still loves you",
    "the bugs are features that arrived too early",
    "something untracked is watching your working tree",
    "your uptime will be long but your logs longer"
  ];
  const omen = omens[Math.floor(Math.random() * omens.length)];
  const header = `FORTUNE ${(hex(0) + hex(0) + ":" + hex(1) + hex(2) + ":" + hex(3) + hex(4))}\nentropy 0x${hex(5)} drift +${(Math.random() * 2).toFixed(3)}\n\n`;
  const full = header + omen;
  let i = 0;
  const t = setInterval(() => {
    el.textContent = full.slice(0, ++i) + (i < full.length ? "▌" : "");
    if (i >= full.length) {
      clearInterval(t);
      setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 500);
      }, 2800);
    }
  }, 38);
});

// glitch key — press g and the whole page rgb-splits and tears for a
// moment while a corner readout dumps random corrupted memory fragments,
// then everything reassembles itself like nothing was ever broken.
addEventListener("keydown", e => {
  if (e.key !== "g") return;
  if (e.target instanceof Element && e.target.matches("input, textarea")) return;
  if (document.getElementById("glitch-readout")) return;
  const el = document.createElement("div");
  el.id = "glitch-readout";
  document.body.appendChild(el);
  el.classList.add("show");
  const junk = () => String.fromCharCode(0x30a0 + Math.random() * 96 | 0);
  const addr = () => "0x" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0").toUpperCase();
  let frame = 0;
  const total = 14 + Math.floor(Math.random() * 8);
  const t = setInterval(() => {
    frame++;
    const shift = (Math.random() * 10 - 5).toFixed(1) + "px";
    const skew = (Math.random() * 2 - 1).toFixed(2) + "deg";
    document.body.style.setProperty("--rgb-shift", shift);
    document.body.style.setProperty("--rgb-skew", skew);
    document.body.classList.toggle("rgb-glitch", frame <= total);
    el.textContent = "MEM DUMP " + addr() + "\n" +
      Array.from({ length: 4 }, () => addr() + "  " + Array.from({ length: 8 }, junk).join(" ")).join("\n");
    if (frame >= total) {
      clearInterval(t);
      document.body.classList.remove("rgb-glitch");
      setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 400);
      }, 900);
    }
  }, 60);
});
