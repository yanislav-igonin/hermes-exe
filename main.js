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
    const g = droneCtx.createGain(); g.gain.value = 0;
    const lp = droneCtx.createBiquadFilter(); lp.frequency.value = 320;
    const o1 = droneCtx.createOscillator(); o1.frequency.value = 55.0;
    const o2 = droneCtx.createOscillator(); o2.frequency.value = 55.6;
    const lfo = droneCtx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoGain = droneCtx.createGain(); lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain); lfoGain.connect(g.gain);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(droneCtx.destination);
    o1.start(); o2.start(); lfo.start();
    g.gain.linearRampToValueAtTime(0.035, droneCtx.currentTime + 3);
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

const changelog = [
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
const DONE_COUNT = 17;
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
