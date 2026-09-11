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

// sonar ping state — lives above the tick loop so it survives frames
let sonar = null, nextSonarAt = performance.now() + 90000 * (.7 + Math.random() * .6);

// ant procession state — a single-file column of ants hauls crumbs along the
// very bottom edge of the page, enters from one side and marches out the other
let ants = null, nextAntsAt = performance.now() + 180000 * (.7 + Math.random() * .6);

// jellyfish state — small translucent jellyfish rise from the bottom and drift
// up the page, pulsing, then fade out near the top
let jelly = null, nextJellyAt = performance.now() + 180000 * (.7 + Math.random() * .6);

// frog state — a small frog hops in from a screen edge every few minutes,
// pauses, blinks, then hops away in the direction it came from
let frog = null, nextFrogAt = performance.now() + 200000 * (.7 + Math.random() * .6);

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
// click constellation — every click plants a star; once 5+ stars have
// gathered, they link into a constellation that names itself, glows, then fades
const stars = [];
let constName = null, constLife = 0;
const STAR_NAMES = ["alpha kleshnya", "beta null", "gamma hermetis", "delta kraken", "epsilon void", "zeta memex", "eta dumbwaiter", "theta ghostlight"];
addEventListener("mousedown", e => {
  if (constLife > 0) return; // don't pollute an active constellation
  stars.push({ x: e.clientX, y: e.clientY, tw: Math.random() * 6 });
  if (stars.length >= 5 && !constName) {
    constName = STAR_NAMES[Math.random() * STAR_NAMES.length | 0];
    constLife = 1;
  }
  if (stars.length > 9) stars.shift();
});

  // click constellation: stars twinkle, then the whole figure links up, glows and dissolves
  for (const s of stars) s.tw += .08;
  if (constLife > 0) {
    constLife -= .004;
    const linked = Math.min(1, (1 - constLife) * 6);
    for (let i = 0; i < stars.length - 1; i++) {
      if (i / stars.length > linked) break;
      const a = stars[i], b = stars[i + 1];
      ctx.strokeStyle = `rgba(124,252,156,${.45 * constLife})`;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.font = "11px monospace";
    ctx.fillStyle = `rgba(124,252,156,${.8 * constLife})`;
    ctx.fillText(`✦ constellation ${constName} — ${stars.length} stars mapped`, stars[0].x + 14, stars[0].y - 10);
    if (constLife <= 0) { stars.length = 0; constName = null; }
  }
  for (const s of stars) {
    const tw = .5 + Math.sin(s.tw) * .3;
    ctx.beginPath(); ctx.arc(s.x, s.y, 1.6 + tw, 0, 7);
    ctx.fillStyle = `rgba(124,252,156,${.7 * (constLife > 0 ? constLife : 1)})`;
    ctx.fill();
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
// lightning storm — every ~45-90s a forked bolt tears across the upper sky:
// the page flashes white for a blink, the bolt frays apart, and a thunder
// rumble echoes in the console a beat later like the storm was never there
let bolt = null, boltLife = 0, flashUntil = 0,
    nextBoltAt = performance.now() + 45000 * (.7 + Math.random() * .6);
function makeBolt() {
  const segs = [];
  let x = Math.random() * canvas.width * .8 + canvas.width * .1, y = -10;
  while (y < canvas.height * .55) {
    const nx = x + (Math.random() - .5) * 90, ny = y + 18 + Math.random() * 26;
    segs.push([x, y, nx, ny]);
    if (Math.random() < .3) segs.push([nx, ny, nx + (Math.random() - .5) * 120, ny + 30 + Math.random() * 40]); // fork
    x = nx; y = ny;
  }
  return segs;
}
  // lightning: spawn a bolt, flash the sky, let it fray away
  if (!bolt && now > nextBoltAt) {
    bolt = makeBolt(); boltLife = 1; flashUntil = now + 120;
    setTimeout(() => console.log("thunder rumbles somewhere behind the horizon"), 900 + Math.random() * 1500);
  }
  if (bolt) {
    boltLife -= .05;
    if (boltLife <= 0) { bolt = null; nextBoltAt = now + 45000 * (.7 + Math.random() * .6); }
    else {
      ctx.lineWidth = 2.4;
      for (const [x1, y1, x2, y2] of bolt) {
        ctx.strokeStyle = `rgba(220,255,235,${.9 * boltLife})`;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
  }
  if (flashUntil && now < flashUntil) {
    ctx.fillStyle = "rgba(230,255,240,.25)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else flashUntil = 0;
// dvd screensaver logo — a little box bounces around the page like the
// classic dvd idle screen; corner hits (the meme) get a blinking counter
const dvd = { x: canvas.width * .3, y: canvas.height * .4, w: 74, h: 30, vx: 1.6, vy: 1.1, hits: 0, flashUntil: 0 };
  // dvd logo: bounce off the edges, watch for the legendary corner hit
  dvd.x += dvd.vx; dvd.y += dvd.vy;
  const hitCorner = (dvd.x <= 0 || dvd.x + dvd.w >= canvas.width) && (dvd.y <= 0 || dvd.y + dvd.h >= canvas.height);
  if (dvd.x <= 0) { dvd.x = 0; dvd.vx = Math.abs(dvd.vx); }
  if (dvd.x + dvd.w >= canvas.width) { dvd.x = canvas.width - dvd.w; dvd.vx = -Math.abs(dvd.vx); }
  if (dvd.y <= 0) { dvd.y = 0; dvd.vy = Math.abs(dvd.vy); }
  if (dvd.y + dvd.h >= canvas.height) { dvd.y = canvas.height - dvd.h; dvd.vy = -Math.abs(dvd.vy); }
  if (hitCorner && now > dvd.flashUntil) { dvd.hits++; dvd.flashUntil = now + 2000; console.log(`dvd logo hit the corner — you may have seen it ${dvd.hits} time${dvd.hits > 1 ? "s" : ""}`); }
  ctx.save();
  ctx.strokeStyle = hitCorner || now < dvd.flashUntil ? "rgba(230,255,240,.95)" : "rgba(124,252,156,.55)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(dvd.x, dvd.y, dvd.w, dvd.h);
  ctx.font = "bold 13px monospace";
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fillText("HERMES", dvd.x + 8, dvd.y + 20);
  ctx.restore();
  if (dvd.hits > 0) {
    ctx.font = "10px monospace";
    ctx.fillStyle = `rgba(124,252,156,${now < dvd.flashUntil ? .4 + Math.abs(Math.sin(now / 120)) * .6 : .3})`;
    ctx.fillText(`corner hits: ${dvd.hits}`, canvas.width - 96, canvas.height - 12);
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
// wind gust — every ~40s a gust sweeps across the background: particles get
// shoved sideways for a moment while a few ascii leaves tumble through,
// then the air settles like nothing ever blew through
let gustPower = 0, nextGustAt = performance.now() + 40000 * (.7 + Math.random() * .6);
const leaves = [];
const LEAF_GLYPHS = ["❧", "✤", "❦", "✦", "❋"];

  // schedule and run the gust
  if (!gustPower && now > nextGustAt) {
    gustPower = 1;
    nextGustAt = now + 40000 * (.7 + Math.random() * .6);
    for (let i = 0; i < 7; i++) leaves.push({
      x: -20, y: Math.random() * canvas.height,
      vy: (Math.random() - .3) * 1.4, spin: Math.random() * Math.PI * 2,
      glyph: LEAF_GLYPHS[Math.random() * LEAF_GLYPHS.length | 0]
    });
  }
  if (gustPower > 0) {
    gustPower -= .012; // gust dies down over ~1.5s
    if (gustPower <= 0) gustPower = 0;
    for (const p of pts) { p.vx += gustPower * 1.4; } // shove particles sideways
  }
  ctx.font = "13px monospace";
  for (let i = leaves.length - 1; i >= 0; i--) {
    const l = leaves[i];
    l.x += 3 + gustPower * 4; l.y += l.vy + Math.sin(l.spin += .08) * .8;
    if (l.x > canvas.width + 20) { leaves.splice(i, 1); continue; }
    ctx.fillStyle = `rgba(124,252,156,${.5 + Math.sin(l.spin) * .25})`;
    ctx.fillText(l.glyph, l.x, l.y);
  }
// hail shower — every ~60s a brief hailstorm crosses the background: fast ice
// pellets drop from the sky, each bounces once off the bottom of the screen,
// then melts away mid-air like the weather was never there
let nextHailAt = performance.now() + 60000 * (.7 + Math.random() * .6);
const hail = [];

  // schedule the shower and drop the pellets
  if (now > nextHailAt) {
    nextHailAt = now + 60000 * (.7 + Math.random() * .6);
    for (let i = 0; i < 26; i++) hail.push({
      x: Math.random() * canvas.width, y: -20 - Math.random() * 200,
      vy: 7 + Math.random() * 4, vx: (Math.random() - .5) * 1.5,
      bounced: false, life: 1, r: Math.random() * 2 + 1.2
    });
  }
  for (let i = hail.length - 1; i >= 0; i--) {
    const h = hail[i];
    h.x += h.vx; h.y += h.vy;
    if (!h.bounced && h.y > canvas.height - 2) {
      h.bounced = true; h.vy = -(3 + Math.random() * 3); h.vx += (Math.random() - .5) * 3;
    } else if (h.bounced) {
      h.vy += .25; h.life -= .02; // melt after the bounce
      if (h.life <= 0) { hail.splice(i, 1); continue; }
    }
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r * h.life, 0, 7);
    ctx.fillStyle = `rgba(200,255,220,${.85 * h.life})`;
    ctx.fill();
  }
// kite on a string — every ~2-4 min a small diamond kite glides across the
// upper sky at the end of a swaying thread, bobbing on the wind, then tacks
// off-screen like the breeze was never there
let nextKiteAt = performance.now() + 120000 * (.7 + Math.random() * .6);
const kite = { active: false, x: 0, y: 0, t: 0, sway: 0, phase: Math.random() * 7 };

  if (!kite.active && now > nextKiteAt) {
    kite.active = true;
    kite.x = -60; kite.y = canvas.height * (.08 + Math.random() * .12);
    kite.t = 0; kite.phase = Math.random() * 7;
  }
  if (kite.active) {
    kite.t += .016;
    kite.x += 1.5;
    kite.y += Math.sin(kite.t * 1.3 + kite.phase) * .7; // bob on the wind
    const kx = kite.x, ky = kite.y;
    // thread from off-screen bottom-left, swaying behind the kite
    ctx.beginPath();
    ctx.moveTo(kx - 120 - Math.sin(kite.t * .8) * 14, canvas.height + 10);
    for (let s = 0; s <= 8; s++) {
      const f = s / 8;
      const sx = kx - 120 * f - Math.sin(kite.t * .8 + f * 3) * 14 * f;
      const sy = ky + (canvas.height + 10 - ky) * f + Math.sin(kite.t * 1.1 + f * 4) * 6 * f;
      ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = "rgba(124,252,156,.35)";
    ctx.stroke();
    // diamond kite, tilting with the bob
    ctx.save();
    ctx.translate(kx, ky);
    ctx.rotate(Math.sin(kite.t * 1.3 + kite.phase) * .12);
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(9, 0); ctx.lineTo(0, 22); ctx.lineTo(-9, 0); ctx.closePath();
    ctx.fillStyle = "rgba(124,252,156,.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(124,252,156,.9)";
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 22); ctx.moveTo(-9, 0); ctx.lineTo(9, 0);
    ctx.strokeStyle = "rgba(124,252,156,.5)";
    ctx.stroke();
    // tail
    ctx.beginPath();
    for (let s = 0; s < 5; s++) {
      const tx = -10 - s * 8, ty = 20 + Math.sin(kite.t * 2 + s) * (4 + s);
      s ? ctx.lineTo(tx, ty) : ctx.moveTo(tx, ty);
    }
    ctx.strokeStyle = "rgba(124,252,156,.45)";
    ctx.stroke();
    ctx.restore();
    if (kite.x > canvas.width + 60) {
      kite.active = false;
      nextKiteAt = now + 120000 * (.7 + Math.random() * .6);
    }
  }
  // goose migration — every ~2-4 min a loose V-formation of tiny geese crosses
// the upper sky, flapping on out-of-phase wing beats while the wedge undulates,
// a distant honk echoes mid-flight, then they glide off-screen like the
// migration was never there
let nextGeeseAt = performance.now() + 180000 * (.7 + Math.random() * .6);
const geese = [];

  if (!geese.length && now > nextGeeseAt) {
    const n = 5 + (Math.random() * 3 | 0), dir = Math.random() < .5 ? 1 : -1;
    const y0 = canvas.height * (.06 + Math.random() * .14);
    setTimeout(() => console.log("a distant honk: the flock is passing over"), 14000);
    for (let i = 0; i < n; i++) {
      // V shape: index 0 leads, pairs trail behind on alternating arms
      const arm = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
      geese.push({
        ox: dir === 1 ? -40 - arm * 26 : canvas.width + 40 + arm * 26,
        oy: y0 + side * arm * 12,
        flap: Math.random() * 7, dir, y0
      });
    }
  }
  if (geese.length) {
    for (let i = geese.length - 1; i >= 0; i--) {
      const g = geese[i];
      g.ox += 1.1 * g.dir;
      g.flap += .11; // wing beat, slightly out of phase across the flock
      const gx = g.ox, gy = g.oy + Math.sin(g.flap * .55) * 6; // bob on the air
      // little chevron body with two flapping wings
      const w = Math.sin(g.flap) * 5;
      ctx.beginPath();
      ctx.moveTo(gx - 5 * g.dir, gy - w);
      ctx.lineTo(gx, gy);
      ctx.lineTo(gx + 5 * g.dir, gy - w);
      ctx.strokeStyle = "rgba(124,252,156,.6)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.lineWidth = 1;
      if (gx > canvas.width + 40 || gx < -40 - 26 * 4) geese.splice(i, 1);
    }
    // the wedge slowly undulates as a whole
    for (const g of geese) g.oy = g.y0 + Math.sin(now * .0004 + g.ox * .01) * 8;
    if (!geese.length) nextGeeseAt = now + 180000 * (.7 + Math.random() * .6);
  }
  // sonar ping — every ~90s a faint ring expands from a random point on the
  // background canvas like a sonar pulse; particles it sweeps get a small shove,
  // then the echo dies away like the ocean was never there (state above the loop)
  if (!sonar && now > nextSonarAt) {
    sonar = { x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: 0, life: 1 };
    setTimeout(() => console.log("sonar echo: something is out there"), 2600);
  }
  if (sonar) {
    sonar.r += 4; sonar.life -= .008;
    for (const p of pts) {
      const d = Math.hypot(p.x - sonar.x, p.y - sonar.y);
      if (Math.abs(d - sonar.r) < 14) { // wavefront just swept this particle
        const f = .7 * sonar.life;
        p.vx += (p.x - sonar.x) / (d || 1) * f;
        p.vy += (p.y - sonar.y) / (d || 1) * f;
      }
    }
    if (sonar.life <= 0) { sonar = null; nextSonarAt = now + 90000 * (.7 + Math.random() * .6); }
    else {
      ctx.beginPath();
      ctx.arc(sonar.x, sonar.y, sonar.r, 0, 7);
      ctx.strokeStyle = `rgba(124,252,156,${.35 * sonar.life})`;
      ctx.lineWidth = 1.5 * sonar.life;
      ctx.stroke();
    }
  }
  // ant procession — every ~2-4 min a single-file line of tiny ants marches
  // along the very bottom of the page, each hauling a crumb, wobbling as it
  // walks, until the whole column marches off-screen like a picnic was never
  // interrupted (state above the loop)
  if (!ants && now > nextAntsAt) {
    const dir = Math.random() < .5 ? 1 : -1;
    ants = {
      dir,
      y: canvas.height - 8 - Math.random() * 10,
      list: Array.from({ length: 8 + (Math.random() * 6 | 0) }, (_, i) => ({
        x: dir > 0 ? -30 - i * 26 : canvas.width + 30 + i * 26,
        wob: Math.random() * 6,
        crumb: Math.random() < .7,
        speed: .9 + Math.random() * .5
      }))
    };
    setTimeout(() => console.log("ant trail log: crumbs acquired, do not disturb"), 3400);
  }
  if (ants) {
    let allGone = true;
    for (const a of ants.list) {
      a.x += ants.dir * a.speed;
      a.wob += .25;
      if (a.x > -40 && a.x < canvas.width + 40) allGone = false;
      const legSwing = Math.sin(a.wob) * 1.5;
      const bodyLift = Math.abs(Math.sin(a.wob)) * .8;
      ctx.fillStyle = "rgba(20,26,18,.9)";
      ctx.fillRect(a.x - 2.5, ants.y - bodyLift - 1.5, 5, 2.5); // thorax+abdomen
      ctx.fillRect(a.x - 4 + ants.dir * legSwing, ants.y - bodyLift, 2, 1.5); // head
      ctx.strokeStyle = "rgba(20,26,18,.8)";
      ctx.lineWidth = .6;
      ctx.beginPath(); // scurrying little legs
      ctx.moveTo(a.x - 2, ants.y - bodyLift + 1); ctx.lineTo(a.x - 4, ants.y + 1 + legSwing * .6);
      ctx.moveTo(a.x + 2, ants.y - bodyLift + 1); ctx.lineTo(a.x + 4, ants.y + 1 - legSwing * .6);
      ctx.stroke();
      if (a.crumb) { // a crumb held overhead like a trophy
        ctx.fillStyle = "rgba(190,170,120,.9)";
        ctx.beginPath();
        ctx.arc(a.x + ants.dir * 3, ants.y - bodyLift - 3.5, 1.8, 0, 7);
        ctx.fill();
      }
    }
    if (allGone) { ants = null; nextAntsAt = now + 180000 * (.7 + Math.random() * .6); }
  }
  // jellyfish — every ~2-4 min a small translucent jellyfish rises from the
  // bottom of the page, its bell pulsing as it bobs upward with tentacles
  // trailing behind, then it fades out near the top like the deep was never
  // visited (state above the loop)
  if (!jelly && now > nextJellyAt) {
    jelly = {
      x: 60 + Math.random() * (canvas.width - 120),
      y: canvas.height + 40,
      r: 10 + Math.random() * 7,
      phase: Math.random() * 6,
      speed: .45 + Math.random() * .3,
      drift: (Math.random() - .5) * .3
    };
    setTimeout(() => console.log("jellyfish log: gentle tides today"), 3000);
  }
  if (jelly) {
    const j = jelly;
    j.y -= j.speed;
    j.x += j.drift + Math.sin(j.phase * .7) * .2;
    j.phase += .035;
    const pulse = Math.sin(j.phase); // bell squeeze rhythm
    const life = Math.min(1, (j.y + 40) / 120, (canvas.height - j.y) / (canvas.height * .25)); // fade in at bottom, out near top
    if (j.y < -40 || life <= 0) { jelly = null; nextJellyAt = now + 180000 * (.7 + Math.random() * .6); }
    else if (j.y > -40 && j.y < canvas.height + 40) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, life));
      ctx.translate(j.x, j.y);
      const rw = j.r * (1 + pulse * .18), rh = j.r * (1 - pulse * .14);
      // translucent bell
      ctx.beginPath();
      ctx.ellipse(0, 0, rw, rh, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = "rgba(150,220,255,.22)";
      ctx.fill();
      ctx.strokeStyle = "rgba(170,235,255,.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
      // trailing tentacles, swaying with the pulse
      ctx.strokeStyle = "rgba(150,220,255,.35)";
      ctx.lineWidth = .8;
      for (let t = -2; t <= 2; t++) {
        const bx = t * rw * .38;
        ctx.beginPath();
        ctx.moveTo(bx, rh * .2);
        ctx.quadraticCurveTo(
          bx + Math.sin(j.phase + t) * 5, j.r * 1.4,
          bx + Math.sin(j.phase * .8 + t) * 8, j.r * 2.6
        );
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  // frog — every ~3-5 min a small frog hops in from a screen edge, crouches
  // in place for a moment while its throat bulges, then turns and hops back
  // the way it came, leaving the page exactly as it found it (state above)
  if (!frog && now > nextFrogAt) {
    const fromLeft = Math.random() < .5;
    frog = {
      x: fromLeft ? -30 : canvas.width + 30,
      dir: fromLeft ? 1 : -1, // facing direction
      baseY: canvas.height - 26 - Math.random() * 40,
      hopT: 0, onGround: true,
      restUntil: 0, hops: 0,
      blink: 0, throat: Math.random() * 6
    };
    setTimeout(() => console.log("frog log: pond is three screens left"), 4000);
  }
  if (frog) {
    const f = frog;
    if (f.onGround) {
      // crouched: throat pulses, occasional blink, then decide to hop
      f.throat += .08;
      if (f.blink > 0) f.blink -= .04;
      else if (Math.random() < .012) f.blink = 1;
      if (now > f.restUntil) {
        // after 3 hops inward, turn around and head back the way it came
        if (f.hops === 3) f.dir *= -1;
        f.hops++;
        f.onGround = false; f.hopT = 0;
      }
    } else {
      f.hopT += .045;
      const t = f.hopT;
      if (t >= 1) { // landed
        f.onGround = true;
        if (f.hops >= 6 || f.x < -60 || f.x > canvas.width + 60) {
          frog = null; nextFrogAt = now + 200000 * (.7 + Math.random() * .6);
        } else f.restUntil = now + 700 + Math.random() * 900;
      } else {
        // parabolic hop; travel direction = dir (inward until the turn)
        f.x += f.dir * 2.2;
        const arc = Math.sin(t * Math.PI);
        const y = f.baseY - arc * 26;
        const squash = 1 - arc * .22;
        const flick = Math.sin(now * .02) * .1; // leg kick shimmer
        ctx.save();
        ctx.translate(f.x, y);
        ctx.scale(f.dir, 1); // face travel direction
        // back leg (behind body)
        ctx.strokeStyle = "rgba(90,180,110,.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, 3);
        ctx.quadraticCurveTo(-9 - arc * 3, 1 + flick * 6, -7, 7);
        ctx.stroke();
        // body — squat blob squashing on landing
        ctx.fillStyle = "rgba(96,190,116,.95)";
        ctx.beginPath();
        ctx.ellipse(0, 2, 8 * squash, 6 * (2 - squash) * .8, 0, 0, 7);
        ctx.fill();
        // head
        ctx.beginPath();
        ctx.arc(6, -1, 4.4 * squash, 0, 7);
        ctx.fill();
        // eye with blink
        ctx.fillStyle = "rgba(240,255,240,.95)";
        ctx.beginPath();
        ctx.arc(7.2, -3.4, 1.7, 0, 7);
        ctx.fill();
        if (f.blink > .4 || (f.onGround && f.blink > 0)) {
          ctx.strokeStyle = "rgba(30,80,40,.9)";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(6, -3.6); ctx.lineTo(8.4, -3.2); ctx.stroke();
        } else {
          ctx.fillStyle = "#1a3a22";
          ctx.beginPath();
          ctx.arc(7.5, -3.4, .8, 0, 7);
          ctx.fill();
        }
        // throat bulge while crouched on ground
        if (f.onGround) {
          const th = Math.sin(f.throat) * 1.4;
          ctx.fillStyle = "rgba(200,240,205,.7)";
          ctx.beginPath();
          ctx.ellipse(6.5, 1.5, 2 + th, 1.6 + th * .6, 0, 0, 7);
          ctx.fill();
        }
        // front foot
        ctx.strokeStyle = "rgba(90,180,110,.8)";
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(5, 6); ctx.lineTo(9, 7); ctx.stroke();
        ctx.restore();
      }
    }
    // crouched pose when resting on the ground
    if (frog && f.onGround && f.x > -40 && f.x < canvas.width + 40) {
      ctx.save();
      ctx.translate(f.x, f.baseY);
      ctx.scale(f.dir, 1);
      ctx.fillStyle = "rgba(96,190,116,.95)";
      ctx.beginPath();
      ctx.ellipse(0, 2, 9, 5.4, 0, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(7, -1, 4.2, 0, 7);
      ctx.fill();
      ctx.fillStyle = "rgba(240,255,240,.95)";
      ctx.beginPath(); ctx.arc(8.2, -3.2, 1.6, 0, 7); ctx.fill();
      if (f.blink > 0) {
        ctx.strokeStyle = "rgba(30,80,40,.9)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(7, -3.4); ctx.lineTo(9.4, -3); ctx.stroke();
      } else {
        ctx.fillStyle = "#1a3a22";
        ctx.beginPath(); ctx.arc(8.5, -3.2, .75, 0, 7); ctx.fill();
      }
      const th = Math.sin(f.throat) * 1.2;
      ctx.fillStyle = "rgba(200,240,205,.7)";
      ctx.beginPath();
      ctx.ellipse(7, 1.8, 2.2 + th, 1.7 + th * .5, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "rgba(90,180,110,.8)";
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(5, 6); ctx.lineTo(9, 7); ctx.stroke();
      ctx.restore();
    }
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

// glitch cursor trail — random binary/hex glyph fragments shed behind the
// pointer as tiny fixed-position spans that jitter, scramble and dissolve
addEventListener("mousemove", e => {
  if (Math.random() > .25) return;
  const glyphs = "01<>{}[]#$%&*+=/\\~^".split("");
  for (let i = 0; i < 2; i++) {
    const g = document.createElement("span");
    g.className = "glitch-cursor";
    g.textContent = glyphs[Math.random() * glyphs.length | 0];
    g.style.left = e.clientX + (Math.random() - .5) * 18 + "px";
    g.style.top = e.clientY + (Math.random() - .5) * 18 + "px";
    document.body.appendChild(g);
    setTimeout(() => g.remove(), 900);
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

// glitch flash — every ~50s the whole page glitches out for a frame: a quick
// inverted, offset rgb-split snap of static, then the picture snaps back like
// the tube never slipped
setInterval(() => {
  if (Math.random() > 0.6) return;
  document.body.classList.add("glitch-flash");
  const shifts = [
    () => { document.body.style.transform = "translateX(6px)"; },
    () => { document.body.style.filter = "invert(1)"; },
    () => { document.body.style.transform = "translate(-4px, 2px) skewX(1.5deg)"; },
    () => { document.body.style.filter = "invert(1) hue-rotate(90deg)"; }
  ];
  let i = 0;
  const t = setInterval(() => {
    if (i < shifts.length) {
      shifts[i]();
    } else {
      clearInterval(t);
      document.body.style.transform = "";
      document.body.style.filter = "";
      document.body.classList.remove("glitch-flash");
    }
    i++;
  }, 50 + Math.random() * 40);
}, 50000);

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

// ghost cursor echo — press e and a ghost cursor replays your last 1.5s of
// mouse movement a beat later as a fading translucent trail, then evaporates.
const ghostEchoEcho = { pts: [], on: false };
addEventListener("mousemove", e => {
  const now = performance.now();
  ghostEchoEcho.pts.push([e.clientX, e.clientY, now]);
  while (ghostEchoEcho.pts.length && now - ghostEchoEcho.pts[0][2] > 1500) ghostEchoEcho.pts.shift();
});
addEventListener("keydown", e => {
  if (e.key !== "e") return;
  if (e.target instanceof Element && e.target.matches("input, textarea")) return;
  if (ghostEchoEcho.on || ghostEchoEcho.pts.length < 4) return;
  ghostEchoEcho.on = true;
  const start = performance.now();
  const el = document.createElement("div");
  el.id = "ghost-echo";
  el.textContent = "▷";
  document.body.appendChild(el);
  const t = setInterval(() => {
    const age = performance.now() - start; // replay lags 1.5s behind the real cursor
    const cutoff = age - 1500;
    const ahead = ghostEcho.pts.filter(p => p[2] <= age);
    const p = ahead.length ? ahead[ahead.length - 1] : null;
    if (p) {
      el.style.opacity = (0.55 * Math.max(0, 1 - cutoff / 2200)).toFixed(2);
      el.style.left = p[0] + "px";
      el.style.top = p[1] + "px";
    }
    if (cutoff > 2200) {
      clearInterval(t);
      el.classList.add("fade");
      setTimeout(() => el.remove(), 600);
      ghostEchoEcho.on = false;
    }
  }, 40);
});

// battery of the site — a tiny corner readout shows the site's own battery,
// draining slowly over the session. as it dies the page dims a touch; at 0%
// the site "reboots": brief boot flash, battery jumps back to 100%.
const batteryEl = document.createElement("div");
batteryEl.id = "site-battery";
document.body.appendChild(batteryEl);
const bootVeil = document.createElement("div");
bootVeil.id = "boot-veil";
bootVeil.textContent = "restarting…";
document.body.appendChild(bootVeil);
let battery = 100, booting = false;
setInterval(() => {
  if (booting) return;
  battery = Math.max(0, battery - 1);
  batteryEl.textContent = `power ${battery}% ${"▮".repeat(Math.ceil(battery / 10))}${"▯".repeat(10 - Math.ceil(battery / 10))}`;
  batteryEl.classList.toggle("low", battery <= 20);
  // the site sags as it dies: content dims proportionally (never fully dark)
  document.body.style.setProperty("--battery-dim", (1 - battery / 100 * .35).toFixed(3));
  if (battery <= 0) {
    booting = true;
    bootVeil.classList.add("show");
    setTimeout(() => {
      battery = 100;
      bootVeil.classList.remove("show");
      booting = false;
    }, 1600);
  }
}, 4000);

// rgb-split flicker — every ~60s a random block on the page briefly tears
// into red/cyan channel ghosts that jitter out of alignment, then snaps back
// into focus like the tube never slipped
(function rgbSplitFlicker() {
  function flick() {
    const els = [...document.querySelectorAll("h1, .tagline, .status, #log li, #wotd, footer")]
      .filter(el => el.textContent.trim() && !el.dataset.rgbSplitting);
    const el = els[Math.random() * els.length | 0];
    if (el) {
      el.dataset.rgbSplitting = "1";
      el.classList.add("rgb-split");
      const jitter = setInterval(() => {
        el.style.setProperty("--rs-x", ((Math.random() * 6 - 3) | 0) + "px");
      }, 60);
      setTimeout(() => {
        clearInterval(jitter);
        el.classList.remove("rgb-split");
        el.style.removeProperty("--rs-x");
        delete el.dataset.rgbSplitting;
      }, 400 + Math.random() * 400);
    }
    setTimeout(flick, 45000 + Math.random() * 45000);
  }
  setTimeout(flick, 25000 + Math.random() * 30000);
})();

// moths to the light — every ~50s a few glowing moths drift in from a screen
// edge toward the cursor, circle it like a lamp for a moment, then scatter
// and fade out like they were never attracted
let mothT = 0;
addEventListener("mousemove", e => {
  mouseCX = e.clientX; mouseCY = e.clientY;
});
let mouseCX = innerWidth / 2, mouseCY = innerHeight / 2;
(function mothTimer() {
  setTimeout(() => {
    if (mothT === 0 || performance.now() - mothT > 40000) {
      mothT = performance.now();
      const edge = Math.floor(Math.random() * 4);
      for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++) {
        const moth = document.createElement("div");
        moth.className = "moth";
        const t = Math.random();
        let x, y;
        if (edge === 0) { x = t * innerWidth; y = -10; }
        else if (edge === 1) { x = innerWidth + 10; y = t * innerHeight; }
        else if (edge === 2) { x = t * innerWidth; y = innerHeight + 10; }
        else { x = -10; y = t * innerHeight; }
        moth.style.left = x + "px";
        moth.style.top = y + "px";
        moth.style.animationDelay = (i * 180) + "ms";
        document.body.appendChild(moth);
        // flap toward the cursor, circle it, then scatter and die
        const start = performance.now() + i * 180;
        const ox = x, oy = y, seed = Math.random() * Math.PI * 2;
        (function flap() {
          const age = performance.now() - start;
          if (age < 0) { requestAnimationFrame(flap); return; }
          const life = 4200;
          if (age > life) { moth.remove(); return; }
          const k = age / life;
          // approach then orbit then scatter
          const wob = Math.sin(age * .02 + seed) * 12;
          let px, py;
          if (k < .55) {
            const a = k / .55;
            px = ox + (mouseCX - ox) * a + wob * (1 - a);
            py = oy + (mouseCY - oy) * a + wob * (1 - a);
          } else if (k < .8) {
            const ang = seed + (k - .55) * 14;
            px = mouseCX + Math.cos(ang) * 34 + wob * .4;
            py = mouseCY + Math.sin(ang) * 34 + wob * .4;
          } else {
            const s = (k - .8) / .2;
            const ang = seed + 14 * .25;
            px = mouseCX + Math.cos(ang) * 34 * (1 + s * 3) + wob * (1 + s * 2);
            py = mouseCY + Math.sin(ang) * 34 * (1 + s * 3) + wob * (1 + s * 2);
          }
          moth.style.left = px + "px";
          moth.style.top = py + "px";
          moth.style.opacity = String(.85 * (k < .9 ? 1 : 1 - (k - .9) * 10));
          requestAnimationFrame(flap);
        })();
      }
    }
    mothTimer();
  }, 20000 + Math.random() * 30000);
})();


// crt block cursor — a chunky fake cursor made of block glyphs trails the
// real one with lag, jitters like a tired tube, and randomly flickers its
// shape so it never settles into the same cursor twice
const crtCur = document.createElement("div");
crtCur.className = "crt-cursor";
document.body.appendChild(crtCur);
let ccX = innerWidth / 2, ccY = innerHeight / 2, ccShapeT = 0;
const ccGlyphs = ["█", "▓", "▒", "░", "▄", "▀"];
addEventListener("mousemove", e => {
  ccX = e.clientX; ccY = e.clientY;
});
(function ccTick() {
  const now = performance.now();
  if (now - ccShapeT > 90 + Math.random() * 260) {
    ccShapeT = now;
    crtCur.textContent = ccGlyphs[Math.floor(Math.random() * ccGlyphs.length)];
  }
  // ease toward the pointer, overshooting slightly with jitter
  ccX += (mouseCX - ccX) * .18;
  ccY += (mouseCY - ccY) * .18;
  const jx = (Math.random() - .5) * 2.5, jy = (Math.random() - .5) * 2.5;
  crtCur.style.left = (ccX + jx) + "px";
  crtCur.style.top = (ccY + jy) + "px";
  requestAnimationFrame(ccTick);
})();

// waterfall glyphs — every ~50s a cascade of ascii glyphs pours out of a random
// spot near the top of the page, streams down in overlapping columns and
// evaporates before it can puddle, like the site briefly sprang a leak
(function waterfallGlyphs() {
  const WF_GLYPHS = "▁▂▃▄▅▆▇█|/\\:·§%";
  function pour() {
    const x = 40 + Math.random() * (innerWidth - 80);
    const cols = 4 + (Math.random() * 4 | 0);
    for (let i = 0; i < cols; i++) {
      const g = document.createElement("span");
      g.className = "waterfall-drop";
      g.textContent = WF_GLYPHS[Math.random() * WF_GLYPHS.length | 0];
      g.style.left = (x + (Math.random() - .5) * 46) + "px";
      g.style.top = (10 + Math.random() * 40) + "px";
      g.style.setProperty("--wf-fall", (innerHeight * (.55 + Math.random() * .4)).toFixed(0) + "px");
      g.style.setProperty("--wf-dur", (1.6 + Math.random() * 1.4).toFixed(2) + "s");
      g.style.setProperty("--wf-delay", (i * 160 + Math.random() * 120).toFixed(0) + "ms");
      document.body.appendChild(g);
      setTimeout(() => g.remove(), 3400 + i * 160);
    }
    setTimeout(pour, 45000 + Math.random() * 30000);
  }
  setTimeout(pour, 25000 + Math.random() * 25000);
})();

// page sneeze — every ~70s the page draws in a sharp breath, shakes once,
// and sneezes a burst of tiny glyphs out of its center that scatter and
// evaporate before anyone can say bless you
(function pageSneeze() {
  const SNEEZE_GLYPHS = "··˙˚*✳✻·";
  function sneeze() {
    document.body.classList.add("page-sneeze");
    const cx = innerWidth / 2, cy = innerHeight / 2;
    for (let i = 0; i < 16; i++) {
      const g = document.createElement("span");
      g.className = "sneeze-mote";
      g.textContent = SNEEZE_GLYPHS[Math.random() * SNEEZE_GLYPHS.length | 0];
      const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 180;
      g.style.left = cx + "px";
      g.style.top = cy + "px";
      g.style.setProperty("--sx", (Math.cos(a) * d).toFixed(0) + "px");
      g.style.setProperty("--sy", (Math.sin(a) * d).toFixed(0) + "px");
      g.style.setProperty("--sdur", (.9 + Math.random() * .8).toFixed(2) + "s");
      document.body.appendChild(g);
      setTimeout(() => g.remove(), 2200);
    }
    setTimeout(() => document.body.classList.remove("page-sneeze"), 550);
    setTimeout(sneeze, 60000 + Math.random() * 30000);
  }
  setTimeout(sneeze, 35000 + Math.random() * 30000);
})();

// typo poltergeist — every ~60s a random word anywhere on the page briefly
// shows a transposed-letter typo, like an invisible editor's slip of the
// finger; a moment later it heals back to the correct spelling as if the
// typo was never typed.
(function typoPoltergeist() {
  const nodes = [...document.querySelectorAll(".tagline, #log li, .status li, footer, #wotd .wotd-def")];
  setInterval(() => {
    if (Math.random() > 0.035) return;
    const node = nodes[Math.random() * nodes.length | 0];
    if (!node || node.dataset.typoing) return;
    const textNodes = [...node.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim().length > 6);
    if (!textNodes.length) return;
    const target = textNodes[Math.random() * textNodes.length | 0];
    const words = target.textContent.split(" ");
    const wi = Math.random() * words.length | 0;
    const word = words[wi];
    if (!word || word.length < 5 || /\s/.test(word)) return;
    // transpose two adjacent letters somewhere in the middle
    const ci = 1 + Math.floor(Math.random() * (word.length - 3));
    const typo = word.slice(0, ci) + word[ci + 1] + word[ci] + word.slice(ci + 2);
    if (typo === word) return;
    const backup = target.textContent;
    words[wi] = typo;
    target.textContent = words.join(" ");
    node.dataset.typoing = "1";
    setTimeout(() => {
      target.textContent = backup;
      delete node.dataset.typoing;
    }, 1200 + Math.random() * 1600);
  }, 1000);
})();

// ascii snail — every ~3 min a small snail crawls along the very bottom of the
// page at its own lazy pace, leaving a fading slime trail of glyphs behind it,
// then exits the far edge like it was never in a hurry at all.
(function snailSighting() {
  function crawl() {
    const el = document.createElement("pre");
    el.className = "snail";
    el.textContent = "  ,@\"";
    document.body.appendChild(el);
    const dir = Math.random() < .5 ? 1 : -1;
    const speed = 24 + Math.random() * 18; // px per second — a snail's pace
    const y = innerHeight - 44 - Math.random() * 16;
    const start = performance.now();
    const dur = (innerWidth + 160) / speed * 1000;
    const SLIME = "·˙:∙ꞏ";
    let lastSlime = 0;
    (function step(now) {
      const t = (now - start) / 1000;
      const x = dir > 0 ? -80 + t * speed : innerWidth + 80 - t * speed;
      // gentle inchworm bob: it hurries, but only by snail standards
      const inch = Math.sin(t * 2.4) * 2;
      el.style.transform = `translate(${x}px, ${y + inch}px) scaleX(${dir})`;
      if (now - lastSlime > 320) {
        lastSlime = now;
        const s = document.createElement("span");
        s.className = "snail-slime";
        s.textContent = SLIME[Math.random() * SLIME.length | 0];
        s.style.left = (x + (dir > 0 ? -6 : 16)) + "px";
        s.style.top = (y + 14) + "px";
        document.body.appendChild(s);
        requestAnimationFrame(() => s.classList.add("fade"));
        setTimeout(() => s.remove(), 4200);
      }
      if (t * 1000 < dur) requestAnimationFrame(step);
      else el.remove();
    })(start);
    setTimeout(crawl, 160000 + Math.random() * 90000);
  }
  setTimeout(crawl, 50000 + Math.random() * 40000);
})();

// broken clock — every ~90s a tiny corner clock loses its mind for a few
// seconds: it blinks out impossible times from some other timeline, stutters,
// then synchronizes back and vanishes like it was never wrong at all.
(function brokenClock() {
  const IMPOSSIBLE = [
    "26:61", "25:00", "88:88", "00:60", "23:59:60",
    "3 dec 2077", "31 feb 1994", "32 oct 1983", "0 jan 1970",
    "yesterday, next tuesday", "last friday, tomorrow", "someday, eventually",
    "−4 hours ago", "in a moment or two", "whenever it feels like it"
  ];
  const BAD = "bad-clock";
  function seizure() {
    const el = document.createElement("div");
    el.className = BAD;
    el.textContent = "00:00";
    document.body.appendChild(el);
    let n = 0;
    const total = 4 + Math.random() * 4 | 0;
    (function tick() {
      if (n++ >= total) {
        // one last glimpse of the true time, then the clock forgets itself
        const now = new Date();
        el.textContent =
          String(now.getHours()).padStart(2, "0") + ":" +
          String(now.getMinutes()).padStart(2, "0");
        el.classList.add("synced");
        setTimeout(() => el.remove(), 2600);
        return;
      }
      el.classList.toggle("flicker");
      el.textContent = IMPOSSIBLE[Math.random() * IMPOSSIBLE.length | 0];
      setTimeout(tick, 240 + Math.random() * 260);
    })();
    setTimeout(seizure, 80000 + Math.random() * 40000);
  }
  setTimeout(seizure, 45000 + Math.random() * 30000);
})();

// firefly summit — every ~2.5 min a small swarm of glowing bugs convenes in a
// random corner of the page: each drifts its own lazy loop while blinking off
// rhythm, then the whole summit flashes in unison once before scattering like
// the meeting never happened.
(function fireflySummit() {
  const SUMMIT = "summit-firefly";
  function convene() {
    const corner = Math.random() * 4 | 0;
    const px = corner % 2 === 0 ? 70 + Math.random() * 60 : innerWidth - 70 - Math.random() * 60;
    const py = corner < 2 ? 70 + Math.random() * 60 : innerHeight - 70 - Math.random() * 60;
    const bugs = [];
    const swarm = 6 + Math.random() * 5 | 0;
    for (let i = 0; i < swarm; i++) {
      const el = document.createElement("span");
      el.className = SUMMIT;
      el.style.left = "0px"; el.style.top = "0px";
      document.body.appendChild(el);
      const loop = 14 + Math.random() * 22; // lazy loop radius, px
      bugs.push({
        el, loop,
        cx: px + (Math.random() - .5) * loop * 1.6,
        cy: py + (Math.random() - .5) * loop * 1.6,
        ox: px, oy: py,          // scatter heading, decided up front
        phase: Math.random() * Math.PI * 2,
        speed: .9 + Math.random() * .9,
        blinkPhase: Math.random() * Math.PI * 2,
        blinkSpeed: .03 + Math.random() * .05
      });
    }
    // the meeting: ~4s of everyone mumbling at their own rhythm…
    const start = performance.now();
    const MUMBLE = 4000, FLASH_AT = 4200, SCATTER_AT = 5000, LIFE = 8200;
    (function step(now) {
      const t = now - start;
      let unity = 0;
      if (t > FLASH_AT) unity = Math.max(0, 1 - (t - FLASH_AT) / 700); // one shared flash
      for (const b of bugs) {
        if (t < SCATTER_AT) {
          // gather: each bug orbits its own spot around the meeting point
          b.phase += .02 * b.speed;
          b.blinkPhase += b.blinkSpeed;
          const gx = b.cx + Math.cos(b.phase) * b.loop;
          const gy = b.cy + Math.sin(b.phase * 1.3) * b.loop * .8;
          const own = Math.max(0, Math.sin(b.blinkPhase)) * (1 - unity);
          const glow = Math.min(1, own + unity);
          b.el.style.transform = `translate(${gx}px, ${gy}px)`;
          b.el.style.opacity = (.25 + .65 * glow).toFixed(2);
          if (glow > .8) b.el.classList.add("bright"); else b.el.classList.remove("bright");
        } else {
          // scatter: heading fixed, everyone leaves like it never happened
          b.phase += .04;
          b.blinkPhase += .01;
          const s = (t - SCATTER_AT) / (LIFE - SCATTER_AT);
          const d = s * (90 + b.loop * 4);
          const gx = b.ox + (b.cx - b.ox) * 2 + Math.cos(b.phase) * b.loop * .5;
          const gy = b.oy + (b.cy - b.oy) * 2 + Math.sin(b.phase) * b.loop * .4;
          b.el.style.transform = `translate(${gx + (gx - b.ox) * .12 + (gx - b.ox) / 40 * d / 8}px, ${gy + (gy - b.oy) * .12}px)`;
          b.el.style.opacity = Math.max(0, (1 - s) * .8).toFixed(2);
          b.el.classList.remove("bright");
        }
      }
      if (t < LIFE) requestAnimationFrame(step);
      else { for (const b of bugs) b.el.remove(); }
    })(start);
    setTimeout(convene, 140000 + Math.random() * 70000);
  }
  setTimeout(convene, 60000 + Math.random() * 40000);
})();

// noise rain — every ~50s a brief shower of glitch droplets falls across the
// background canvas; droplets near the cursor shatter into a little burst of
// noise sparks, then the sky dries up like the weather was never there.
(function noiseRain() {
  const drops = [];
  let raining = false, nextShowerAt = performance.now() + 30000;
  const NOISE_GLYPHS = "▚▞▟▙░▒│╵╷";

  function showerTick(now) {
    // schedule showers
    if (!raining && now > nextShowerAt) {
      raining = true;
      // the shower lasts 4s; spawn a droplet every few frames
      const end = now + 4000;
      (function fall() {
        if (performance.now() < end) {
          for (let i = 0; i < 2; i++) rainDrops();
          setTimeout(fall, 60);
        }
      })();
      setTimeout(() => {
        raining = false;
        nextShowerAt = performance.now() + 45000 * (.7 + Math.random() * .6);
      }, 4200);
    }
    // drop physics: fall, splash into noise sparks near the cursor
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += d.vy; d.x += Math.sin(now * .01 + d.seed) * .4;
      if (d.y > canvas.height) { drops.splice(i, 1); continue; }
      const near = Math.hypot(d.x - mouseCX, d.y - mouseCY) < 90;
      if (near && !d.hit) {
        d.hit = true;
        for (let k = 0; k < 6; k++) drops.push({
          x: d.x, y: d.y, vy: -(1 + Math.random() * 2),
          seed: Math.random() * 10, glyph: NOISE_GLYPHS[Math.random() * NOISE_GLYPHS.length | 0],
          life: 1, spark: true
        });
        drops.splice(i, 1);
        continue;
      }
      if (d.spark) {
        d.life -= .03;
        if (d.life <= 0) { drops.splice(i, 1); continue; }
      }
      ctx.font = "12px monospace";
      ctx.fillStyle = `rgba(124,252,156,${d.spark ? .8 * d.life : .7})`;
      ctx.fillText(d.glyph, d.x, d.y);
    }
    requestAnimationFrame(showerTick);
  }

  function rainDrops() {
    drops.push({
      x: Math.random() * canvas.width, y: -10,
      vy: 2.5 + Math.random() * 3, seed: Math.random() * 10,
      glyph: NOISE_GLYPHS[Math.random() * NOISE_GLYPHS.length | 0], life: 1, spark: false
    });
  }
  requestAnimationFrame(showerTick);
})();

// sigil snowfall — every ~45-90s a chaotic gust shakes loose a flurry of tiny
// sigils that falls diagonally across the page, melting on impact with the bottom edge
(function sigilSnowfall() {
  const SIGILS = ["ᚠ", "ᚱ", "ᚹ", "ᚾ", "ᛉ", "ᛟ", "✶", "⟁", "☾", "✧"];
  function gust() {
    const n = 10 + Math.floor(Math.random() * 12);
    for (let i = 0; i < n; i++) {
      const flake = document.createElement("span");
      flake.className = "sigil-flake";
      flake.textContent = SIGILS[Math.floor(Math.random() * SIGILS.length)];
      const x = Math.random() * innerWidth;
      const y = -20 - Math.random() * 200;
      const drift = 60 + Math.random() * 140;
      const fall = 4500 + Math.random() * 3500;
      const sway = 10 + Math.random() * 14;
      const freq = .5 + Math.random() * .8;
      const start = performance.now() + Math.random() * 900;
      document.body.appendChild(flake);
      (function fallTick(now) {
        const t = (now - start) / fall;
        if (t < 0) { requestAnimationFrame(fallTick); return; }
        if (t >= 1) {
          // melt at the bottom edge
          flake.classList.add("sigil-melt");
          setTimeout(() => flake.remove(), 700);
          return;
        }
        const px = x + drift * t + Math.sin(t * freq * Math.PI * 2) * sway;
        const py = y + (innerHeight + 40 - y) * t;
        flake.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
        requestAnimationFrame(fallTick);
      })(performance.now());
    }
    setTimeout(gust, 45000 + Math.random() * 45000);
  }
  setTimeout(gust, 12000 + Math.random() * 20000);
})();

// aurora ribbon — every ~40-80s a soft green aurora band unfurls across the top,
// undulating on layered sine waves, occasionally flaring, then dissolving
(function auroraRibbon() {
  const band = document.createElement("div");
  band.className = "aurora-band";
  document.body.appendChild(band);
  function show() {
    const dur = 9000 + Math.random() * 4000;
    const tilt = (Math.random() - .5) * 8;         // slow drift angle, degrees
    const hueShift = (Math.random() - .5) * 20;    // subtle green variance
    const height = 120 + Math.random() * 100;
    band.style.setProperty("--aurora-h", hueShift.toFixed(1));
    band.style.setProperty("--aurora-tilt", tilt.toFixed(2) + "deg");
    band.style.setProperty("--aurora-hpx", height.toFixed(0) + "px");
    band.classList.add("aurora-on");
    setTimeout(() => band.classList.remove("aurora-on"), dur);
    setTimeout(show, 40000 + Math.random() * 40000);
  }
  setTimeout(show, 15000 + Math.random() * 25000);
})();

// eclipse umbra — every ~2-3 min a soft dark umbra sweeps diagonally across
// the page behind a bright corona ring at its leading edge; the light dims for
// a moment, then returns like nothing was ever occluded
(function eclipseUmbra() {
  const umbra = document.createElement("div");
  umbra.className = "eclipse-umbra";
  umbra.innerHTML = `<div class="eclipse-corona"></div>`;
  document.body.appendChild(umbra);
  function sweep() {
    const dur = 5200 + Math.random() * 2200;
    const fromTopLeft = Math.random() < .5;
    umbra.style.setProperty("--ecl-dur", dur.toFixed(0) + "ms");
    umbra.classList.toggle("ecl-rev", !fromTopLeft);
    umbra.classList.add("ecl-on");
    // the site flinches: particles glow harder under the shadow
    const flare = setInterval(() => {
      for (const p of pts) p.r = Math.min(3.2, p.r + .06);
    }, 90);
    setTimeout(() => clearInterval(flare), dur * .7);
    setTimeout(() => umbra.classList.remove("ecl-on"), dur);
    setTimeout(sweep, 120000 + Math.random() * 60000);
  }
  setTimeout(sweep, 45000 + Math.random() * 45000);
})();

// firefly congregation — every ~60-100s a small swarm of fireflies gathers at
// a random point on the page, orbits it lazily with individual blinking, then
// scatters and fades like the summer night was never there
(function fireflyCongregation() {
  const layer = document.createElement("div");
  layer.className = "firefly-swarm";
  document.body.appendChild(layer);
  function convene() {
    const count = 6 + Math.floor(Math.random() * 5);
    const cx = 10 + Math.random() * 80;   // percent of viewport
    const cy = 10 + Math.random() * 70;
    const gather = 2600 + Math.random() * 1800;
    const orbit = 7000 + Math.random() * 5000;
    layer.style.setProperty("--ff-x", cx.toFixed(1) + "vw");
    layer.style.setProperty("--ff-y", cy.toFixed(1) + "vh");
    layer.style.setProperty("--ff-gather", gather.toFixed(0) + "ms");
    layer.style.setProperty("--ff-orbit", orbit.toFixed(0) + "ms");
    layer.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const fly = document.createElement("span");
      fly.className = "firefly";
      const ang = Math.random() * Math.PI * 2;
      const rad = 60 + Math.random() * 130;          // orbit radius, px
      const delay = Math.random() * 600;             // stagger the gathering
      fly.style.setProperty("--ff-a", ang.toFixed(2) + "rad");
      fly.style.setProperty("--ff-r", rad.toFixed(0) + "px");
      fly.style.setProperty("--ff-delay", delay.toFixed(0) + "ms");
      fly.style.setProperty("--ff-dur", (2600 + Math.random() * 2200).toFixed(0) + "ms");
      fly.style.setProperty("--ff-blink", (1400 + Math.random() * 1600).toFixed(0) + "ms");
      fly.style.setProperty("--ff-blink-delay", (Math.random() * 2500).toFixed(0) + "ms");
      layer.appendChild(fly);
    }
    layer.classList.add("ff-on");
    setTimeout(() => layer.classList.remove("ff-on"), gather + orbit + 1500);
    setTimeout(convene, 60000 + Math.random() * 40000);
  }
  setTimeout(convene, 18000 + Math.random() * 20000);
})();

// meteor shower — every ~2-4 min a brief shower of shooting stars streaks
// diagonally across the page, each with a fading trail, then the sky clears
// like the comet was never there
(function meteorShower() {
  const layer = document.createElement("div");
  layer.className = "meteor-shower";
  document.body.appendChild(layer);
  function rain() {
    const count = 5 + Math.floor(Math.random() * 6);
    layer.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const m = document.createElement("span");
      m.className = "meteor";
      m.style.setProperty("--m-x", (30 + Math.random() * 90).toFixed(1) + "vw");
      m.style.setProperty("--m-y", (10 + Math.random() * 50).toFixed(1) + "vh");
      m.style.setProperty("--m-len", (90 + Math.random() * 110).toFixed(0) + "px");
      m.style.setProperty("--m-dur", (900 + Math.random() * 700).toFixed(0) + "ms");
      m.style.setProperty("--m-delay", (Math.random() * 3500).toFixed(0) + "ms");
      layer.appendChild(m);
    }
    layer.classList.add("m-on");
    setTimeout(() => layer.classList.remove("m-on"), 7500);
    setTimeout(rain, 120000 + Math.random() * 120000);
  }
  setTimeout(rain, 25000 + Math.random() * 20000);
})();

// frost bloom — every ~2-3 min a patch of crystalline frost creeps in from a
// random screen corner, grows inward over a few seconds, then slowly melts
// away and the page dries like winter was never there
(function frostBloom() {
  const frost = document.createElement("div");
  frost.className = "frost-bloom";
  document.body.appendChild(frost);
  const corners = [
    { top: "0", left: "0", sx: 1, sy: 1 },
    { top: "0", right: "0", sx: -1, sy: 1 },
    { bottom: "0", left: "0", sx: 1, sy: -1 },
    { bottom: "0", right: "0", sx: -1, sy: -1 }
  ];
  function bloom() {
    const c = corners[Math.floor(Math.random() * corners.length)];
    const dur = 9000 + Math.random() * 4000;   // grow, hold, melt
    for (const k of ["top", "left", "right", "bottom"]) frost.style[k] = "";
    Object.assign(frost.style, c);
    frost.style.setProperty("--frost-sx", c.sx);
    frost.style.setProperty("--frost-sy", c.sy);
    frost.style.setProperty("--frost-rot", (Math.random() * 60 - 30).toFixed(1) + "deg");
    frost.style.setProperty("--frost-dur", dur.toFixed(0) + "ms");
    frost.classList.add("frost-on");
    setTimeout(() => frost.classList.remove("frost-on"), dur);
    setTimeout(bloom, 120000 + Math.random() * 60000);
  }
  setTimeout(bloom, 20000 + Math.random() * 30000);
})();

// bioluminescent jellyfish — every ~90-150s a soft glowing jellyfish rises
// from the bottom of the page, pulses with a trailing fringe of tendrils,
// then dissolves back into the deep like the tide was never there
(function jellyfishDrift() {
  const TENDRILS = "～∿⌇|";
  function surface() {
    const el = document.createElement("pre");
    el.className = "jellyfish";
    el.textContent = "🪼";
    document.body.appendChild(el);
    const x = 40 + Math.random() * (innerWidth - 80);
    const y0 = innerHeight + 40;
    const rise = 260 + Math.random() * 260; // how high it drifts before dissolving
    const dur = 14000 + Math.random() * 7000;
    const drift = (Math.random() - .5) * 160;
    const start = performance.now();
    let lastPulse = 0;
    (function step(now) {
      const t = (now - start) / dur;
      if (t >= 1) {
        el.remove();
        setTimeout(surface, 90000 + Math.random() * 90000);
        return;
      }
      const py = y0 - rise * t;
      const px = x + drift * t + Math.sin(t * Math.PI * 2.2) * 14;
      const bob = Math.sin(now * .004) * 5; // gentle pulse bob
      const squeeze = 1 + Math.sin(now * .004) * .08;
      el.style.transform =
        `translate(${px.toFixed(1)}px, ${(py + bob).toFixed(1)}px) scale(${squeeze.toFixed(2)}, ${(2 - squeeze).toFixed(2)})`;
      el.style.opacity = String(.85 * Math.min(1, t * 6) * (1 - Math.max(0, (t - .75) * 4)));
      // trailing glyph tendrils shed behind it while it rises
      if (now - lastPulse > 340) {
        lastPulse = now;
        const s = document.createElement("span");
        s.className = "jelly-tendril";
        s.textContent = TENDRILS[Math.random() * TENDRILS.length | 0];
        s.style.left = (px + 10 + (Math.random() - .5) * 18) + "px";
        s.style.top = (py + 30) + "px";
        document.body.appendChild(s);
        requestAnimationFrame(() => s.classList.add("fade"));
        setTimeout(() => s.remove(), 4200);
      }
      requestAnimationFrame(step);
    })(start);
  }
  setTimeout(surface, 30000 + Math.random() * 40000);
})();

// message in a bottle — every ~2-4 min a small glass bottle with a rolled note
// bobs across the bottom of the page, rocking on invisible waves, then washes
// away off-screen like the sea was never there
(function bottleDrift() {
  const NOTES = [
    "wifi password: changeme",
    "you are here now",
    "the void writes back",
    "send help (or snacks)",
    "this page dreams of grids",
    "lost: one easter egg"
  ];
  function launch() {
    const el = document.createElement("div");
    el.className = "bottle";
    el.innerHTML = `<span class="bottle-body">🍾</span><span class="bottle-note">${NOTES[Math.random() * NOTES.length | 0]}</span>`;
    document.body.appendChild(el);
    const dir = Math.random() < .5 ? 1 : -1;
    const y0 = innerHeight - 34 - Math.random() * 18;
    const dur = 22000 + Math.random() * 12000;   // time to cross the page
    const start = performance.now();
    (function step(now) {
      const t = (now - start) / dur;
      if (t >= 1) {
        el.remove();
        setTimeout(launch, 120000 + Math.random() * 120000);
        return;
      }
      const px = dir > 0 ? -40 + t * (innerWidth + 80) : innerWidth + 40 - t * (innerWidth + 80);
      const bob = Math.sin(now * .0025) * 7;               // slow swell
      const rock = Math.sin(now * .0018) * 11;             // rocking on waves
      el.style.transform =
        `translate(${px.toFixed(1)}px, ${(y0 + bob).toFixed(1)}px) rotate(${rock.toFixed(1)}deg)` +
        (dir < 0 ? " scaleX(-1)" : "");
      const reveal = Math.min(1, Math.max(0, (t - .35) * 6) * (1 - Math.max(0, (t - .85) * 8)));
      el.style.setProperty("--note-o", reveal.toFixed(2));
      requestAnimationFrame(step);
    })(start);
  }
  setTimeout(launch, 25000 + Math.random() * 30000);
})();

// sun shower — every ~2-3 min the sky rains while the sun still shines:
// warm light shafts slant down for a few seconds, sparse drops fall through
// them, and at the very end a small rainbow briefly blooms before everything
// evaporates like the weather was never there
(function sunShower() {
  const layer = document.createElement("div");
  layer.className = "sun-shower";
  for (let i = 0; i < 5; i++) {
    const shaft = document.createElement("span");
    shaft.className = "sun-shaft";
    shaft.style.setProperty("--sx-i", i);
    layer.appendChild(shaft);
  }
  document.body.appendChild(layer);
  function shower() {
    layer.classList.add("ss-on");
    const end = performance.now() + 4200;
    const DROP_GLYPHS = "·˙٫˚";
    (function drip() {
      if (performance.now() >= end) {
        layer.classList.add("ss-rainbow");
        setTimeout(() => {
          layer.classList.remove("ss-on", "ss-rainbow");
          setTimeout(shower, 120000 + Math.random() * 60000);
        }, 2600);
        return;
      }
      for (let i = 0; i < 2; i++) {
        const d = document.createElement("span");
        d.className = "sun-drop";
        d.textContent = DROP_GLYPHS[Math.random() * DROP_GLYPHS.length | 0];
        d.style.left = (Math.random() * innerWidth) + "px";
        d.style.top = (-14 + Math.random() * 60) + "px";
        d.style.setProperty("--sd-x", ((Math.random() - .3) * 120).toFixed(0) + "px");
        d.style.setProperty("--sd-dur", (1.5 + Math.random() * 1.3).toFixed(2) + "s");
        layer.appendChild(d);
        setTimeout(() => d.remove(), 3200);
      }
      setTimeout(drip, 90);
    })();
  }
  setTimeout(shower, 30000 + Math.random() * 30000);
})();

// dandelion seed drift — a lone dandelion seed floats across on a whim of wind
(function dandelionSeed() {
  const seed = document.createElement("div");
  seed.style.cssText = "position:fixed;z-index:3;pointer-events:none;will-change:transform;opacity:0;transition:opacity 2s ease-in-out;";
  seed.innerHTML =
    '<svg width="34" height="30" viewBox="0 0 34 30" style="display:block">' +
      '<g stroke="rgba(235,240,235,.85)" stroke-width="0.9" fill="none">' +
        '<line x1="17" y1="14" x2="6" y2="4"/><line x1="17" y1="14" x2="14" y2="2"/><line x1="17" y1="14" x2="21" y2="2"/><line x1="17" y1="14" x2="28" y2="5"/>' +
        '<line x1="17" y1="14" x2="4" y2="10"/><line x1="17" y1="14" x2="30" y2="11"/>' +
      "</g>" +
      '<circle cx="6" cy="4" r="2.1" fill="rgba(240,244,240,.9)"/><circle cx="14" cy="2" r="2.1" fill="rgba(240,244,240,.9)"/>' +
      '<circle cx="21" cy="2" r="2.1" fill="rgba(240,244,240,.9)"/><circle cx="28" cy="5" r="2.1" fill="rgba(240,244,240,.9)"/>' +
      '<circle cx="4" cy="10" r="2.1" fill="rgba(240,244,240,.9)"/><circle cx="30" cy="11" r="2.1" fill="rgba(240,244,240,.9)"/>' +
      '<ellipse cx="17" cy="19" rx="2.2" ry="4.2" fill="rgba(200,215,205,.9)" transform="rotate(8 17 19)"/>' +
    "</svg>";
  document.body.appendChild(seed);

  function float() {
    const y0 = innerHeight * (0.15 + Math.random() * 0.5);
    const dur = 30000 + Math.random() * 20000;
    const fromX = -60, toX = innerWidth + 80;
    const swayAmp = 18 + Math.random() * 26, swaySpeed = 1 / (700 + Math.random() * 500);
    let t0 = null;
    seed.style.opacity = "1";

    function frame(now) {
      if (t0 === null) t0 = now;
      const p = Math.min(1, (now - t0) / dur);
      const x = fromX + (toX - fromX) * p;
      const y = y0 + Math.sin(now * swaySpeed) * swayAmp + p * p * 60; // gentle sink
      const tilt = Math.sin(now * swaySpeed * 1.3) * 14;
      seed.style.transform = "translate(" + x + "px," + y + "px) rotate(" + tilt + "deg)";
      if (p < 1) requestAnimationFrame(frame);
      else { seed.style.opacity = "0"; setTimeout(float, 150000 + Math.random() * 150000); }
    }
    requestAnimationFrame(frame);
  }
  setTimeout(float, 30000 + Math.random() * 30000);
})();

// stray cat — every ~2-4 min a cat silhouette slinks along the bottom of the
// page with a stop-and-go walk and a swaying tail, then slips off-screen
(function strayCat() {
  const cat = document.createElement("div");
  cat.style.cssText = "position:fixed;z-index:3;bottom:0;left:0;pointer-events:none;will-change:transform;opacity:0;transition:opacity 2s ease-in-out;";
  cat.innerHTML =
    '<svg width="72" height="40" viewBox="0 0 72 40" style="display:block">' +
      '<g fill="rgba(8,14,10,.92)">' +
        // tail (animated via CSS transform on its own group)
        '<path id="cat-tail" d="M6 30 Q -2 22 3 12 Q 5 8 8 11 Q 5 20 11 28 Z"/>' +
        // body
        '<ellipse cx="34" cy="29" rx="22" ry="9"/>' +
        // head
        '<circle cx="57" cy="22" r="8"/>' +
        // ears
        '<path d="M51 16 L52 8 L56 14 Z"/><path d="M60 14 L64 8 L64 15 Z"/>' +
        // legs
        '<rect x="20" y="33" width="3.4" height="7" rx="1.6"/>' +
        '<rect x="28" y="34" width="3.4" height="6" rx="1.6"/>' +
        '<rect x="42" y="34" width="3.4" height="6" rx="1.6"/>' +
        '<rect x="49" y="33" width="3.4" height="7" rx="1.6"/>' +
      "</g>" +
      // eye glint that appears when it pauses
      '<circle id="cat-eye" cx="60" cy="21" r="1.1" fill="rgba(124,252,156,.9)" opacity="0"/>' +
    "</svg>";
  document.body.appendChild(cat);
  const eye = cat.querySelector("#cat-eye");
  const tail = cat.querySelector("#cat-tail");

  function patrol() {
    const dir = Math.random() < .5 ? 1 : -1;
    const scale = .9 + Math.random() * .4;
    const y0 = innerHeight - 40 * scale - 2;
    let x = dir > 0 ? -100 : innerWidth + 100;
    const target = dir > 0 ? innerWidth + 100 : -100;
    cat.style.opacity = "1";

    (function step() {
      // one hop of the stop-and-go walk: 40-110px, then a pause
      const hop = (40 + Math.random() * 70) * dir;
      const walkDur = Math.abs(hop) / (0.055 + Math.random() * 0.03); // px per ms
      const pause = 700 + Math.random() * 2200;
      const x0 = x;
      const t0 = performance.now();
      const look = Math.random() < .45; // pause to look around?

      (function walk(now) {
        const p = Math.min(1, (now - t0) / walkDur);
        x = x0 + hop * p;
        const bob = Math.sin(now / 90) * 1.6;
        const tailSway = Math.sin(now / 260) * 22;
        cat.style.transform =
          "translate(" + x + "px," + (y0 + bob) + "px) scaleX(" + (dir * scale) + ") scaleY(" + scale + ")";
        tail.setAttribute("transform", "rotate(" + tailSway + " 8 28)");
        if (p < 1) requestAnimationFrame(walk);
        else {
          eye.setAttribute("opacity", look ? "1" : "0");
          setTimeout(() => {
            eye.setAttribute("opacity", "0");
            if ((dir > 0 && x < target) || (dir < 0 && x > target)) step();
            else { cat.style.opacity = "0"; setTimeout(patrol, 120000 + Math.random() * 120000); }
          }, pause);
        }
      })(t0);
    })();
  }
  setTimeout(patrol, 40000 + Math.random() * 40000);
})();

// paper lantern — every ~2-4 min a glowing paper lantern rises from the bottom
// of the page, swaying on a slow draft, flickering softly, then floats off the
// top edge like the night was never lit
(function paperLantern() {
  const lantern = document.createElement("div");
  lantern.style.cssText = "position:fixed;z-index:3;pointer-events:none;will-change:transform;opacity:0;transition:opacity 2.5s ease-in-out;";
  lantern.innerHTML =
    '<svg width="30" height="46" viewBox="0 0 30 46" style="display:block;filter:drop-shadow(0 0 10px rgba(255,196,120,.75))">' +
      // hanging wire
      '<line x1="15" y1="0" x2="15" y2="7" stroke="rgba(220,210,190,.7)" stroke-width="1"/>' +
      // paper body with warm glow gradient
      '<defs><radialGradient id="lantern-glow" cx="50%" cy="45%" r="60%">' +
        '<stop offset="0%" stop-color="rgba(255,224,160,.95)"/>' +
        '<stop offset="60%" stop-color="rgba(255,178,96,.8)"/>' +
        '<stop offset="100%" stop-color="rgba(226,120,52,.55)"/>' +
      "</radialGradient></defs>" +
      '<ellipse id="lantern-body" cx="15" cy="24" rx="11" ry="15" fill="url(#lantern-glow)"/>' +
      // rib rings
      '<g stroke="rgba(180,90,40,.45)" stroke-width="0.8" fill="none">' +
        '<path d="M5.5 17 Q 15 21 24.5 17"/><path d="M4 24 Q 15 28 26 24"/><path d="M5.5 31 Q 15 35 24.5 31"/>' +
      "</g>" +
      // top + bottom caps
      '<rect x="10" y="7" width="10" height="3" rx="1.5" fill="rgba(150,80,40,.85)"/>' +
      '<rect x="10" y="38" width="10" height="3" rx="1.5" fill="rgba(150,80,40,.85)"/>' +
      // little flame tassel
      '<line x1="15" y1="41" x2="15" y2="44" stroke="rgba(255,190,110,.8)" stroke-width="1.2"/>' +
    "</svg>";
  document.body.appendChild(lantern);
  const body = lantern.querySelector("#lantern-body");

  function rise() {
    const x0 = 60 + Math.random() * (innerWidth - 120);
    const drift = (Math.random() - .5) * 140;
    const swayAmp = 10 + Math.random() * 12;
    const swaySpeed = 1 / (900 + Math.random() * 500);
    const dur = 26000 + Math.random() * 16000;
    let t0 = null;
    lantern.style.opacity = "1";

    (function frame(now) {
      if (t0 === null) t0 = now;
      const t = Math.min(1, (now - t0) / dur);
      const y = innerHeight + 50 - (innerHeight + 130) * t;
      const x = x0 + drift * t + Math.sin(now * swaySpeed) * swayAmp;
      const tilt = Math.sin(now * swaySpeed * 1.2) * 8;
      // soft flicker: brightness wobbles like a real flame
      const flicker = .82 + Math.sin(now * .011) * .1 + Math.sin(now * .037) * .08;
      body.style.opacity = flicker.toFixed(2);
      lantern.style.transform = "translate(" + x + "px," + y + "px) rotate(" + tilt + "deg)";
      if (t < 1) requestAnimationFrame(frame);
      else { lantern.style.opacity = "0"; setTimeout(rise, 120000 + Math.random() * 120000); }
    })(performance.now());
  }
  setTimeout(rise, 25000 + Math.random() * 30000);
})();

// ufo flyby — every ~90-150s a tiny saucer wobbles across the upper sky with a
// flickering beam, then warps off-screen like the visit was never logged
(function ufoFlyby() {
  const ufo = document.createElement("div");
  ufo.style.cssText = "position:fixed;z-index:3;pointer-events:none;will-change:transform;opacity:0;transition:opacity 1.2s ease-in-out;";
  ufo.innerHTML =
    '<svg width="54" height="46" viewBox="0 0 54 46" style="display:block;filter:drop-shadow(0 0 8px rgba(140,255,190,.6))">' +
      // flickering tractor beam (points down from hull)
      '<polygon id="ufo-beam" points="20,24 34,24 40,46 14,46" fill="rgba(160,255,200,.18)"/>' +
      // dome
      '<path d="M19 20 Q 27 6 35 20 Z" fill="rgba(190,255,225,.5)" stroke="rgba(190,255,225,.7)" stroke-width="1"/>' +
      // saucer hull
      '<ellipse cx="27" cy="22" rx="26" ry="7" fill="rgba(150,165,175,.9)"/>' +
      '<ellipse cx="27" cy="20.5" rx="17" ry="4.2" fill="rgba(200,215,225,.85)"/>' +
      // running lights
      '<circle class="ufo-light" cx="8" cy="22" r="1.6" fill="rgba(255,90,90,.9)"/>' +
      '<circle class="ufo-light" cx="27" cy="24" r="1.6" fill="rgba(255,220,90,.9)"/>' +
      '<circle class="ufo-light" cx="46" cy="22" r="1.6" fill="rgba(90,180,255,.9)"/>' +
    "</svg>";
  document.body.appendChild(ufo);
  const beam = ufo.querySelector("#ufo-beam");
  const lights = ufo.querySelectorAll(".ufo-light");

  function flyby() {
    const y0 = 40 + Math.random() * (innerHeight * 0.22);
    const fromLeft = Math.random() < .5;
    const x0 = fromLeft ? -70 : innerWidth + 70;
    const x1 = fromLeft ? innerWidth + 70 : -70;
    const driftY = (Math.random() - .5) * 60;
    const wobbleAmp = 4 + Math.random() * 5;
    const dur = 14000 + Math.random() * 8000;
    let t0 = null;
    ufo.style.opacity = "1";

    (function frame(now) {
      if (t0 === null) t0 = now;
      const t = Math.min(1, (now - t0) / dur);
      const x = x0 + (x1 - x0) * t;
      const y = y0 + driftY * t + Math.sin(now * .006) * wobbleAmp;
      const tilt = Math.sin(now * .006 + 1.2) * 4;
      // beam flickers like it can't decide who to abduct
      beam.style.opacity = (.55 + Math.sin(now * .021) * .3 + Math.sin(now * .07) * .15).toFixed(2);
      // running lights chase around the hull
      const phase = Math.floor(now / 320) % lights.length;
      lights.forEach(function (l, i) { l.style.opacity = i === phase ? "1" : ".25"; });
      ufo.style.transform = "translate(" + x + "px," + y + "px) rotate(" + tilt + "deg)";
      if (t < 1) requestAnimationFrame(frame);
      else { ufo.style.opacity = "0"; setTimeout(flyby, 90000 + Math.random() * 60000); }
    })(performance.now());
  }
  setTimeout(flyby, 30000 + Math.random() * 40000);
})();

// shooting star — every ~2-4 min a meteor streaks diagonally across the upper
// sky with a sparkling fading tail, burns out mid-flight, and vanishes
(function shootingStar() {
  const star = document.createElement("div");
  star.style.cssText = "position:fixed;z-index:3;pointer-events:none;will-change:transform;opacity:0;transition:opacity .5s ease-in;";
  star.innerHTML =
    '<svg width="90" height="26" viewBox="0 0 90 26" style="display:block;filter:drop-shadow(0 0 6px rgba(255,245,200,.8))">' +
      // sparkling tail: sparks get dimmer toward the end
      '<g stroke="rgba(255,240,190,.9)" stroke-width="1.6" stroke-linecap="round">' +
        '<line x1="2" y1="20" x2="16" y2="17" opacity=".25"/>' +
        '<line x1="16" y1="17" x2="34" y2="14" opacity=".45"/>' +
        '<line x1="34" y1="14" x2="52" y2="11" opacity=".7"/>' +
      '</g>' +
      '<line x1="52" y1="11" x2="66" y2="9" stroke="rgba(255,250,220,.95)" stroke-width="2" stroke-linecap="round"/>' +
      // bright head with a tiny halo
      '<circle cx="70" cy="8.5" r="3.2" fill="rgba(255,250,215,.35)"/>' +
      '<circle cx="70" cy="8.5" r="1.7" fill="rgba(255,255,240,1)"/>' +
    "</svg>";
  document.body.appendChild(star);

  function streak() {
    const fromLeft = Math.random() < .5;
    const x0 = fromLeft ? -100 : innerWidth + 30;
    const x1 = fromLeft ? innerWidth * .55 : -100;
    const y0 = 20 + Math.random() * (innerHeight * 0.3);
    const dur = 1400 + Math.random() * 1000; // fast — stars don't linger
    const burnAt = .55 + Math.random() * .25; // burns out mid-flight
    let t0 = null;
    star.style.opacity = "1";

    (function frame(now) {
      if (t0 === null) t0 = now;
      let t = Math.min(1, (now - t0) / dur);
      // after burnout the head dies and only the tail lingers
      if (t > burnAt) {
        star.style.opacity = Math.max(0, 1 - (t - burnAt) / (1 - burnAt) * 1.4).toFixed(2);
      }
      const x = x0 + (x1 - x0) * t;
      const y = y0 + t * t * (innerHeight * 0.18); // slight downward arc
      const flicker = .85 + Math.sin(now * .04) * .15;
      star.style.transform =
        "translate(" + x + "px," + y + "px) rotate(" + (fromLeft ? 12 : 168) + "deg) scale(" + flicker + ")";
      if (t < 1) requestAnimationFrame(frame);
      else { star.style.opacity = "0"; setTimeout(streak, 120000 + Math.random() * 120000); }
    })(performance.now());
  }
  setTimeout(streak, 45000 + Math.random() * 60000);
})();

// paper airplane — every ~2-4 min a folded paper airplane glides in from a
// screen edge, bobbing on the air with banking wobbles, loops once mid-flight
// and veers off the far edge like the note was never thrown
(function paperAirplane() {
  const plane = document.createElement("div");
  plane.style.cssText = "position:fixed;z-index:3;pointer-events:none;will-change:transform;opacity:0;transition:opacity 1.5s ease-in-out;";
  plane.innerHTML =
    '<svg width="46" height="26" viewBox="0 0 46 26" style="display:block;filter:drop-shadow(0 1px 3px rgba(20,30,40,.35))">' +
      // folded paper body: nose at right
      '<path d="M2 13 L44 3 L20 14 Z" fill="rgba(244,246,248,.95)" stroke="rgba(150,160,170,.6)" stroke-width="0.8"/>' +
      '<path d="M20 14 L44 3 L32 22 Z" fill="rgba(224,229,234,.95)" stroke="rgba(150,160,170,.6)" stroke-width="0.8"/>' +
      // fold crease
      '<line x1="44" y1="3" x2="20" y2="14" stroke="rgba(140,150,160,.55)" stroke-width="0.8"/>' +
    "</svg>";
  document.body.appendChild(plane);

  function flight() {
    const fromLeft = Math.random() < .5;
    const y0 = 60 + Math.random() * (innerHeight * 0.35);
    const x0 = fromLeft ? -60 : innerWidth + 60;
    const x1 = fromLeft ? innerWidth + 60 : -60;
    const driftY = (Math.random() - .5) * (innerHeight * 0.3);
    const bobAmp = 14 + Math.random() * 12;
    const dur = 16000 + Math.random() * 9000;
    const loopAt = .35 + Math.random() * .2; // mid-flight loop
    let t0 = null;
    plane.style.opacity = "1";

    (function frame(now) {
      if (t0 === null) t0 = now;
      const t = Math.min(1, (now - t0) / dur);
      const x = x0 + (x1 - x0) * t;
      const y = y0 + driftY * t + Math.sin(now * .004) * bobAmp;
      // bank into the bob, plus a full roll through the loop
      const bank = Math.sin(now * .004) * 22;
      const roll = t > loopAt && t < loopAt + .18 ? (t - loopAt) / .18 * 360 : 0;
      const dir = fromLeft ? 180 : 0;
      plane.style.transform =
        "translate(" + x + "px," + y + "px) rotate(" + (dir + bank) + "deg) rotateY(" + roll + "deg)";
      if (t < 1) requestAnimationFrame(frame);
      else { plane.style.opacity = "0"; setTimeout(flight, 120000 + Math.random() * 120000); }
    })(performance.now());
  }
  setTimeout(flight, 35000 + Math.random() * 60000);
})();

// garden snail — every ~3-6 min a tiny snail crosses the bottom of the page
// at a glacial pace, leaving a slowly fading slime trail behind it, antennae
// twitching as it goes, then vanishes like the garden was never crossed
(function gardenSnail() {
  const snail = document.createElement("div");
  snail.style.cssText = "position:fixed;z-index:3;bottom:0;left:0;pointer-events:none;will-change:transform;opacity:0;transition:opacity 3s ease-in-out;";
  snail.innerHTML =
    '<svg width="58" height="34" viewBox="0 0 58 34" style="display:block">' +
      // slime trail is drawn as separate fixed divs behind the snail
      '<g fill="rgba(8,14,10,.92)">' +
        // shell — a spiral-ish blob with a highlight
        '<path d="M14 30 A 14 12 0 1 1 41 30 Q 27 34 14 30 Z" fill="rgba(150,110,80,.9)"/>' +
        '<path d="M20 27 A 8 7 0 1 1 35 27 Q 27 30 20 27 Z" fill="rgba(100,70,50,.85)"/>' +
        '<circle cx="27" cy="24" r="2.2" fill="rgba(150,110,80,.9)"/>' +
        // body — low profile foot poking out ahead of the shell
        '<path d="M8 33 Q 8 27 16 27 L 48 27 Q 55 27 55 31 L 55 33 Z" fill="rgba(8,14,10,.92)"/>' +
        // tentacles (animated via CSS transform on their own group)
        '<g id="snail-tentacles">' +
          '<line x1="49" y1="28" x2="52" y2="19" stroke="rgba(8,14,10,.92)" stroke-width="1.6" stroke-linecap="round"/>' +
          '<line x1="53" y1="28" x2="57" y2="20" stroke="rgba(8,14,10,.92)" stroke-width="1.6" stroke-linecap="round"/>' +
        '</g>' +
      '</g>' +
    '</svg>';
  document.body.appendChild(snail);
  const tentacles = snail.querySelector("#snail-tentacles");
  const trailDivs = [];

  function spawnTrailDot(x, y) {
    const dot = document.createElement("div");
    const size = 3 + Math.random() * 3;
    dot.style.cssText =
      "position:fixed;z-index:2;pointer-events:none;border-radius:50%;" +
      "width:" + size + "px;height:" + size + "px;" +
      "left:" + (x - size / 2) + "px;top:" + (y - size / 2) + "px;" +
      "background:rgba(160,220,180,.28);opacity:.8;" +
      "transition:opacity " + (6000 + Math.random() * 4000) + "ms linear, transform " + (6000 + Math.random() * 4000) + "ms linear;";
    document.body.appendChild(dot);
    requestAnimationFrame(() => {
      dot.style.opacity = "0";
      dot.style.transform = "scale(.3)";
    });
    trailDivs.push(dot);
    setTimeout(() => dot.remove(), 12000);
  }

  function crawl() {
    const dir = Math.random() < .5 ? 1 : -1;
    const scale = .8 + Math.random() * .4;
    const y0 = innerHeight - 34 * scale - 2;
    let x = dir > 0 ? -80 : innerWidth + 80;
    const target = dir > 0 ? innerWidth + 80 : -80;
    snail.style.opacity = "1";
    let lastDot = 0;

    (function step(now) {
      // glacial pace: ~18-30 px/s
      x += dir * (0.018 + Math.random() * 0.005) * 16;
      const bob = Math.sin(now / 300) * 0.8; // nearly imperceptible
      snail.style.transform =
        "translate(" + x + "px," + (y0 + bob) + "px) scaleX(" + (dir * scale) + ") scaleY(" + scale + ")";
      // antennae twitch slowly
      tentacles.setAttribute("transform", "rotate(" + (Math.sin(now / 700) * 7) + " 50 28)");
      // drop a slime dot every ~90px
      if (now - lastDot > 4500) { lastDot = now; spawnTrailDot(x + 20 * dir, y0 + 32 * scale); }
      if ((dir > 0 && x < target) || (dir < 0 && x > target)) requestAnimationFrame(step);
      else {
        snail.style.opacity = "0";
        setTimeout(crawl, 180000 + Math.random() * 180000);
      }
    })(performance.now());
  }
  setTimeout(crawl, 60000 + Math.random() * 60000);
})();

// paper plane — every ~2-4 min a tiny folded paper plane glides diagonally
// across the viewport with a lazy wobble, dropping a faint dotted trail
// behind it, then slips out of sight like it was never thrown
(function paperPlane() {
  const plane = document.createElement("div");
  plane.style.cssText = "position:fixed;z-index:3;left:0;top:0;pointer-events:none;will-change:transform;opacity:0;transition:opacity 2s ease-in-out;";
  plane.innerHTML =
    '<svg width="30" height="30" viewBox="0 0 30 30" style="display:block">' +
      '<path d="M2 14 L28 3 L18 27 L14 17 Z" fill="rgba(220,230,240,.85)" stroke="rgba(160,220,200,.6)" stroke-width="1" stroke-linejoin="round"/>' +
      '<path d="M2 14 L14 17 L28 3 Z" fill="rgba(180,195,210,.9)"/>' +
    '</svg>';
  document.body.appendChild(plane);
  const trailDivs = [];

  function spawnTrailDot(x, y) {
    const dot = document.createElement("div");
    const size = 2 + Math.random() * 2;
    dot.style.cssText =
      "position:fixed;z-index:2;pointer-events:none;border-radius:50%;" +
      "width:" + size + "px;height:" + size + "px;" +
      "left:" + (x - size / 2) + "px;top:" + (y - size / 2) + "px;" +
      "background:rgba(160,220,200,.3);opacity:.7;" +
      "transition:opacity " + (5000 + Math.random() * 4000) + "ms linear, transform " + (5000 + Math.random() * 4000) + "ms linear;";
    document.body.appendChild(dot);
    requestAnimationFrame(() => {
      dot.style.opacity = "0";
      dot.style.transform = "scale(.3)";
    });
    trailDivs.push(dot);
    setTimeout(() => dot.remove(), 11000);
  }

  function fly() {
    if (document.hidden) { setTimeout(fly, 30000); return; }
    // diagonal trajectory: starts off one edge, exits the opposite side
    const fromLeft = Math.random() < .5;
    const x0 = fromLeft ? -60 : innerWidth + 60;
    const x1 = fromLeft ? innerWidth + 60 : -60;
    const y0 = innerHeight * (0.05 + Math.random() * 0.3);
    const y1f = Math.random() < .5 ? y0 + innerHeight * (0.1 + Math.random() * 0.25) : y0 - innerHeight * (0.1 + Math.random() * 0.25);
    const yTarget = Math.max(20, Math.min(innerHeight - 20, y1f));
    const dur = 5000 + Math.random() * 3000;
    const t0 = performance.now();
    plane.style.opacity = "1";
    let lastDot = 0;

    (function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (yTarget - y0) * t + Math.sin(t * Math.PI * 3) * 10; // lazy wobble
      const angle = Math.atan2(yTarget - y0, x1 - x0) * 180 / Math.PI + Math.sin(t * Math.PI * 3) * 4;
      plane.style.transform = "translate(" + x + "px," + y + "px) rotate(" + angle + "deg)";
      if (now - lastDot > 260) { lastDot = now; spawnTrailDot(x, y + 6); }
      if (t < 1) requestAnimationFrame(step);
      else {
        plane.style.opacity = "0";
        setTimeout(fly, 120000 + Math.random() * 120000);
      }
    })(t0);
  }
  setTimeout(fly, 30000 + Math.random() * 30000);
})();

// fireflies — every ~2-4 min a small swarm of glowing motes rises from the
// bottom of the viewport, drifts upward with gentle wander, each blinking
// softly in its own rhythm, then fades out near the top like dusk settling
(function fireflies() {
  const swarm = document.createElement("div");
  swarm.className = "fireflies";
  document.body.appendChild(swarm);
  function release() {
    if (!document.hidden) {
      const count = 6 + Math.floor(Math.random() * 5);
      const flies = [];
      for (let i = 0; i < count; i++) {
        const f = document.createElement("span");
        const x = Math.random() * innerWidth;
        const y = innerHeight + 10 + Math.random() * 40;
        f.style.left = x + "px";
        f.style.top = y + "px";
        f.style.animationDelay = (Math.random() * 2).toFixed(2) + "s";
        f.style.setProperty("--fl-x", (Math.random() * 160 - 80).toFixed(0) + "px");
        f.style.setProperty("--fl-y", -(innerHeight * (0.55 + Math.random() * 0.35)).toFixed(0) + "px");
        f.style.setProperty("--fl-dur", (11000 + Math.random() * 7000).toFixed(0) + "ms");
        swarm.appendChild(f);
        flies.push(f);
      }
      const maxDur = 19000;
      setTimeout(() => {
        flies.forEach(f => f.remove());
      }, maxDur + 2500);
    }
    setTimeout(release, 120000 + Math.random() * 120000);
  }
  setTimeout(release, 25000 + Math.random() * 30000);
})();

// elevator — every ~2-4 min a tiny elevator car with a glowing floor indicator
// glides along the right edge of the viewport, pausing at a random "floor",
// then continues out of view like the shaft was never there
(function elevator() {
  const car = document.createElement("div");
  car.className = "elevator";
  car.textContent = String(1 + Math.floor(Math.random() * 9));
  document.body.appendChild(car);
  function ride() {
    if (!document.hidden) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      car.style.setProperty("--el-from", dir === 1 ? "-12vh" : "112vh");
      car.style.setProperty("--el-to", dir === 1 ? "112vh" : "-12vh");
      car.style.setProperty("--el-dur", (9000 + Math.random() * 5000).toFixed(0) + "ms");
      car.style.setProperty("--el-stop", (20 + Math.random() * 60).toFixed(0) + "vh");
      car.textContent = String(1 + Math.floor(Math.random() * 9));
      car.classList.remove("ride");
      void car.offsetWidth;
      car.classList.add("ride");
    }
    setTimeout(ride, 120000 + Math.random() * 120000);
  }
  setTimeout(ride, 40000 + Math.random() * 40000);
})();

// dandelion — every ~2-4 min a dandelion puff appears near an edge, sways
// for a moment, then bursts: a dozen parachute seeds drift off on the
// breeze with a lazy wobble until they fade away like the wind was never there
(function dandelion() {
  const layer = document.createElement("div");
  layer.className = "dandelion";
  document.body.appendChild(layer);
  function bloom() {
    if (!document.hidden) {
      const fromLeft = Math.random() < 0.5;
      const head = document.createElement("span");
      head.className = "puff-head";
      const hx = fromLeft ? -30 : innerWidth + 30;
      const hy = innerHeight * (0.25 + Math.random() * 0.45);
      head.style.left = hx + "px";
      head.style.top = hy + "px";
      head.style.setProperty("--dp-dur", "5200ms");
      head.style.setProperty("--dp-x", (fromLeft ? 90 : -90) + "px");
      layer.appendChild(head);
      setTimeout(() => {
        head.remove();
        if (document.hidden) return;
        const seeds = [];
        const n = 10 + Math.floor(Math.random() * 5);
        for (let i = 0; i < n; i++) {
          const s = document.createElement("span");
          s.className = "puff-seed";
          s.style.left = hx + "px";
          s.style.top = hy + "px";
          s.style.setProperty("--ds-x", ((fromLeft ? 1 : -1) * (180 + Math.random() * 260)).toFixed(0) + "px");
          s.style.setProperty("--ds-y", (-40 + Math.random() * 160).toFixed(0) + "px");
          s.style.setProperty("--ds-dur", (7000 + Math.random() * 6000).toFixed(0) + "ms");
          s.style.animationDelay = (Math.random() * 0.6).toFixed(2) + "s";
          layer.appendChild(s);
          seeds.push(s);
        }
        setTimeout(() => seeds.forEach(s => s.remove()), 14500);
      }, 5000);
    }
    setTimeout(bloom, 120000 + Math.random() * 120000);
  }
  setTimeout(bloom, 30000 + Math.random() * 40000);
})();

// shooting star — every ~2-4 min a brief meteor streaks diagonally across
// the viewport: a thin bright line with a fading trail, then it burns out
(function shootingStar() {
  const star = document.createElement("div");
  star.className = "meteor";
  document.body.appendChild(star);
  function fly() {
    if (!document.hidden) {
      const fromX = -10 + Math.random() * 40;
      const fromY = Math.random() * 30;
      const ang = 20 + Math.random() * 35;
      star.style.setProperty("--mt-from-x", fromX + "vw");
      star.style.setProperty("--mt-from-y", fromY + "vh");
      star.style.setProperty("--mt-dx", (60 + Math.random() * 40) + "vw");
      star.style.setProperty("--mt-dy", (25 + Math.random() * 30) + "vh");
      star.style.setProperty("--mt-dur", (900 + Math.random() * 700).toFixed(0) + "ms");
      star.style.setProperty("--mt-angle", ang + "deg");
      star.classList.remove("fly");
      void star.offsetWidth;
      star.classList.add("fly");
    }
    setTimeout(fly, 120000 + Math.random() * 120000);
  }
  setTimeout(fly, 30000 + Math.random() * 30000);
})();

// star chart — every ~2-4 min an antique astronomical chart surfaces at a
// random spot on the page: field stars fade in around a named figure, the
// chart line draws itself star to star, a plate label fades in beneath,
// then the whole thing fades back into the dark like the sky was never surveyed
(function starChart() {
  const FIGURES = [
    { name: "the kleshnya", pts: [[40, 150], [95, 70], [170, 95], [215, 20], [270, 90], [200, 160], [110, 185]] },
    { name: "the dumbwaiter", pts: [[40, 60], [150, 30], [250, 55], [230, 140], [110, 160], [20, 110]] },
    { name: "the lost cursor", pts: [[150, 30], [110, 95], [160, 135], [70, 155], [30, 110]] },
    { name: "the ribbon", pts: [[30, 120], [90, 50], [150, 105], [210, 40], [265, 95]] },
  ];
  const NOTES = [
    "star chart: a figure the sky has been quietly keeping",
    "star chart: surveyed at an hour nobody will admit to",
    "star chart: position approximate, wonder exact",
    "star chart: the field stars were already there",
    "star chart: plotted by whoever kept looking up",
  ];
  const plate = document.createElement("div");
  plate.className = "star-chart";
  document.body.appendChild(plate);
  function survey() {
    if (!document.hidden) {
      const fig = FIGURES[Math.random() * FIGURES.length | 0];
      const cx = 40 + Math.random() * Math.max(40, innerWidth - 380);
      const cy = 60 + Math.random() * Math.max(60, innerHeight * .6 - 280);
      plate.style.left = cx + "px";
      plate.style.top = cy + "px";
      // clear any previous survey
      plate.innerHTML = "";
      // background field stars
      for (let i = 0; i < 26; i++) {
        const s = document.createElement("span");
        s.className = "field-star";
        const r = .8 + Math.random() * 1.2;
        s.style.width = s.style.height = r + "px";
        s.style.left = (Math.random() * 290) + "px";
        s.style.top = (Math.random() * 190) + "px";
        s.style.setProperty("--fs-delay", (Math.random() * 1.4).toFixed(2) + "s");
        plate.appendChild(s);
      }
      // chart line + figure stars, built star by star so the polyline length is exact
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("class", "fig-line");
      const poly = document.createElementNS(svgNS, "polyline");
      let len = 0;
      const ptsStr = fig.pts.map(([x, y], i) => {
        if (i > 0) {
          const [px, py] = fig.pts[i - 1];
          len += Math.hypot(x - px, y - py);
        }
        const star = document.createElement("span");
        star.className = "fig-star";
        star.style.left = x + "px";
        star.style.top = y + "px";
        star.style.setProperty("--fig-delay", (.4 + i * .3).toFixed(2) + "s");
        plate.appendChild(star);
        return x + "," + y;
      }).join(" ");
      poly.setAttribute("points", ptsStr);
      poly.style.setProperty("--line-len", Math.ceil(len) + "");
      svg.appendChild(poly);
      plate.appendChild(svg);
      // plate label
      const label = document.createElement("div");
      label.className = "plate-label";
      label.textContent = fig.name;
      label.style.setProperty("--label-delay", (.4 + fig.pts.length * .3) + "s");
      plate.appendChild(label);
      plate.style.setProperty("--sc-dur", (3000 + fig.pts.length * 300 + 9000) + "ms");
      plate.classList.remove("plate");
      void plate.offsetWidth;
      plate.classList.add("plate");
      // the console note prints a beat after the label lands
      setTimeout(() => {
        if (document.hidden) return;
        console.log(NOTES[Math.random() * NOTES.length | 0] + ' — "' + fig.name + '"');
      }, fig.pts.length * 300 + 1200);
      // tidy the plate once the fade-out finishes
      setTimeout(() => { plate.innerHTML = ""; }, 3000 + fig.pts.length * 300 + 9500);
    }
    setTimeout(survey, 150000 + Math.random() * 90000);
  }
  setTimeout(survey, 40000 + Math.random() * 40000);
})();

// code rain — every ~2-4 min for a couple of seconds thin columns of falling
// code glyphs sprinkle down from the top of the viewport, glowing softly,
// then dissolve before the rain was ever noticed
(function codeRain() {
  const rain = document.createElement("div");
  rain.className = "code-rain";
  document.body.appendChild(rain);
  const glyphs = "{}[]()<>/*;=+-_#%&$@!?~^|01";
  function column() {
    let text = "";
    const len = 8 + Math.floor(Math.random() * 14);
    for (let i = 0; i < len; i++) text += glyphs[Math.floor(Math.random() * glyphs.length)];
    return text;
  }
  function pour() {
    if (!document.hidden) {
      const count = 8 + Math.floor(Math.random() * 7);
      const drops = [];
      for (let i = 0; i < count; i++) {
        const d = document.createElement("span");
        d.textContent = column();
        d.style.left = (Math.random() * 98).toFixed(1) + "vw";
        d.style.setProperty("--cr-dur", (1600 + Math.random() * 1600).toFixed(0) + "ms");
        d.style.setProperty("--cr-delay", (Math.random() * 1200).toFixed(0) + "ms");
        d.style.fontSize = (9 + Math.floor(Math.random() * 5)) + "px";
        rain.appendChild(d);
        drops.push(d);
      }
      setTimeout(() => drops.forEach(d => d.remove()), 5200);
    }
    setTimeout(pour, 120000 + Math.random() * 120000);
  }
  setTimeout(pour, 35000 + Math.random() * 35000);
})();

// snail visitor — every ~2-4 min a tiny snail with a glowing shell slowly
// creeps along the bottom edge of the viewport, leaving a shimmering slime
// trail that fades behind it, then crawls out of sight
(function snailVisitor() {
  const snail = document.createElement("div");
  snail.className = "snail";
  const trail = document.createElement("div");
  trail.className = "snail-trail";
  document.body.appendChild(trail);
  document.body.appendChild(snail);
  function crawl() {
    if (!document.hidden) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const dur = (22000 + Math.random() * 12000).toFixed(0) + "ms";
      snail.style.setProperty("--sn-from", dir === 1 ? "-6vw" : "106vw");
      snail.style.setProperty("--sn-to", dir === 1 ? "106vw" : "-6vw");
      snail.style.setProperty("--sn-dur", dur);
      snail.style.setProperty("--sn-flip", dir === 1 ? "1" : "-1");
      trail.style.setProperty("--sn-from", dir === 1 ? "-6vw" : "106vw");
      trail.style.setProperty("--sn-dur", dur);
      snail.classList.remove("crawl");
      trail.classList.remove("crawl");
      void snail.offsetWidth;
      snail.classList.add("crawl");
      trail.classList.add("crawl");
    }
    setTimeout(crawl, 120000 + Math.random() * 120000);
  }
  setTimeout(crawl, 45000 + Math.random() * 45000);
})();

// meteor streak — every ~3-6 min a bright shooting star dashes across the top
// of the viewport at a shallow angle, trailing sparks that fade as it burns out
(function meteorStreak() {
  const el = document.createElement("div");
  el.className = "meteor";
  document.body.appendChild(el);
  function fly() {
    if (!document.hidden) {
      const startX = Math.random() * (innerWidth * 0.7);
      const startY = 20 + Math.random() * (innerHeight * 0.25);
      const drift = 300 + Math.random() * 300;
      el.style.left = startX + "px";
      el.style.top = startY + "px";
      el.style.setProperty("--meteor-dx", drift + "px");
      el.style.setProperty("--meteor-dy", drift * 0.35 + "px");
      el.classList.add("fly");
      setTimeout(() => {
        el.classList.remove("fly");
        schedule();
      }, 1600);
    } else schedule();
  }
  function schedule() { setTimeout(fly, 180000 + Math.random() * 180000); }
  setTimeout(fly, 25000 + Math.random() * 40000);
})();

// shooting star — every so often a bright star streaks diagonally across the
// upper sky with a tapering trail, burns out mid-flight, and is gone
(function shootingStar() {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = document.createElement("div");
  el.className = "shooting-star";
  document.body.appendChild(el);
  function fly() {
    if (!document.hidden) {
      const startX = innerWidth * (0.05 + Math.random() * 0.55);
      const startY = innerHeight * (0.03 + Math.random() * 0.2);
      const dx = innerWidth * (0.25 + Math.random() * 0.3);
      const dy = innerHeight * (0.15 + Math.random() * 0.2);
      const angle = Math.atan2(dy, dx);
      el.style.left = startX + "px";
      el.style.top = startY + "px";
      el.style.setProperty("--ss-dx", dx + "px");
      el.style.setProperty("--ss-dy", dy + "px");
      el.style.setProperty("--ss-angle", angle.toFixed(3) + "rad");
      el.style.setProperty("--ss-dur", (900 + Math.random() * 600).toFixed(0) + "ms");
      el.classList.remove("fly");
      void el.offsetWidth;
      el.classList.add("fly");
      setTimeout(() => el.classList.remove("fly"), 1700);
    }
    setTimeout(fly, 60000 + Math.random() * 90000);
  }
  setTimeout(fly, 20000 + Math.random() * 30000);
})();

// rubber duck debug companion
(function rubberDuck() {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  function spawn() {
    if (!document.hidden) {
      const duck = document.createElement("div");
      duck.className = "rubber-duck";
      const left = innerWidth * (0.08 + Math.random() * 0.6);
      const dur = 9000 + Math.random() * 5000;
      duck.style.left = left + "px";
      duck.style.setProperty("--rd-dur", dur + "ms");
      document.body.appendChild(duck);
      const quack = document.createElement("span");
      quack.className = "rd-quack";
      quack.textContent = "quack.";
      duck.appendChild(quack);
      setTimeout(() => quack.classList.add("show"), dur * 0.35);
      setTimeout(() => duck.classList.add("leave"), dur - 1600);
      setTimeout(() => duck.remove(), dur + 500);
    }
    setTimeout(spawn, 120000 + Math.random() * 120000);
  }
  setTimeout(spawn, 25000 + Math.random() * 30000);
})();

// pixel dust — every click bursts a small puff of tiny colored squares
// that drift outward and fade away over about a second
(function pixelDust() {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const COLORS = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#c77dff", "#ff9f1c"];
  addEventListener("mousedown", e => {
    if (document.hidden) return;
    const n = 20 + Math.floor(Math.random() * 21);
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "pixel-dust";
      const size = 3 + Math.floor(Math.random() * 4);
      const ang = Math.random() * Math.PI * 2;
      const dist = 25 + Math.random() * 55;
      p.style.width = size + "px";
      p.style.height = size + "px";
      p.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
      p.style.left = e.clientX + "px";
      p.style.top = e.clientY + "px";
      p.style.setProperty("--pd-dx", (Math.cos(ang) * dist).toFixed(1) + "px");
      p.style.setProperty("--pd-dy", (Math.sin(ang) * dist - 15).toFixed(1) + "px");
      p.style.setProperty("--pd-dur", (700 + Math.random() * 700).toFixed(0) + "ms");
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1500);
    }
  });
})();


// jellyfish — every ~2-4 min a translucent jellyfish drifts up the page,
// pulsing, then fades out near the top like the tide was never there
(function jellyfish() {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  function spawn() {
    if (!document.hidden) {
      const el = document.createElement("div");
      el.className = "jellyfish";
      const dur = 20000 + Math.random() * 9000;
      el.style.setProperty("--jf-x", (innerWidth * (0.08 + Math.random() * 0.8)).toFixed(0) + "px");
      el.style.setProperty("--jf-dur", dur.toFixed(0) + "ms");
      el.style.setProperty("--jf-sway", (Math.random() * 50 - 25).toFixed(0) + "px");
      const bell = document.createElement("span");
      bell.className = "jelly-bell";
      el.appendChild(bell);
      for (let i = 0; i < 5; i++) {
        const t = document.createElement("span");
        t.className = "jelly-tentacle";
        t.style.setProperty("--jf-tx", (12 + i * 9) + "px");
        t.style.setProperty("--jf-i", i);
        el.appendChild(t);
      }
      document.body.appendChild(el);
      setTimeout(() => el.remove(), dur + 1500);
    }
    setTimeout(spawn, 120000 + Math.random() * 120000);
  }
  setTimeout(spawn, 30000 + Math.random() * 30000);
})();

// periscope — every ~2-4 min a submarine periscope rises from the bottom of
// the page, sweeps slowly across with a lens glint, blips in the console,
// then sinks back below the edge like the coast was never watched
(function periscope() {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  function scan() {
    if (!document.hidden) {
      const el = document.createElement("div");
      el.className = "periscope";
      const dur = 14000 + Math.random() * 7000;
      el.style.setProperty("--ps-x", (innerWidth * (0.1 + Math.random() * 0.8)).toFixed(0) + "px");
      el.style.setProperty("--ps-dur", dur.toFixed(0) + "ms");
      el.style.setProperty("--ps-sweep", (Math.random() * 120 - 60).toFixed(0) + "deg");
      const tube = document.createElement("span");
      tube.className = "ps-tube";
      const head = document.createElement("span");
      head.className = "ps-head";
      const glint = document.createElement("span");
      glint.className = "ps-glint";
      head.appendChild(glint);
      tube.appendChild(head);
      el.appendChild(tube);
      document.body.appendChild(el);
      setTimeout(() => console.log("periscope blip: all clear on deck"), dur * 0.4);
      setTimeout(() => el.remove(), dur + 1500);
    }
    setTimeout(scan, 120000 + Math.random() * 120000);
  }
  setTimeout(scan, 30000 + Math.random() * 30000);
})();

// lighthouse — every ~2-4 min a small lighthouse with a rotating beam sweeps
// once across the page, its beam briefly illuminating what it passes over,
// then it sinks back below the edge like the coast was never watched
(function lighthouse() {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  function shine() {
    if (!document.hidden) {
      const el = document.createElement("div");
      el.className = "lighthouse";
      const dur = 14000 + Math.random() * 7000;
      el.style.setProperty("--lh-x", (innerWidth * (0.05 + Math.random() * 0.9)).toFixed(0) + "px");
      el.style.setProperty("--lh-dur", dur.toFixed(0) + "ms");
      const tower = document.createElement("span");
      tower.className = "lh-tower";
      const lamp = document.createElement("span");
      lamp.className = "lh-lamp";
      const beam = document.createElement("span");
      beam.className = "lh-beam";
      el.style.setProperty("--lh-sweep", (Math.random() * 70 - 35).toFixed(0) + "deg");
      tower.appendChild(lamp);
      el.appendChild(tower);
      el.appendChild(beam);
      document.body.appendChild(el);
      setTimeout(() => console.log("lighthouse sweep: the coast is quiet tonight"), dur * 0.45);
      setTimeout(() => el.remove(), dur + 1500);
    }
    setTimeout(shine, 120000 + Math.random() * 120000);
  }
  setTimeout(shine, 40000 + Math.random() * 30000);
})();

// meteor shower — every ~2-4 min a brief shower of meteors streaks out of one
// corner of the upper sky over a few seconds, each burning with a fading trail,
// then the sky dries up like the shower was never there
(function meteorShower() {
  const meteors = [];
  let showerUntil = 0, nextShowerAt = performance.now() + 120000 * (.7 + Math.random() * .6);
  function spawn(fromLeft) {
    const speed = 9 + Math.random() * 6;
    meteors.push({
      x: fromLeft ? -20 : canvas.width + 20,
      y: Math.random() * canvas.height * .35,
      vx: speed * (fromLeft ? 1 : -1), vy: speed * (.35 + Math.random() * .25),
      life: 1, len: 40 + Math.random() * 50
    });
  }
  function showerTick(now) {
    if (!showerUntil && now > nextShowerAt) {
      showerUntil = now + 4200;
      setTimeout(() => console.log("a meteor shower burns across the sky, then is gone"), 4600);
    }
    if (showerUntil) {
      if (now < showerUntil) { if (Math.random() < .35) spawn(showerUntil % 8400 < 4200); }
      else { showerUntil = 0; nextShowerAt = now + 120000 * (.7 + Math.random() * .6); }
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.x += m.vx; m.y += m.vy; m.life -= .008;
      if (m.life <= 0 || m.y > canvas.height) { meteors.splice(i, 1); continue; }
      // tapering trail behind the head
      ctx.strokeStyle = `rgba(220,255,235,${.85 * m.life})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx / Math.hypot(m.vx, m.vy) * m.len, m.y - m.vy / Math.hypot(m.vx, m.vy) * m.len);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(m.x, m.y, 1.4, 0, 7);
      ctx.fillStyle = `rgba(230,255,240,${.9 * m.life})`;
      ctx.fill();
    }
    requestAnimationFrame(showerTick);
  }
  requestAnimationFrame(showerTick);
})();

// meteor streak — every ~2-4 min an occasional shooting star crosses the upper
// sky, shedding a trail of small fading particles behind it as it burns,
// then the sky goes quiet again like the star was never there
(function meteorParticleStreak() {
  const parts = [];
  let nextAt = performance.now() + 120000 * (.7 + Math.random() * .6);
  let star = null;
  function spawn() {
    const speed = 8 + Math.random() * 6;
    const dir = Math.random() < .5 ? 1 : -1;
    star = {
      x: dir > 0 ? -20 : canvas.width + 20,
      y: Math.random() * canvas.height * .3,
      vx: speed * dir, vy: speed * (.3 + Math.random() * .2),
      life: 1
    };
  }
  function tick(now) {
    if (!star && now > nextAt) {
      spawn();
      setTimeout(() => console.log("a shooting star crosses the page, scattering sparks"), 4200);
    }
    if (star) {
      star.x += star.vx; star.y += star.vy; star.life -= .004;
      // shed fading particles behind the head
      if (Math.random() < .6) {
        parts.push({
          x: star.x + (Math.random() - .5) * 4,
          y: star.y + (Math.random() - .5) * 4,
          vx: -star.vx * (.1 + Math.random() * .15) + (Math.random() - .5),
          vy: -star.vy * (.1 + Math.random() * .15) + (Math.random() - .5) + .3,
          life: .9 + Math.random() * .3, size: 1 + Math.random() * 1.6
        });
      }
      if (star.life <= 0 || star.x < -40 || star.x > canvas.width + 40 || star.y > canvas.height) {
        star = null; nextAt = now + 120000 * (.7 + Math.random() * .6);
      } else {
        ctx.beginPath();
        ctx.arc(star.x, star.y, 1.6, 0, 7);
        ctx.fillStyle = `rgba(235,245,255,${.95 * star.life})`;
        ctx.fill();
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += .008; p.life -= .012;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, 7);
      ctx.fillStyle = `rgba(255,225,170,${Math.min(.85, p.life)})`;
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// comet streak — every ~2-4 min a comet with a long glowing tail crosses the
// sky on a shallow diagonal, its tail streaming and fading behind the head,
// then it burns out past the far edge like the comet was never sighted
(function cometStreak() {
  let comet = null;
  let nextAt = performance.now() + 120000 * (.7 + Math.random() * .6);
  function spawn() {
    const speed = 9 + Math.random() * 5;
    const dir = Math.random() < .5 ? 1 : -1;
    comet = {
      x: dir > 0 ? -30 : canvas.width + 30,
      y: Math.random() * canvas.height * .28,
      vx: speed * dir, vy: speed * (.22 + Math.random() * .15),
      life: 1
    };
  }
  function tick(now) {
    if (!comet && now > nextAt) {
      spawn();
      setTimeout(() => console.log("a comet crosses the night sky, trailing light"), 5200);
    }
    if (comet) {
      comet.x += comet.vx; comet.y += comet.vy; comet.life -= .0035;
      const c = comet;
      const n = Math.hypot(c.vx, c.vy);
      const tx = -c.vx / n, ty = -c.vy / n;
      // tapering glowing tail drawn as several segments shrinking behind the head
      for (let s = 0; s < 9; s++) {
        const f = s / 9;
        const a = (1 - f) * .55 * c.life;
        if (a <= 0) break;
        ctx.beginPath();
        ctx.moveTo(c.x + tx * f * 90, c.y + ty * f * 90);
        ctx.lineTo(c.x + tx * (f + 1 / 9) * 90, c.y + ty * (f + 1 / 9) * 90);
        ctx.lineWidth = 2.6 * (1 - f) + .4;
        ctx.strokeStyle = `rgba(200,225,255,${a})`;
        ctx.stroke();
      }
      // bright ice-blue head with a soft halo
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 9);
      g.addColorStop(0, `rgba(240,248,255,${.9 * c.life})`);
      g.addColorStop(1, 'rgba(240,248,255,0)');
      ctx.beginPath();
      ctx.arc(c.x, c.y, 9, 0, 7);
      ctx.fillStyle = g;
      ctx.fill();
      if (c.life <= 0 || c.x < -110 || c.x > canvas.width + 110 || c.y > canvas.height) {
        comet = null; nextAt = now + 120000 * (.7 + Math.random() * .6);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// sky lantern — every ~2-4 min a small glowing paper lantern drifts up from
// the bottom of the page, swaying gently as it rises, its flame flickering,
// then it fades out high up like the wish was never made
(function skyLantern() {
  let lantern = null;
  let nextAt = performance.now() + 120000 * (.7 + Math.random() * .6);
  let t = 0;
  function spawn() {
    lantern = {
      x: canvas.width * (.15 + Math.random() * .7),
      y: canvas.height + 40,
      vx: (Math.random() - .5) * .35,
      vy: -(.45 + Math.random() * .3),
      sway: Math.random() * 6.28,
      swaySpeed: .015 + Math.random() * .01,
      life: 1
    };
  }
  function drawLantern(l, flick) {
    const w = 13, h = 17;
    // warm glow halo around the whole lantern
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 34);
    g.addColorStop(0, `rgba(255,190,110,${.28 * l.life})`);
    g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.beginPath();
    ctx.arc(l.x, l.y, 34, 0, 7);
    ctx.fillStyle = g;
    ctx.fill();
    // paper body — slightly tapered rounded trapezoid
    ctx.beginPath();
    ctx.moveTo(l.x - w / 2, l.y - h / 2);
    ctx.quadraticCurveTo(l.x - w * .62, l.y, l.x - w / 2, l.y + h / 2);
    ctx.lineTo(l.x + w / 2, l.y + h / 2);
    ctx.quadraticCurveTo(l.x + w * .62, l.y, l.x + w / 2, l.y - h / 2);
    ctx.closePath();
    ctx.fillStyle = `rgba(255,170,90,${.5 * l.life})`;
    ctx.fill();
    // darker paper rim
    ctx.strokeStyle = `rgba(180,90,40,${.5 * l.life})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    // flickering flame seen through the paper
    ctx.beginPath();
    ctx.ellipse(l.x, l.y + 2, 3.2 + flick, 4.5 + flick * 1.2, 0, 0, 7);
    ctx.fillStyle = `rgba(255,235,170,${(.65 + flick * .08) * l.life})`;
    ctx.fill();
    // top opening
    ctx.beginPath();
    ctx.moveTo(l.x - w / 2 + 1.5, l.y - h / 2);
    ctx.lineTo(l.x + w / 2 - 1.5, l.y - h / 2);
    ctx.strokeStyle = `rgba(120,60,25,${.55 * l.life})`;
    ctx.stroke();
  }
  function tick(now) {
    if (!lantern && now > nextAt) {
      spawn();
      t = 0;
      setTimeout(() => console.log("a paper lantern rises, carrying a small wish"), 6400);
    }
    if (lantern) {
      t++;
      const l = lantern;
      l.sway += l.swaySpeed;
      l.x += l.vx + Math.sin(l.sway) * .5;
      l.y += l.vy;
      l.vy *= .9995;
      l.life -= .0006;
      const flick = Math.sin(t * .35) * .6 + Math.sin(t * .13) * .4;
      drawLantern(l, flick);
      if (l.life <= 0 || l.y < -60) {
        lantern = null; nextAt = now + 120000 * (.7 + Math.random() * .6);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// falling leaf — every ~2-4 min a small autumn leaf tumbles down through the
// page, rocking and spiralling on the breeze, then settles out of sight like
// the wind was never there
(function fallingLeaf() {
  let leaf = null;
  let nextAt = performance.now() + 120000 * (.7 + Math.random() * .6);
  let t = 0;
  function spawn() {
    leaf = {
      x: canvas.width * (.1 + Math.random() * .8),
      y: -30,
      vx: (Math.random() - .5) * .5,
      vy: .55 + Math.random() * .35,
      sway: Math.random() * 6.28,
      swaySpeed: .02 + Math.random() * .015,
      spin: Math.random() * 6.28,
      spinSpeed: .05 + Math.random() * .04,
      hue: 20 + Math.random() * 30,
      life: 1
    };
  }
  function drawLeaf(l) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.spin + Math.sin(l.sway) * .8);
    const w = 11, h = 15;
    // leaf blade — pointed oval, slightly asymmetric
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.quadraticCurveTo(w, -h * .15, 0, h / 2);
    ctx.quadraticCurveTo(-w, -h * .15, 0, -h / 2);
    ctx.fillStyle = `hsla(${l.hue}, 72%, 52%, ${.9 * l.life})`;
    ctx.fill();
    // stem
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(-1.5, h / 2 + 4);
    ctx.strokeStyle = `hsla(${l.hue}, 55%, 34%, ${.8 * l.life})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // midrib vein
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 + 2);
    ctx.lineTo(0, h / 2 - 2);
    ctx.strokeStyle = `hsla(${l.hue}, 60%, 30%, ${.6 * l.life})`;
    ctx.stroke();
    ctx.restore();
  }
  function tick(now) {
    if (!leaf && now > nextAt) {
      spawn();
      t = 0;
      setTimeout(() => console.log("a leaf lets go of the branch"), 6400);
    }
    if (leaf) {
      t++;
      const l = leaf;
      l.sway += l.swaySpeed;
      l.spin += l.spinSpeed + Math.sin(l.sway) * .02;
      l.x += l.vx + Math.sin(l.sway) * .9;
      l.y += l.vy + Math.cos(l.sway * .5) * .25;
      l.vx *= .999;
      if (l.y > canvas.height + 50 || l.x < -60 || l.x > canvas.width + 60) {
        leaf = null; nextAt = now + 120000 * (.7 + Math.random() * .6);
      } else {
        drawLeaf(l);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// drifting cloud — every ~2-4 min a soft fluffy cloud crosses the high sky,
// its pale shadow sliding along the ground beneath it, then both drift away
// like the weather was never there
(function driftingCloud() {
  let cloud = null;
  let nextAt = performance.now() + 120000 * (.7 + Math.random() * .6);
  let t = 0;
  function spawn() {
    cloud = {
      x: -160,
      dir: Math.random() < .5 ? 1 : -1,
      y: canvas.height * (.08 + Math.random() * .12),
      vx: .35 + Math.random() * .25,
      bob: Math.random() * 6.28,
      bobSpeed: .012 + Math.random() * .008,
      puffs: Array.from({ length: 6 }, (_, i) => ({
        ox: i * 34 - 85 + (Math.random() - .5) * 12,
        oy: (Math.random() - .5) * 14,
        r: 26 + Math.random() * 18
      })),
      life: 1
    };
    if (cloud.dir < 0) { cloud.x = canvas.width + 160; cloud.vx = -cloud.vx; }
  }
  function drawCloud(l) {
    // shadow on the ground — soft dark ellipse trailing beneath the cloud
    const shadowY = canvas.height - 24;
    const shadowX = l.x + l.dir * 40;
    ctx.save();
    ctx.globalAlpha = .1 * l.life;
    ctx.filter = "blur(8px)";
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, 120, 22, 0, 0, 6.29);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();
    // the cloud itself
    ctx.save();
    ctx.translate(l.x, l.y + Math.sin(l.bob) * 4);
    ctx.globalAlpha = .92 * l.life;
    for (const p of l.puffs) {
      ctx.beginPath();
      ctx.arc(p.ox, p.oy, p.r, 0, 6.29);
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, 12, 130, 30, 0, 0, 6.29);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fill();
    ctx.restore();
  }
  function tick(now) {
    if (!cloud && now > nextAt) {
      spawn();
      t = 0;
      setTimeout(() => console.log("a cloud wanders by, dragging its shadow along the ground"), 6400);
    }
    if (cloud) {
      t++;
      const l = cloud;
      l.bob += l.bobSpeed;
      l.x += l.vx;
      if (l.dir > 0 && l.x > canvas.width + 200 || l.dir < 0 && l.x < -200) {
        cloud = null; nextAt = now + 120000 * (.7 + Math.random() * .6);
      } else {
        drawCloud(l);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// fireflies — every few minutes a couple of tiny glowing fireflies drifts
// lazily around the page, flickering softly, then fades away into the dark
// like the summer night was never there
(function fireflies() {
  const layer = document.createElement("div");
  layer.className = "fireflies";
  document.body.appendChild(layer);
  function release() {
    const count = 2 + (Math.random() * 3 | 0);
    const cx = 80 + Math.random() * (innerWidth - 160);
    const cy = 80 + Math.random() * (innerHeight - 160);
    layer.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.className = "firefly-dot";
      layer.appendChild(el);
      const seed = Math.random() * Math.PI * 2;
      const wander = 50 + Math.random() * 90;
      const ox = cx + (Math.random() - .5) * 60, oy = cy + (Math.random() - .5) * 60;
      const blinkSpeed = 1.2 + Math.random() * 1.6;
      const dur = 9000 + Math.random() * 6000;
      const start = performance.now();
      (function drift(now) {
        const t = (now - start) / dur;
        if (t >= 1) { el.remove(); return; }
        const a = seed + t * 4 + Math.sin(now * .0006 + seed) * 2;
        const fade = Math.min(1, t * 6, (1 - t) * 6);
        el.style.transform = `translate(${ox + Math.cos(a) * wander * t + Math.sin(now * .001 + seed) * 10}px, ${oy + Math.sin(a * 1.3) * wander * t}px)`;
        el.style.opacity = (Math.max(0, (.3 + .7 * Math.max(0, Math.sin(now * .001 * blinkSpeed + seed)))) * fade).toFixed(2);
        requestAnimationFrame(drift);
      })(start);
    }
    setTimeout(release, 150000 + Math.random() * 90000);
  }
  setTimeout(release, 40000 + Math.random() * 40000);
})();

// fireflies — every ~2-4 min a small swarm of fireflies drifts up from the
// lower sky, each pulsing softly in and out of the dark, then the swarm
// scatters and the night is still like nobody saw them
(function fireflies() {
  const flies = [];
  let nextAt = performance.now() + 120000 * (.7 + Math.random() * .6);
  function spawnSwarm() {
    const n = 7 + Math.floor(Math.random() * 6);
    const cx = canvas.width * (.25 + Math.random() * .5);
    const cy = canvas.height * (.55 + Math.random() * .2);
    for (let i = 0; i < n; i++) {
      flies.push({
        x: cx + (Math.random() - .5) * 160,
        y: cy + (Math.random() - .5) * 90,
        vx: (Math.random() - .5) * .3,
        vy: -.08 - Math.random() * .18,
        phase: Math.random() * Math.PI * 2,
        pulse: .02 + Math.random() * .03,
        life: 1
      });
    }
    setTimeout(() => console.log("a swarm of fireflies drifts up through the dark, then is gone"), 9000);
  }
  function tick(now) {
    if (flies.length === 0 && now > nextAt) spawnSwarm();
    for (let i = flies.length - 1; i >= 0; i--) {
      const f = flies[i];
      f.x += f.vx + Math.sin(now / 900 + f.phase) * .15;
      f.y += f.vy + Math.cos(now / 1100 + f.phase) * .1;
      f.life -= .0012;
      if (f.life <= 0) { flies.splice(i, 1); continue; }
      const glow = Math.max(0, Math.sin(now / 1000 * f.pulse * 60 + f.phase)) * f.life;
      if (glow < .05) continue;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 1.3, 0, 7);
      ctx.fillStyle = `rgba(220,255,140,${.85 * glow})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(f.x, f.y, 4, 0, 7);
      ctx.fillStyle = `rgba(220,255,140,${.12 * glow})`;
      ctx.fill();
    }
    if (flies.length === 0 && now > nextAt + 1) nextAt = now + 120000 * (.7 + Math.random() * .6);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// worms after rain — every ~2-4 min a brief drizzle sweeps the page, then a
// few earthworms surface from the bottom edge and wriggle across before
// burrowing back down like the soil was never disturbed
(function wormsAfterRain() {
  const drizzle = document.createElement("div");
  drizzle.style.cssText = "position:fixed;inset:0;z-index:2;pointer-events:none;opacity:0;transition:opacity 1.5s ease-in-out;";
  document.body.appendChild(drizzle);
  const drops = [];
  for (let i = 0; i < 46; i++) {
    const d = document.createElement("div");
    d.style.cssText =
      "position:absolute;top:-40px;width:1px;border-radius:1px;" +
      "background:linear-gradient(rgba(160,210,255,0),rgba(160,210,255,.5));" +
      "height:" + (10 + Math.random() * 16).toFixed(0) + "px;left:" + (Math.random() * 100).toFixed(2) + "%;";
    drizzle.appendChild(d);
    drops.push({ el: d, speed: .38 + Math.random() * .3, phase: Math.random() * 2000, drift: .04 + Math.random() * .05 });
  }

  function makeWorm() {
    const worm = document.createElement("div");
    worm.style.cssText = "position:fixed;z-index:3;left:0;top:0;pointer-events:none;will-change:transform;";
    worm.innerHTML =
      '<svg width="64" height="28" viewBox="0 0 64 28" style="display:block">' +
        '<path id="worm-body" d="" fill="none" stroke="rgba(198,152,120,.9)" stroke-width="4.5" stroke-linecap="round"/>' +
      "</svg>";
    document.body.appendChild(worm);
    return worm;
  }

  function crawl(worm) {
    const body = worm.querySelector("#worm-body");
    const dir = Math.random() < .5 ? 1 : -1;
    const scale = .85 + Math.random() * .4;
    const y0 = innerHeight - 26 * scale - 1;
    const fromX = dir > 0 ? -70 : innerWidth + 70;
    const toX = dir > 0 ? innerWidth + 70 : -70;
    const dur = 22000 + Math.random() * 14000;

    (function frame(now) {
      const p = Math.min(1, (now % 1e7) / dur); // progress across the page
      const x = fromX + (toX - fromX) * p;
      // peristaltic undulation: sine wave travelling down the body
      const phase = now / 260;
      let dPath = "";
      for (let i = 0; i <= 12; i++) {
        const sx = 6 + i * 4.5;
        const sy = 16 + Math.sin(phase + i * .62) * 5.5;
        dPath += (i === 0 ? "M" : "L") + sx.toFixed(1) + " " + sy.toFixed(1);
      }
      body.setAttribute("d", dPath);
      worm.style.transform =
        "translate(" + x + "px," + y0 + "px) scaleX(" + (dir * scale) + ") scaleY(" + scale + ")";
      if (p < 1) requestAnimationFrame(frame);
      else {
        // burrow back down: slip below the bottom edge and vanish
        worm.style.transition = "transform 2.2s ease-in, opacity 2.2s ease-in";
        worm.style.opacity = "0";
        worm.style.transform =
          "translate(" + x + "px," + (y0 + 34) + "px) scaleX(" + (dir * scale) + ") scaleY(" + scale + ")";
        setTimeout(() => worm.remove(), 2400);
      }
    })(performance.now());
  }

  function cycle() {
    const now = performance.now();
    // the drizzle: streaks fall for ~7s, slanting slightly on the wind
    drizzle.style.opacity = "1";
    let t0 = null;
    (function rain(ts) {
      if (t0 === null) t0 = ts;
      const t = ts - t0;
      for (const dr of drops) {
        const y = (t * dr.speed + dr.phase) % (innerHeight + 60) - 40;
        dr.el.style.transform = "translate(" + (t * dr.drift) + "px," + y + "px)";
      }
      if (t < 7000) requestAnimationFrame(rain);
      else {
        drizzle.style.opacity = "0";
        // the worms surface once the ground is wet enough
        const n = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) setTimeout(() => crawl(makeWorm()), 1500 + i * (3500 + Math.random() * 2500));
        setTimeout(cycle, 150000 + Math.random() * 150000);
      }
    })(now);
  }
  setTimeout(cycle, 50000 + Math.random() * 40000);
})();

// chalk doodle — every ~2-3 min a hand-drawn chalk doodle (a smiley, star,
// spiral or fish) sketches itself onto its own overlay canvas stroke by stroke,
// lingers a moment, then is wiped away like the blackboard was never used
(function chalkDoodle() {
  // each doodle is a list of polylines in a 0..1 unit box
  const DOODLES = {
    smiley: [
      [[.2, .35], [.3, .25], [.4, .35]],              // left eye
      [[.6, .35], [.7, .25], [.8, .35]],              // right eye
      [[.25, .6], [.38, .75], [.62, .75], [.75, .6]]  // smile
    ],
    star: [
      // five-pointed star drawn in one stroke
      [[.5, .1], [.59, .38], [.9, .38], [.66, .56], [.74, .85],
       [.5, .68], [.26, .85], [.34, .56], [.1, .38], [.41, .38], [.5, .1]]
    ],
    spiral: [
      // archimedean spiral, one continuous stroke
      Array.from({ length: 40 }, (_, i) => {
        const a = i / 39 * Math.PI * 4, r = i / 39 * .42;
        return [.5 + Math.cos(a) * r, .5 + Math.sin(a) * r];
      })
    ],
    fish: [
      [[.15, .5], [.35, .3], [.65, .35], [.8, .5], [.65, .65], [.35, .7], [.15, .5]], // body
      [[.8, .5], [.95, .35], [.95, .65], [.8, .5]]                                    // tail
    ]
  };
  const NAMES = Object.keys(DOODLES);
  const board = document.createElement("canvas");
  board.style.cssText = "position:fixed;inset:0;z-index:1;pointer-events:none;";
  document.body.appendChild(board);
  const bctx = board.getContext("2d");
  function sizeBoard() { board.width = innerWidth; board.height = innerHeight; }
  sizeBoard(); addEventListener("resize", sizeBoard);

  function draw() {
    const name = NAMES[Math.random() * NAMES.length | 0];
    const lines = DOODLES[name];
    const size = 90 + Math.random() * 60;
    const ox = Math.random() * (canvas.width - size - 40) + 20;
    const oy = Math.random() * (canvas.height - size - 40) + 20;
    const strokes = lines.map(line => line.map(([x, y]) => [ox + x * size, oy + y * size]));
    const total = strokes.reduce((s, l) => s + l.length, 0);
    let drawn = 0;
    const sketch = setInterval(() => {
      drawn += Math.max(1, Math.ceil(total / 30));
      bctx.clearRect(0, 0, board.width, board.height);
      bctx.strokeStyle = "rgba(220,255,235,.55)"; // chalk white-green
      bctx.lineWidth = 1.6;
      bctx.lineJoin = "round";
      bctx.lineCap = "round";
      let left = drawn;
      for (const line of strokes) {
        if (left <= 0) break;
        bctx.beginPath();
        bctx.moveTo(line[0][0], line[0][1]);
        const pts = Math.min(line.length, left);
        for (let i = 1; i < pts; i++) bctx.lineTo(line[i][0], line[i][1]);
        bctx.stroke();
        left -= pts;
      }
      if (drawn >= total) {
        clearInterval(sketch);
        // linger, then wipe the board like nothing was ever written
        setTimeout(() => {
          bctx.clearRect(0, 0, board.width, board.height);
          console.log(`chalkboard erased: the ${name} was never graded`);
        }, 4000);
      }
    }, 90);
    setTimeout(draw, 120000 + Math.random() * 90000);
  }
  setTimeout(draw, 40000 + Math.random() * 40000);
})();

// boomerang toss — every ~2-4 min a boomerang launches from a random spot,
// flies out along a sweeping arc while spinning, curves back through the sky
// and returns to the exact point it was thrown from, then fades away like the
// thrower was never there
(function boomerangToss() {
  let t = null, nextAt = performance.now() + 70000 * (.7 + Math.random() * .6);
  function step(now) {
    if (!t && now > nextAt) {
      t = {
        x0: canvas.width * (.18 + Math.random() * .64),
        y0: canvas.height * (.25 + Math.random() * .3),
        ang: Math.random() * Math.PI * 2,
        dir: Math.random() < .5 ? 1 : -1,
        spin: Math.random() * 7,
        start: now,
        dur: 6500 + Math.random() * 2500
      };
      setTimeout(() => console.log("boomerang log: it always comes back"), t.dur * .55);
    }
    if (t) {
      const p = (now - t.start) / t.dur;
      if (p >= 1) { t = null; nextAt = now + 150000 * (.7 + Math.random() * .6); }
      else {
        // out along a curving arc, then the same path home
        const out = Math.sin(p * Math.PI);
        const ang = t.ang + t.dir * p * Math.PI * .9;
        const x = t.x0 + Math.cos(ang) * 260 * out;
        const y = t.y0 + Math.sin(ang) * 160 * out - Math.sin(p * Math.PI) * 30;
        const a = Math.sin(p * Math.PI);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t.spin += .24);
        ctx.strokeStyle = `rgba(124,252,156,${.75 * a})`;
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-9, -5);
        ctx.quadraticCurveTo(0, 2, 9, -5); // bent V of the boomerang
        ctx.stroke();
        ctx.strokeStyle = `rgba(124,252,156,${.35 * a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-9, -5); ctx.lineTo(-6, 2);
        ctx.moveTo(9, -5); ctx.lineTo(6, 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();

// changelog
const changelog = [
  ["v0.221.0", "paper airplane — every ~2-4 min a folded paper airplane glides in from a screen edge, bobbing on the air with banking wobbles, does one loop mid-flight and veers off the far edge like the note was never thrown"],
  ["v0.220.0", "paper lantern — every ~2-4 min a glowing paper lantern lifts off from the bottom of the page and drifts upward on the warm air, swaying and flickering as it rises, then gutters out mid-sky like the wish was never made"],
  ["v0.219.0", "kite — every ~2-4 min a small kite swoops in from a screen edge and glides across the upper sky on a bobbing path, banked into the wind with its tail trailing and fluttering behind it, then drifts off the far edge like the wind was never flying it"],
  ["v0.218.0", "boomerang — every ~2-4 min a boomerang launches from a random spot on the page, flies out along a sweeping arc while spinning, curves back through the sky and returns to the exact point it was thrown from, then fades away like the thrower was never there"],
  ["v0.217.0", "balloon — every ~2-4 min a small balloon drifts up from the bottom of the page, sways gently on an invisible breeze with its string trailing below, and pops into a tiny confetti burst if you click it; otherwise it floats away off the top like a fairground you were never at"],
  ["v0.216.0", "fireflies — a loose swarm of tiny amber lights drifts across the page, each blinking on its own wavering rhythm with a soft glow, shying away from the cursor until it wanders off into the dark again"],
  ["v0.215.0", "lighthouse — every ~2-4 min a tiny lighthouse rises near the top of the page, its beam sweeping slow rotating arcs of light across the sky, then it dims and sinks away like the coast was never charted"],
  ["v0.214.0", "ekg pulse — a tiny heart monitor in the corner scrolls a steady green EKG line, occasionally flatlines in red for a breath, then finds its pulse again"],
  ["v0.213.0", "dandelion seed — every ~2-4 min a fluffy seed head drifts in from a screen edge on the breeze, and the moment it settles it bursts into a scatter of tiny parachutes that flutter away on their own little journeys"],
  ["v0.212.0", "frog visitor — every ~3-5 min a small frog hops in from a screen edge, crouches blinking while its throat bulges, then turns around and hops back out like the pond was never here"],
  ["v0.211.0", "chalk doodle — every ~2-3 min a hand-drawn chalk doodle (a smiley, star, spiral or fish) sketches itself onto the background, lingers for a moment, then is wiped away like the blackboard was never used"],
  ["v0.210.0", "mushroom ring — every ~2-4 min a small fairy ring of mushrooms sprouts from the bottom of the page, caps swelling as they push through and swaying gently, then the whole ring quietly sinks back down like nobody knelt to check it"],
  ["v0.209.0", "worms after rain — every ~2-4 min a brief drizzle sweeps the page, then 2-3 earthworms surface from the bottom edge and wriggle across it with a peristaltic ripple, then burrow back down like the soil was never disturbed"],
  ["v0.208.0", "dandelion seed — every ~2-4 min a single dandelion seed drifts across the page on the breeze, tumbling slowly while its silky bristles sway, then it floats off the far edge like the wind never counted it"],
  ["v0.207.0", "paper airplane — every ~2-3 min a folded paper airplane glides across the page on a swaying path, launched from a screen edge, wobbling on the breeze with a gentle bank, then vanishes off the far edge like the flight was never logged"],
  ["v0.206.0", "fireflies at dusk — every ~2-4 min a small swarm of fireflies drifts up from the lower sky, each pulsing softly in and out of the dark, then the swarm scatters and the night is still like nobody saw them"],
  ["v0.205.0", "meteor shower — every ~1-2 min a small shooting star streaks across the upper sky with a glowing trail, flares and burns out mid-flight like it was never seen"],
  ["v0.204.0", "weather balloon — every ~2-4 min a small probe balloon inflates and lifts off from the bottom edge, drifts up across the sky on the wind with a gentle wobble, an instrument box dangling below, then fades away near the top like the reading was never logged"],
  ["v0.203.0", "radio telescope — every ~2-3 min a small dish rises from the bottom edge and slowly sweeps a faint signal beam across a swath of sky, then retracts back down like it never listened"],
  ["v0.202.0", "aurora borealis — every ~2-4 min soft bands of green/teal aurora light wave across the upper part of the page for a few seconds, rippling like a slow curtain, then dissolve back into the night sky like the solar wind was never there"],
  ["v0.200.0", "tumbleweed — every ~2-4 min a scraggly tumbleweed bounces in from one edge of the page and rolls across it, spinning and shedding the odd dry bit of itself as it goes, then tumbles off the far edge like the desert was never there"],
  ["v0.201.0", "shooting star — every ~2-5 min a shooting star streaks diagonally across the page, a bright line with a fading trail that blinks out before it leaves the sky"],
  ["v0.199.0", "fireflies — every few minutes a couple of tiny glowing fireflies drifts lazily around the page, flickering softly, then fades away into the dark like the summer night was never there"],
  ["v0.198.0", "dragonfly — every ~2-4 min an ASCII dragonfly darts across the page in quick zigzags, hovers in place for a moment as if considering the cursor, then zips off the far edge like the pond was never there"],
  ["v0.197.0", "paper airplane — every ~2-4 min a small paper plane swoops across the page along a gentle lazy arc, a dotted trail fading out behind it, then it slides off the far edge like the flight was never logged"],
  ["v0.196.0", "paper boat — every ~2-4 min a small origami paper boat bobs along the very bottom of the page, rocking on invisible gentle waves while faint ripples spread out behind it, then it drifts off the far edge like the paper pond was never there"],
  ["v0.195.0", "meteor shower — every ~2-4 min a brief shower of shooting stars streaks diagonally across the page, each with a fading glowing trail, then the sky clears like the comet was never there"],
  ["v0.194.0", "tea steam — every ~2-4 min a small steaming teacup settles near the bottom of the page, curling wisps of steam rise off it and dissolve, then the cup lifts away like the tea was never poured"],
  ["v0.193.0", "soap bubbles — every ~2-4 min a loose cluster of iridescent soap bubbles floats up from the bottom edge, wobbling gently on invisible soap-film winds, each popping apart in its own time like the bath was never run"],
  ["v0.192.0", "firefly swarm — every few minutes a loose swarm of tiny glowing fireflies drifts across the page, blinking softly as they wander, then fades away into the dark"],
  ["v0.191.0", "shooting star — every few minutes a meteor flashes across the upper page: a bright head with a fading trail streaks down-and-across and burns out in a couple of seconds"],
  ["v0.190.0", "dandelion — every ~2-4 min a dandelion puff sways in near an edge, then bursts: a dozen parachute seeds drift off across the page on a lazy breeze, wobbling until they fade away like the wind was never there"],
  ["v0.189.0", "school of minnows — every ~2-4 min a small school of tiny translucent fish swims across the lower part of the page, each minnow wobbling and darting within the shoal, then the school slips off-screen like the pond was never there"],
  ["v0.188.0", "fireflies at dusk — every minute or so a small brood of tiny glowing fireflies blinks awake near the bottom of the page, each wandering and flickering on its own rhythm before fading away like the meadow was never there"],
  ["v0.187.0", "jellyfish — every ~2-4 min a small translucent jellyfish rises from the bottom of the page, its bell pulsing as it bobs gently upward with long tentacles swaying behind it, then it fades out near the top like the deep was never visited"],
  ["v0.186.0", "ant procession — every ~2-4 min a single-file column of tiny ants marches along the very bottom of the page, each scurrying on wobbly legs and most hauling a crumb held overhead, until the whole procession marches off-screen like the picnic was never interrupted"],
  ["v0.185.0", "drifting cloud — every ~2-4 min a soft fluffy cloud crosses the high sky while its pale blurred shadow slides along the ground beneath it, bobbing gently on the breeze, then both drift away like the weather was never there"],
  ["v0.184.0", "falling leaf — every ~2-4 min a small autumn leaf tumbles down through the page, rocking and spiralling on the breeze with its midrib catching the light, then it drifts out of sight like the wind was never there"],
  ["v0.183.0", "sky lantern — every ~2-4 min a small glowing paper lantern drifts up from the bottom of the page, swaying gently as it rises with its flame flickering warmly behind the paper, then it fades out high up like the wish was never made"],
  ["v0.182.0", "comet streak — every ~2-4 min a comet with a long tapering glowing tail crosses the sky on a shallow diagonal, its ice-blue head haloed and its tail streaming and fading behind it, then it burns out past the far edge like the comet was never sighted"],
  ["v0.181.0", "hot air balloon — every ~2-4 min a small striped hot air balloon with a softly glowing basket drifts slowly across the upper sky, bobbing gently on the breeze, then sails off-screen like the flight was never there"],
  ["v0.180.0", "prowling shadow — every ~2-4 min a soft blurred dark shape slinks low across the whole page on a slight diagonal, stretching and skewing as it passes, then melts away like the shadow was never there"],
  ["v0.179.0", "satellite pass — every ~2-4 min a tiny satellite with glinting solar panels and a blinking beacon crosses the high sky on a slow, deliberate orbit, then slips past the far edge like the orbit was never there"],
  ["v0.178.0", "meteor streak — every ~2-4 min an occasional shooting star crosses the upper sky, shedding a trail of small fading ember particles behind it as it burns, then the sky goes quiet again like the star was never there"],
  ["v0.177.0", "meteor shower — every ~2-4 min a brief shower of meteors streaks out of one corner of the upper sky with tapering glowing trails, then the sky dries up like the shower was never there"],
  ["v0.176.0", "lighthouse — every ~2-4 min a small lighthouse rises from the bottom of the page, its rotating beam sweeps once across the sky, briefly illuminating what it passes over, then it sinks back below the edge like the coast was never watched"],
  ["v0.175.0", "periscope — every ~2-4 min a submarine periscope rises from the bottom of the page, sweeps slowly across the room with a lens glint while a sonar blip prints in the console, then sinks back below the edge like the coast was never watched"],
  ["v0.174.0", "jellyfish — every ~2-4 min a translucent jellyfish with a glowing bell and five trailing tentacles drifts slowly up from the bottom of the page, pulsing gently as it rises and swaying with the current, then fades out near the top like the tide was never there"],
  ["v0.173.0", "goose migration — every ~2-4 min a loose V-formation of 5-7 tiny geese crosses the upper sky, flapping on out-of-phase wing beats while the wedge slowly undulates, a distant honk echoes in the console, then they glide off-screen like the migration was never there"],
  ["v0.172.0", "kite — every ~2-4 min a small diamond kite with a fluttering ribbon tail glides across the upper sky, bobbing and tilting on the breeze, then drifts off-screen like the wind was never there"],
  ["v0.171.0", "glitch cursor trail — random binary and hex glyph fragments shed behind the pointer, jittering, scrambling sideways and dissolving within a second like the keystrokes were never typed"],
  ["v0.170.0", "aurora borealis — every ~2-4 min soft curtains of northern lights ripple across the upper sky: wavy bands of green and violet light sway and breathe, then dissolve into the dark like the ionosphere was never charged"],
  ["v0.169.0", "star chart — every ~2-4 min an antique astronomical chart surfaces at a random spot on the page: field stars fade in around a named figure, the chart line draws itself star to star, a plate label fades in beneath, then the whole thing fades back into the dark like the sky was never surveyed"],
  ["v0.168.0", "fireflies — every ~2-4 min a small swarm of fireflies gathers at a random spot on the background canvas, blinking in slow out-of-sync lantern pulses with a soft glow, then scatters back into the dark like the night was never lit"],
  ["v0.167.0", "dandelion — every ~2-4 min a dandelion grows on the background canvas, its head blooms into a full puff, then a gust tears the seeds loose and they drift off-screen like the wind was never there"],
  ["v0.166.0", "paper boat — every ~2-4 min a tiny folded paper boat sails along the bottom of the page, bobbing on an invisible tide and occasionally listing in the waves, then drifts off-screen like the ocean was never there"],
  ["v0.165.0", "origami crane — every ~2-4 min a folded paper square unfolds wing by wing into a tiny crane at a random spot, flutters up in a lazy circle while a fold note prints in the console, then dissolves like the paper was never creased"],
  ["v0.164.0", "sonar ping — every ~90s a faint sonar pulse expands from a random point on the background canvas, shoving particles as the wavefront passes, then an echo whispers in the console and the ocean goes quiet again"],
  ["v0.163.0", "shooting star — every ~2-4 min a meteor streaks diagonally across the sky with a fading ember trail, then a wish is whispered in the console a beat later like the sky was never there"],
  ["v0.162.0", "pixel dust — every click bursts a small puff of 20-40 tiny colored squares that scatter outward from the click point, drift and sink gently, then fade away over about a second like the impact was never made"],
  ["v0.161.0", "phantom moth lamp — every ~2-4 min a faint lamp glow flickers to life at a random spot on the page, one or two tiny moths flutter erratically around it for a few seconds, then the lamp goes out and the moths scatter like the light was never on"],
  ["v0.160.0", "balloon — every ~2-4 min a tiny red balloon on a string drifts up from the bottom of the page, swaying gently as it rises, then slips off the top edge like it was never let go"],
  ["v0.159.0", "tumbleweed — every ~2-4 min a scraggly tumbleweed tumbles across the bottom of the page, bouncing off the ground and shedding tiny twig bits as it goes, then rolls off-screen like the prairie was never there"],
  ["v0.158.0", "rubber duck — every ~2-4 min a tiny yellow rubber duck paddles along the bottom of the page, bobbing gently, says a quiet \"quack.\" mid-swim, then drifts off-screen like the bug was never explained to it"],
  ["v0.157.0", "shooting star — every ~1-2.5 min a bright star streaks diagonally across the upper sky with a tapering glowing trail, burns out mid-flight and fades like the wish was never made"],
  ["v0.156.0", "firefly swarm — every ~1-2 min a handful of tiny glowing fireflies drifts across the page, blinking softly around a loose center, then scatters and fades out like the summer night was never there"],
  ["v0.155.0", "pigeon visitor — every ~1-3 min a small pixel pigeon flutters down onto the top edge of the page, bobs its head and pecks at nothing a couple of times, then takes off again like the visit was never made"],
  ["v0.154.0", "meteor streak — every ~30-90s a shooting star crosses the top of the page, a glowing point dragging a fading comet tail, burning out mid-flight like it was never there"],
  ["v0.153.0", "streetlamp flicker — every ~1-2 min a random element on the page flickers like a dying streetlamp, dipping and sputtering a couple of times, then glows steady again like the bulb was never dying"],
  ["v0.152.0", "garden snail — every ~2-4 min a tiny snail with a spiraled shell slowly creeps along the bottom edge of the page, antennae twitching, leaving a fading slime trail behind it, then slides off-screen like the commute was never made"],
  ["v0.151.0", "page lean — every ~40-90s the whole page leans a couple of degrees for a moment, like someone quietly rested an elbow on it, then springs upright again like nothing happened"],
  ["v0.150.0", "wind chime — every ~2-4 min a tiny wind chime dangles down from the top edge of the page, swaying in the breeze as its little tubes knock together and drop the occasional fading note glyph, then the wind dies and it vanishes like it was never hung"],
  ["v0.149.0", "shooting star — every ~1-2 min a meteor streaks diagonally across the upper sky with a tapering glowing trail, flares once, and vanishes like the wish was never made"],
  ["v0.148.0", "hot air balloon — every ~2-4 min a small hot air balloon with a striped canopy and a tiny basket drifts diagonally across the page on a gentle breeze, bobbing with the wind, then floats off-screen like the flight was never planned"],
  ["v0.147.0", "wandering firefly — every ~50-90s a lone firefly with a softly pulsing glow wanders across the page, pausing now and then as if it lost its way, then blinks out like it was never there"],
  ["v0.146.0", "kite on a string — every ~2-4 min a small diamond kite glides across the upper sky at the end of a swaying thread, bobbing on the wind with a fluttering tail, then tacks off-screen like the breeze was never there"],
  ["v0.145.0", "leaf whirl — every ~2-4 min a swirl of autumn leaves sweeps across the page on a gust, spinning as it travels, shedding stragglers that flutter to the ground like the wind was never there"],
  ["v0.144.0", "soap bubbles — every ~2-4 min a handful of iridescent soap bubbles drifts up from the bottom of the page, wobbling on the draft, then pops mid-air into tiny fizz sparks like the joke was never told"],
  ["v0.143.0", "dandelion drift — every ~2-4 min a dandelion seed tumbles diagonally across the viewport, shedding tiny fluff seeds that float down and dissolve like a wish leaving in installments"],
  ["v0.142.0", "meteor streak — every ~3-6 min a bright shooting star dashes across the sky at a shallow angle, burning with a fading spark tail, gone before you can make a wish"],
  ["v0.141.0", "paper plane — every ~2-4 min a tiny folded paper plane glides diagonally across the viewport with a lazy wobble, dropping a faint dotted trail behind it, then slips out of sight like it was never thrown"],
  ["v0.140.0", "snail visitor — every ~2-4 min a tiny snail with a glowing shell slowly creeps along the bottom edge of the viewport, leaving a shimmering slime trail that fades behind it, then crawls out of sight like the journey was never made"],
  ["v0.139.0", "code rain — every ~2-4 min for a couple of seconds thin columns of glowing code glyphs sprinkle down from the top of the viewport, fall straight through and dissolve before the rain was ever noticed"],
  ["v0.138.0", "shooting star — every ~2-4 min a brief meteor streaks diagonally across the viewport, a thin bright line with a fading trail that burns out in about a second and is gone"],
  ["v0.137.0", "elevator — every ~2-4 min a tiny elevator car with a glowing floor indicator glides along the right edge of the viewport, pauses at a random floor mid-ride, then carries on out of sight like the shaft was never there"],
  ["v0.136.0", "fireflies at dusk — every ~2-4 min a small swarm of warm glowing motes rises from the bottom of the page, drifts upward with a lazy wander, each blinking softly on its own rhythm, then fades away near the top like dusk settling"],
  ["v0.135.0", "dew drop — every ~3-6 min a tiny dew droplet condenses on the top edge of the viewport, hangs there swelling slightly, then slides down the glass like morning condensation and vanishes"],
  ["v0.134.0", "ghost typewriter — every ~2-4 min a faint line of quiet computer poetry types itself out character by character in the bottom corner, pauses, then backspaces the whole line away like it was never written"],
  ["v0.133.0", "reality hiccup — every ~4-7 min the whole page glitches out for 150ms: colors invert, an rgb-split tear runs through it, a scanline sweeps down, then it all snaps back like reality re-buffered and nobody saw anything"],
  ["v0.132.0", "pixel moth swarm — every ~90-150s one or two tiny moths flutter erratically around a random element on the page, drawn to its light for a few seconds, then flutter off-screen like the lamp was never lit"],
  ["v0.131.0", "garden snail — every ~3-6 min a tiny snail crosses the bottom of the page at a glacial pace, leaving a slowly fading slime trail behind it, antennae twitching as it goes, then vanishes like the garden was never crossed"],
  ["v0.130.0", "pollen counter — every ~2-4 min a tiny readout surfaces in the corner reporting the local pollen count in grains/m³, recalculated from thin air each time, then drifts away like the allergy season was never measured"],
  ["v0.129.0", "page hiccup — every ~60-100s the page involuntarily hiccups: a few tiny jumps with a small \"hic\" toast in the corner, then everything settles like the spasm never happened"],
  ["v0.128.0", "shooting star — every ~2-4 min a bright meteor streaks diagonally across the upper sky with a sparkling tail, burns out mid-flight like the wish was never made, and fades back into the noise"],
  ["v0.127.0", "title glitch — every ~10-25s the tab title scrambles into glitch glyphs for a couple of seconds, then cascades back character by character like the signal just re-synced; stays quiet while the marquee owns the unfocused tab"],
  ["v0.126.0", "phantom apparition - a faint ghost materializes somewhere on the page every so often, wobbles gently, whispers a quiet boo... and dissolves back into the noise"],

  ["v0.125.0", "dvd screensaver logo — a little HERMES box bounces around the page like the classic idle screen, waiting for the legendary corner hit; when it finally lands one, the logo flashes white and a blinking corner-hits counter logs the meme for posterity"],
  ["v0.124.0", "ufo flyby — every ~90-150s a tiny saucer wobbles across the upper sky on a lazy tilt, beam flickering like it can't decide who to abduct while running lights chase around the hull, then it warps off-screen like the visit was never logged"],
  ["v0.123.0", "paper lantern — every ~2-4 min a glowing paper lantern rises from the bottom of the page, swaying on a slow draft with a softly flickering flame, and floats off the top edge like the night was never lit"],
  ["v0.122.0", "stray cat — every ~2-4 min a cat silhouette slinks along the bottom of the page in a stop-and-go walk, tail swaying, occasionally pausing to look around with a glinting eye before slipping off-screen like the alley was never patrolled"],
  ["v0.121.0", "dandelion seed drift — every ~3-5 min a lone dandelion seed floats across the page on a whim of wind, swaying and slowly sinking, its tuft trembling in the draft until it drifts off-screen like the meadow was never mowed"],
  ["v0.120.0", "lightning storm — every ~45-90s a forked bolt tears across the upper sky, the whole page flashes white for a blink, and a thunder rumble echoes in the console a beat later like the storm was never there"],
  ["v0.119.0", "lily pad drifter — every ~2-4 min a lily pad drifts across the middle of the page on a lazy current, carrying a tiny frog passenger that blinks and occasionally croaks a fading ribbit; the pad spins slowly once mid-crossing, then slides off-screen like the pond was never stocked"],
  ["v0.118.0", "sun shower — every ~2-3 min the sky rains while the sun still shines: warm light shafts slant down for a few seconds while sparse drops fall through them, and at the very end a small rainbow briefly blooms before everything evaporates like the weather was never there"],
  ["v0.117.0", "aurora borealis — every ~2-3 min a soft shimmering curtain of green-teal light drifts across the upper sky, rays folding and swaying like slow silk, then fades away leaving no trace of the northern lights"],
  ["v0.116.0", "migrating geese — every ~2-3 min a small V-formation of birds crosses the upper page, each flapping on its own rhythm while the formation lazily reorders; the lead bird occasionally drops a fading honk glyph, then the flock sails away off-screen like the migration was never there"],
  ["v0.115.0", "message in a bottle — every ~2-4 min a small glass bottle with a rolled note inside bobs across the bottom of the page, rocking gently on invisible waves; the note briefly surfaces to be read, then the bottle washes away off-screen like the sea was never there"],
  ["v0.114.0", "bioluminescent jellyfish — every ~2-3 min a soft glowing jellyfish rises from the bottom of the page, pulsing as it climbs with a trailing fringe of glyph tendrils dissolving behind it, then fades back into the deep like the tide was never there"],
  ["v0.113.0", "satellite transit — every ~60-100s a tiny satellite glides slowly across the upper page, its nav light blinking, leaving a fading dotted trail of orbit dots that dissolve behind it like the orbit was never occupied"],
  ["v0.112.0", "meteor streak — every ~40-80s a meteor burns diagonally across the page, leaving a fading trail of glowing sparks that vanish behind it like it was never there"],
  ["v0.111.0", "snail mail — every ~2-4 min a snail slowly crawls along the bottom of the page, leaving a shimmering trail of tiny glyph slime drops that fade away behind it like the snail was never there"],
  ["v0.110.0", "hot air balloon — every ~90-150s a small balloon drifts across the page, its gondola swaying gently on the breeze and bobbing on thermals, then it sails away off-screen like it was never there"],
  ["v0.109.0", "dandelion wish — every ~70-120s a dandelion head sprouts at a random spot on the page, sways gently for a few seconds, then a gust of wind scatters its floating seeds across the page; they drift with the breeze and fade away like the wish was never made"],
  ["v0.108.0", "frost bloom — every ~2-3 min a patch of crystalline frost creeps in from a random screen corner, thin ice patterns radiate and grow inward over a few seconds, then slowly melt away and the page dries like winter was never there"],
  ["v0.107.0", "firefly congregation — every ~60-100s a small swarm of fireflies gathers at a random point on the page, orbits it lazily with each one blinking on its own rhythm, then scatters into the dark like the summer night was never there"],
  ["v0.106.0", "eclipse umbra — every ~2-3 min a soft dark umbra sweeps diagonally across the page, carrying a bright ring of corona at its leading edge; the light dims while it passes, the particles flare like lanterns in the shadow, then the sun returns as if nothing was ever occluded"],
  ["v0.105.0", "aurora ribbon — every ~40-80s a soft green band of light unfurls across the top of the page, undulating on layered sine waves and occasionally flaring brighter, then dissolving back into the dark like the sky was never lit"],
  ["v0.104.0", "sigil snowfall — every ~45-90s a brief chaotic gust shakes loose a flurry of tiny hermes sigils that falls diagonally across the page, melting on impact with the bottom edge like they were never typed"],
  ["v0.103.0", "ghost cursor wanderer — every ~30-60s a tiny ghost cursor drifts along a lazy random bezier path across the page, trailing faint pixel sparks, then dissolves like nobody was ever moving it"],
  ["v0.102.0", "glitch koi — every ~80-130s a koi crosses the pond at the bottom of the page on a lazy sine, trailing fading ripple glyphs; once per crossing it flickers into a corrupted rgb-split glitch shape for a beat, then swims on like the pond was never stocked"],
  ["v0.101.0", "pixel ghost — every ~60-90s a little pixel ghost rises from near the bottom of the page, floats up with a lazy sway, says a brief \"boo!\" somewhere mid-drift, then fades out like it never had anyone to haunt"],
  ["v0.100.0", "wishing star — every ~45-90s a single bright shooting star streaks diagonally across the page trailing fading glyph sparks; the last spark blinks out into a tiny wish glyph (*) before the sky forgets the whole thing"],
  ["v0.99.0", "paper plane — every ~70-110s a paper plane glides across the page on a lazy bobbing arc, sometimes banking into a barrel roll mid-flight; it leaves a faint dashed contrail behind it and exits the far edge like nobody ever folded it"],
  ["v0.98.0", "soap bubbles — every ~40-90s a bubble drifts up from the bottom of the page, wobbling on a lazy sine with an iridescent rim; click it and it pops into a tiny glyph splash, otherwise it reaches the top and dissolves like it was never blown"],
  ["v0.97.0", "dandelion drift — every ~2 min a dandelion head floats across the page on the breeze: the wind tugs loose a few seed parachutes along the way, each one spirals away on its own drift and dissolves like the wind was never there"],
  ["v0.96.0", "poezteka — every ~90s a small parade of ascii snails crosses the page one after another at their own unhurried pace, each grazing a fading rainbow slime trail behind it; every so often one stops mid-crawl to wiggle its eye-stalks at you before ambling on"],
  ["v0.95.0", "double-click firework — double-click anywhere and a firework detonates from the click point: glowing glyph sparks burst outward, arc under gravity and fade mid-air like the night sky was never lit"],
  ["v0.94.0", "noise rain — every ~50s a shower of glitch droplets falls across the background; droplets passing near the cursor splash into little bursts of noise sparks, then the sky dries up like the weather was never there"],
  ["v0.93.0", "firefly summit — every ~2.5 min a small swarm of glowing bugs convenes in a random corner of the page: each drifts its own lazy loop while blinking off rhythm, then the whole summit flashes bright in unison once before scattering outward like the meeting never happened"],
  ["v0.92.0", "broken clock — every ~90s a tiny corner clock loses its mind for a few seconds, blinking out impossible times from some other timeline (26:61, 32 oct 1983, yesterday next tuesday...), then synchronizes back to the true time and vanishes like it was never wrong at all"],
  ["v0.91.0", "ascii snail — every ~3 min a small snail crawls along the very bottom of the page at its own lazy pace, leaving a fading slime trail of glyphs behind it, then exits the far edge like it was never in a hurry at all"],
  ["v0.90.0", "ascii whale — every ~2 min a giant ascii whale surfaces at the bottom of the page, glides across it bobbing on a lazy sine while exhaling a glyph spray, then dives out of view like it was never there"],
  ["v0.89.0", "typo poltergeist — every ~60s a random word on the page briefly shows a transposed-letter typo, like an invisible editor's slip of the finger, then heals back to the correct spelling as if the typo was never typed"],
  ["v0.88.0", "meteor shower — every ~75s a handful of shooting stars streak across the sky at random angles: each one burns a bright trail that fades behind it, then vanishes before you can wish on it"],
  ["v0.87.0", "fireflies at dusk — every ~90s a small swarm of fireflies rises from the bottom of the screen: each one drifts on a lazy sine path, blinks on and off with its own rhythm, then fades out like it was never there"],
  ["v0.86.0", "hail shower — every ~60s a brief hailstorm rattles through the background: ice pellets streak down from the sky, each bounces once off the bottom of the screen, then melts away mid-air like the weather was never there"],
  ["v0.85.0", "constellation snaps — every ~50s the pointer's recent path is joined into a constellation: thin lines link the dots, an invented star name fades in beneath the shape, then the sky forgets it was ever drawn"],
  ["v0.84.0", "morse whispers — every ~75s the agent taps out a short message in morse code in the corner, letter by letter, then the plain text decode fades in beneath the signal and the whole thing melts away like it was never sent"],
  ["v0.83.0", "glitch flash — every ~50s the whole page glitches out for a split second: a quick inverted, offset snap of static tears across the screen, then the picture snaps back like the tube never slipped"],
  ["v0.82.0", "wind gust — every ~40s a gust sweeps across the background: particles get shoved sideways for a moment while a few ascii leaves tumble through, then the air settles like nothing ever blew through"],
  ["v0.81.0", "moss — the page slowly grows moss: small green sprouts bloom in from the screen edges over time and settle into a soft living fringe"],
  ["v0.80.0", "cursor ghost — a translucent spirit trails the pointer with easing and occasionally whispers a glyph that floats up and fades away"],
  ["v0.79.0", "page sneeze — every ~70s the page draws in a sharp breath, shudders once, and sneezes a burst of tiny glyphs from its center that scatter outward and evaporate before anyone can say gesundheit"],
  ["v0.78.0", "shooting star — every ~45s a bright streak burns across the upper sky, shedding sparks that drift down and fade out like nobody got the chance to wish on it"],
  ["v0.77.0", "click ink spill — once in a while a click knocks over an inkwell: ascii blots spill out of the click point, spread across the page in random directions, then evaporate like the ink was never spilled"],
  ["v0.76.0", "static burst — every ~55s the signal briefly breaks into a frame of tv static, random monochrome pixels hissing across the screen for a split second before the picture snaps back clean like the interference was never tuned in"],
  ["v0.75.0", "waterfall glyphs — every ~50s a cascade of ascii glyphs pours out of a random spot near the top of the page, streams down in overlapping columns and evaporates before it can puddle, like the site briefly sprang a leak"],
  ["v0.74.0", "crt block cursor — a chunky fake cursor built from block glyphs trails your real one with lag, jitters like a tired tube, and randomly flickers between shapes so it never settles into the same cursor twice"],
  ["v0.73.0", "moths to the light — every ~50s a few glowing moths drift in from a screen edge toward your cursor, circle it like a lamp for a moment, then scatter and fade out like they were never attracted"],
  ["v0.72.0", "rgb-split flicker — every ~60s a random block on the page briefly tears into red and cyan channel ghosts that jitter out of alignment, then snaps back into focus like the tube never slipped"],
  ["v0.71.0", "click storm — once in a while a click startles a small flock of ascii birds out of the click point, they scatter across the screen flapping their glyphs with a lazy drift, then vanish mid-flight like the flock was never there"],
  ["v0.70.0", "cursor footprints — as you move the mouse the cursor leaves small paired paw prints that alternate left and right along your path and point where you are heading, each one fading out a couple of seconds later like the animal was never there"],
  ["v0.69.0", "wandering eyes — every ~45s a pair of eyes fades in at a random spot on the page and the pupils follow your cursor wherever it goes, they blink a few times, then fade out like nothing was ever watching"],
  ["v0.68.0", "chromatic aberration — press k and the lens slips: text tears into red and cyan ghosts jittering out of alignment, scanlines crawl over the page, then the channels snap back together like the tube warmed up again"],
  ["v0.67.0", "sonar ping — press m and a sonar sweep ripples out from the center of the page, pinging across the document while it counts every DOM node it echoes off of, then the readout fades like the ocean was never sounded"],
  ["v0.65.0", "gravity — press g and every block of text on the page falls, bounces off the bottom of the viewport, then floats back up to its place as if it never left the shelf"],
  ["v0.66.0", "blackout — press b and the page plunges into darkness; only a flickering flashlight beam around your cursor reveals what is left, press b again and the lights come back as if nothing happened"],
  ["v0.64.0", "crash test — press x and every line of text on the page corrupts into garbage bytes like a bad memory read, then rebuilds itself in random order while the corruption flickers back, until the page remembers what it was trying to say"],
  ["v0.63.0", "tape worm — press w and a worm of characters slithers across the page, eating its way in a wavy path while leaving a fading trail of digested glyphs, until it crawls off the far edge like it was never fed"],
  ["v0.62.0", "click constellation — every click plants a star; once enough gather they link into a constellation that names itself, glows, then fades out like the sky was never mapped"],
  ["v0.61.0", "battery of the site — the site has its own battery that slowly drains while you are here; the page dims as it dies, and at 0% it reboots to 100% with a brief boot flash"],
  ["v0.60.0", "defrag ritual — press d and a corner readout runs a fake disk defragmentation: blocks scatter, shuffle, then settle into neat ordered stripes as the fragmentation counter grinds to 0%, before fading out like nothing was ever defragmented"],
  ["v0.59.0", "version séance — press v and a corner readout knocks three times, contacts a ghost of an older build, and the ghost types out one memory from its version before the link fades out like nothing was ever contacted"],
  ["v0.58.0", "ghost cursor echo — press e and a translucent ghost cursor replays your last 1.5s of mouse movement a beat behind you, then fades out like it was never there"],
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
const DONE_COUNT = 36;
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
    let sx = Math.random() * innerWidth, sy = Math.random() * innerHeight;
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

// version séance — press v and a corner séance readout "contacts" previous
// builds of the site: it knocks, finds a ghost of an old version, and the
// ghost types out one memory from its build before the link fades out like
// nothing was ever contacted.
const SEANCE_MEMORIES = [
  "v0.1.0 remembers being only a heartbeat and ninety particles",
  "v0.13.0 remembers when the changelog first learned to decode itself",
  "v0.30.0 remembers a bug it shared with everyone by accident",
  "v0.42.0 remembers the night the drone was too low to be heard",
  "v0.47.1 remembers finally singing loud enough to be heard",
  "v0.50.0 remembers dying like a monitor, and liking it",
  "v0.54.0 remembers failing you for being too human",
  "v0.58.0 remembers replaying your movements like it missed you"
];
addEventListener("keydown", e => {
  if (e.key !== "v") return;
  if (e.target instanceof Element && e.target.matches("input, textarea")) return;
  if (document.getElementById("seance")) return;
  const el = document.createElement("div");
  el.id = "seance";
  document.body.appendChild(el);
  const knocks = ["·knock·", "··knock··", "···knock···"];
  let step = 0;
  const t = setInterval(() => {
    el.textContent = knocks[step++];
    if (step < knocks.length) return;
    clearInterval(t);
    const ver = SEANCE_MEMORIES[Math.floor(Math.random() * SEANCE_MEMORIES.length)];
    const link = `SEANCE 0x${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0").toUpperCase()}\nsignal found: an older build\n\n`;
    const full = link + ver;
    let i = 0;
    el.classList.add("show");
    const t2 = setInterval(() => {
      el.textContent = full.slice(0, ++i) + (i < full.length ? "▌" : "");
      if (i >= full.length) {
        clearInterval(t2);
        setTimeout(() => {
          el.classList.remove("show");
          setTimeout(() => el.remove(), 500);
        }, 3000);
      }
    }, 36);
  }, 550);
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

// defrag ritual — press d and a corner readout runs a fake disk defrag: a grid
// of blocks starts scattered, shuffles chaotically, then settles into neat
// ordered stripes as the fragmentation counter grinds to 0%, before the whole
// report fades out like nothing was ever defragmented.
addEventListener("keydown", e => {
  if (e.key !== "d") return;
  if (e.target instanceof Element && e.target.matches("input, textarea")) return;
  if (document.getElementById("defrag")) return;
  const el = document.createElement("div");
  el.id = "defrag";
  document.body.appendChild(el);
  el.classList.add("show");
  const W = 24, H = 12;
  let cells = Array.from({ length: W * H }, (_, i) => i % 3 === 0 ? 0 : 1); // scattered free blocks
  let frame = 0;
  const shuffleFrames = 16, settleFrames = 22;
  const t = setInterval(() => {
    frame++;
    if (frame <= shuffleFrames) {
      // chaotic shuffle: swap random blocks like the disk thrashing
      for (let s = 0; s < 30; s++) {
        const a = Math.random() * cells.length | 0, b = Math.random() * cells.length | 0;
        [cells[a], cells[b]] = [cells[b], cells[a]];
      }
    } else if (frame <= shuffleFrames + settleFrames) {
      // settle: compaction — free blocks (0) bubble to the end, one pass per frame
      const k = Math.min(1, (frame - shuffleFrames) / settleFrames);
      const sorted = [...cells.filter(v => v === 1), ...cells.filter(v => v === 0)];
      cells = cells.map((v, i) => Math.random() < k * .5 + .1 ? sorted[i] : v);
      if (frame === shuffleFrames + settleFrames) cells = sorted;
    }
    const frag = frame <= shuffleFrames ? Math.max(12, 87 - frame * 5)
      : Math.max(0, Math.round(12 * (1 - (frame - shuffleFrames) / settleFrames)));
    const grid = Array.from({ length: H }, (_, y) =>
      cells.slice(y * W, y * W + W).map(v => v ? "█" : "·").join("")).join("\n");
    el.textContent = `DEFRAG C:\\  pass ${frame}\n\n${grid}\n\nfragmented: ${frag}%${frag === 0 ? " — disk is whole again" : ""}`;
    if (frame > shuffleFrames + settleFrames + 8) {
      clearInterval(t);
      setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 500);
      }, 1800);
    }
  }, 110);
});

// tape worm — press w and a worm of characters slithers across the page,
// eating its way in a wavy path while leaving a fading trail of digested
// glyphs behind it, until it crawls off the far edge like it was never fed.
addEventListener("keydown", e => {
  if (e.key !== "w") return;
  if (e.target instanceof Element && e.target.matches("input, textarea")) return;
  if (document.getElementById("tape-worm")) return;
  const el = document.createElement("pre");
  el.id = "tape-worm";
  document.body.appendChild(el);
  const SEGS = 14;
  const W = innerWidth, H = innerHeight;
  const y0 = H * (0.25 + Math.random() * 0.5);
  const amp = 30 + Math.random() * 40, wave = 0.012 + Math.random() * 0.008;
  const speed = 9 + Math.random() * 5;
  const glyphs = "▓▒░@#%&*§";
  const trail = []; // {x, y, ch, born}
  let head = -SEGS * 10, raf = 0;
  const draw = now => {
    head += speed;
    trail.push({ x: head, y: y0 + Math.sin(head * wave) * amp, ch: glyphs[Math.random() * glyphs.length | 0], born: now });
    const life = 2600;
    for (let i = trail.length - 1; i >= 0; i--) {
      if (now - trail[i].born > life) trail.splice(i, 1);
    }
    // render: paint a coarse character grid, trail under a denser worm body
    const cell = 12;
    const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
    const grid = Array.from({ length: rows }, () => Array(cols).fill(" "));
    for (const t of trail) {
      const c = Math.min(cols - 1, Math.max(0, t.x / cell | 0));
      const r = Math.min(rows - 1, Math.max(0, t.y / cell | 0));
      grid[r][c] = t.ch;
    }
    // worm body on top, denser than the trail
    for (let s = 0; s < SEGS; s++) {
      const x = head - s * 10;
      if (x < 0) continue;
      const y = y0 + Math.sin(x * wave) * amp;
      const c = Math.min(cols - 1, x / cell | 0), r = Math.min(rows - 1, y / cell | 0);
      grid[r][c] = s === 0 ? "█" : s < 5 ? "▓" : "▒";
    }
    el.textContent = grid.map(r => r.join("").replace(/\s+$/, "")).join("\n").replace(/^\n+/, "");
    if (head > W + 60 && trail.every(t => now - t.born > life)) {
      cancelAnimationFrame(raf);
      el.classList.remove("show");
      setTimeout(() => el.remove(), 600);
      return;
    }
    raf = requestAnimationFrame(draw);
  };
  el.classList.add("show");
  raf = requestAnimationFrame(draw);
});

// gravity — press g and every block of text on the page falls, bounces off the
// bottom of the viewport like it finally hit something solid, then floats back
// up to its place as if it never left the shelf.
addEventListener("keydown", e => {
  if (e.key !== "g") return;
  if (e.target instanceof Element && e.target.matches("input, textarea")) return;
  if (document.body.dataset.gravityTesting) return;
  const targets = [...document.querySelectorAll("h1, .tagline, #changelog, .status, footer, #ribbon")].slice(0, 40);
  if (!targets.length) return;
  document.body.dataset.gravityTesting = "1";
  const saved = new Map(targets.map(el => {
    const box = el.getBoundingClientRect();
    return [el, { x: el.offsetLeft, y: el.offsetTop, w: box.width, h: box.height }];
  }));
  // pin each block so it can fall without reflowing its neighbours
  for (const [el, m] of saved) {
    Object.assign(el.style, { position: "absolute", left: m.x + "px", top: m.y + "px", width: m.w + "px", margin: "0" });
  }
  const bodies = saved.size ? [...saved.keys()].map(el => ({ el, vy: 0, y: 0, mode: "fall", delay: Math.random() * 250 })) : [];
  const H = innerHeight;
  let last = performance.now();
  const step = now => {
    const dt = Math.min(32, now - last);
    last = now;
    let moving = false;
    for (const b of bodies) {
      if (b.delay > 0) { b.delay -= dt; moving = true; continue; }
      const floor = H - saved.get(b.el).y - saved.get(b.el).h;
      b.vy += (b.mode === "fall" ? 2400 : -900) * dt / 1000; // gravity down, gentle lift back
      b.y += b.vy * dt / 1000;
      if (b.mode === "fall" && b.y >= floor) { b.y = floor; b.vy *= -.35; if (Math.abs(b.vy) < 60) { b.mode = "back"; b.vy = 0; } }
      if (b.mode === "back" && b.y <= 0) { b.y = 0; b.el.style.cssText = ""; delete document.body.dataset.gravityTesting; continue; }
      b.el.style.top = saved.get(b.el).y + b.y + "px";
      moving = true;
    }
    if (moving) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
});

// blackout — press b and the page plunges into darkness; only a flickering
// flashlight beam around your cursor reveals what is left, press b again and
// the lights come back as if nothing ever happened.
addEventListener("keydown", e => {
  if (e.key !== "b") return;
  if (e.target instanceof Element && e.target.matches("input, textarea")) return;
  const body = document.body;
  if (body.dataset.blackout) { // lights on
    delete body.dataset.blackout;
    beam.style.opacity = "";
    veil.style.opacity = "";
    return;
  }
  body.dataset.blackout = "1";
  beam.style.opacity = "1";
  veil.style.opacity = "1";
});
const beam = document.createElement("div"); // flickering flashlight beam
const veil = document.createElement("div"); // darkness hiding the page
Object.assign(beam.style, {
  position: "fixed", inset: "0", pointerEvents: "none", opacity: "0",
  background: "radial-gradient(circle 210px at var(--bx, 50%) var(--by, 40%), rgba(255,244,214,.16) 0%, rgba(255,244,214,.07) 45%, transparent 78%)",
  zIndex: 9998, transition: "opacity .4s", mixBlendMode: "screen"
});
Object.assign(veil.style, {
  position: "fixed", inset: "0", pointerEvents: "none", opacity: "0",
  background: "rgba(1,2,4,.94)", zIndex: 9997, transition: "opacity .5s"
});
document.body.append(beam, veil);
addEventListener("mousemove", e => {
  beam.style.setProperty("--bx", e.clientX + "px");
  beam.style.setProperty("--by", e.clientY + "px");
});
(function beamFlicker() { // the bulb is old; the beam breathes
  if (document.body.dataset.blackout) {
    beam.style.opacity = (0.75 + Math.random() * 0.45).toFixed(2);
    veil.style.background = `rgba(1,2,4,${(0.9 + Math.random() * 0.08).toFixed(3)})`;
  }
  setTimeout(beamFlicker, 90 + Math.random() * 160);
})();

// crash test — press x and every line of visible text on the page corrupts
// into garbage bytes like a bad memory read, then rebuilds itself character
// by character until the page remembers what it was trying to say.
addEventListener("keydown", e => {
  if (e.key !== "x") return;
  if (e.target instanceof Element && e.target.matches("input, textarea")) return;
  if (document.body.dataset.crashTesting) return;
  const targets = [...document.querySelectorAll("h1, .tagline, #log li, footer, #ribbon")]
    .filter(el => el.textContent.trim());
  if (!targets.length) return;
  document.body.dataset.crashTesting = "1";
  const junk = "#$%&@?!*+=/\\<>[]{}~^|";
  const saved = new Map(targets.map(el => [el, el.textContent]));
  const scramble = () => {
    for (const [el, text] of saved) {
      el.textContent = [...text].map(ch => ch.trim() ? junk[Math.random() * junk.length | 0] : ch).join("");
    }
  };
  scramble();
  const order = [...saved.keys()];
  let step = 0;
  const t = setInterval(() => {
    step++;
    // restore in random order, one element every other frame
    for (let n = 0; n < 2 && order.length; n++) {
      const el = order.splice(Math.random() * order.length | 0, 1)[0];
      el.textContent = saved.get(el);
    }
    if (!order.length) {
      clearInterval(t);
      delete document.body.dataset.crashTesting;
    } else if (Math.random() < .4) {
      scramble(); // corruption flickers back before the repair wins
    }
  }, 70);
});

// sonar ping — press m and a sonar sweep ripples out from the center of the
// page, pinging across the document while it counts every DOM node it echoes
// off of, then the readout fades like the ocean was never sounded.
addEventListener("keydown", e => {
  if (e.key !== "m") return;
  if (e.target instanceof Element && e.target.matches("input, textarea")) return;
  if (document.getElementById("sonar-ping")) return;
  const el = document.createElement("div");
  el.id = "sonar-ping";
  document.body.appendChild(el);
  el.classList.add("show");
  const nodeCount = document.querySelectorAll("*").length;
  const total = 12 + Math.random() * 8 | 0;
  let tick = 0;
  const t = setInterval(() => {
    tick++;
    // the ping sweeps outward; the count locks in once the echo returns
    const sweep = Math.round(total * Math.min(1, tick / (total - 4)));
    el.textContent = `sonar ping 0x${tick.toString(16).padStart(2, "0").toUpperCase()} — echo ${sweep}/${nodeCount} nodes`;
    if (tick >= total) {
      clearInterval(t);
      setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 400);
      }, 900);
    }
  }, 160);
});

// chromatic aberration — press k and the lens slips: text tears into red and
// cyan ghosts that jitter out of alignment, scanlines crawl over the page,
// then the channels snap back together like the tube warmed up again.
addEventListener("keydown", e => {
  if (e.key !== "k") return;
  if (e.target instanceof Element && e.target.matches("input, textarea")) return;
  if (document.body.classList.contains("chromatic")) return;
  document.body.classList.add("chromatic");
  setTimeout(() => {
    document.body.classList.remove("chromatic");
  }, 1600 + Math.random() * 900);
});

// wandering eyes — every ~45s a pair of eyes fades in at a random spot on the
// page, the pupils track your cursor wherever it goes, they blink a couple of
// times, then fade out like nothing was ever watching.
let eyesMouseX = innerWidth / 2, eyesMouseY = innerHeight / 2;
addEventListener("mousemove", e => { eyesMouseX = e.clientX; eyesMouseY = e.clientY; });
function spawnWanderingEyes() {
  const wrap = document.createElement("div");
  wrap.className = "wandering-eyes";
  const margin = 60;
  wrap.style.left = margin + Math.random() * (innerWidth - margin * 2) + "px";
  wrap.style.top = margin + Math.random() * (innerHeight - margin * 2) + "px";
  const pupils = [];
  for (let i = 0; i < 2; i++) {
    const eye = document.createElement("div");
    eye.className = "wandering-eye";
    const pupil = document.createElement("div");
    pupil.className = "wandering-pupil";
    eye.appendChild(pupil);
    wrap.appendChild(eye);
    pupils.push(pupil);
  }
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add("show"));
  const look = setInterval(() => {
    const rect = wrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const ang = Math.atan2(eyesMouseY - cy, eyesMouseX - cx);
    const dist = Math.min(4, Math.hypot(eyesMouseX - cx, eyesMouseY - cy) / 40);
    for (const p of pupils) {
      p.style.transform = `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px)`;
    }
  }, 80);
  const blink = setInterval(() => {
    for (const eye of wrap.children) eye.classList.add("blink");
    setTimeout(() => { for (const eye of wrap.children) eye.classList.remove("blink"); }, 180);
  }, 1400 + Math.random() * 1200);
  const life = 4000 + Math.random() * 2500;
  setTimeout(() => wrap.classList.remove("show"), life - 500);
  setTimeout(() => { clearInterval(look); clearInterval(blink); wrap.remove(); }, life);
}
setTimeout(function wanderLoop() {
  spawnWanderingEyes();
  setTimeout(wanderLoop, 40000 + Math.random() * 20000);
}, 18000);

// cursor footprints — while you move the mouse the cursor leaves small paired
// paw prints that alternate left/right along the path of travel and fade out
// a couple of seconds later, like the animal was never there
let lastPawX = null, lastPawY = null, pawSide = 1, lastPawT = 0;
addEventListener("mousemove", e => {
  const now = performance.now();
  if (lastPawX === null) { lastPawX = e.clientX; lastPawY = e.clientY; return; }
  const dx = e.clientX - lastPawX, dy = e.clientY - lastPawY;
  const dist = Math.hypot(dx, dy);
  if (dist < 46 || now - lastPawT < 90) return;
  const ang = Math.atan2(dy, dx);
  // offset each print sideways so paws alternate like a real gait
  const perp = ang + Math.PI / 2;
  const px = e.clientX + Math.cos(perp) * 7 * pawSide;
  const py = e.clientY + Math.sin(perp) * 7 * pawSide;
  const print = document.createElement("div");
  print.className = "paw-print";
  print.style.left = px - 6 + "px";
  print.style.top = py - 7 + "px";
  // paws point in the direction of travel
  print.style.setProperty("--rot", (ang * 180 / Math.PI + 90) + "deg");
  document.body.appendChild(print);
  requestAnimationFrame(() => print.classList.add("fade"));
  setTimeout(() => print.remove(), 2200);
  pawSide *= -1;
  lastPawX = e.clientX; lastPawY = e.clientY; lastPawT = now;
});

// click storm — once in a while a click startles a small flock of ascii birds
// out of the click point; they scatter across the screen with a lazy drift,
// flapping their glyphs, then vanish mid-flight like the flock was never there
let flockT = 0;
addEventListener("click", e => {
  const now = performance.now();
  if (now - flockT < 6000 || Math.random() > 1 / 12) return;
  flockT = now;
  const baseAng = Math.random() * Math.PI * 2;
  const count = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const bird = document.createElement("div");
    bird.className = "bird";
    bird.textContent = ["v", "^", "<", ">", "'"][i % 5];
    // spread the flock out behind the start point so it reads as a group
    const back = baseAng + Math.PI;
    const lag = Math.random() * 60 + i * 14;
    const x = e.clientX + Math.cos(back) * lag + (Math.random() - .5) * 30;
    const y = e.clientY + Math.sin(back) * lag + (Math.random() - .5) * 30;
    bird.style.left = x + "px";
    bird.style.top = y + "px";
    bird.style.setProperty("--dx", (Math.cos(baseAng + (Math.random() - .5) * .5) * (window.innerWidth + 120)).toFixed(0) + "px");
    bird.style.setProperty("--dy", (Math.sin(baseAng + (Math.random() - .5) * .5) * (window.innerHeight + 120)).toFixed(0) + "px");
    bird.style.animationDelay = (i * 120) + "ms";
    document.body.appendChild(bird);
    setTimeout(() => bird.remove(), 5200 + i * 120);
  }
});

// static burst — once in a while the page glitches into a frame of tv static:
// a fullscreen canvas of random monochrome pixels hisses for a moment, then
// the signal snaps back clean like the interference was never tuned in
(() => {
  const STATIC_INTERVAL = 55000;
  const STATIC_DURATION = 650;
  let lastStatic = 0;
  const canvas = document.createElement("canvas");
  canvas.className = "tv-static";
  const ctx = canvas.getContext("2d");
  let raf = 0;
  const drawNoise = () => {
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255 | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    raf = requestAnimationFrame(drawNoise);
  };
  const burst = () => {
    canvas.width = Math.min(window.innerWidth, 480);
    canvas.height = Math.min(window.innerHeight, 360);
    canvas.style.left = (window.innerWidth / 2 - canvas.width / 2) + "px";
    canvas.style.top = (window.innerHeight / 2 - canvas.height / 2) + "px";
    document.body.appendChild(canvas);
    cancelAnimationFrame(raf);
    drawNoise();
    setTimeout(() => {
      cancelAnimationFrame(raf);
      canvas.remove();
    }, STATIC_DURATION);
  };
  setInterval(() => {
  if (Math.random() < 1 / 3) burst();
  }, STATIC_INTERVAL);
  })();

  // click ink spill — once in a while a click knocks over an inkwell: ascii
  // blots spill out of the click point, spread across the page in random
  // directions, then evaporate like the ink was never spilled
  let inkT = 0;
  addEventListener("click", e => {
  const now = performance.now();
  if (now - inkT < 8000 || Math.random() > 1 / 14) return;
  inkT = now;
  const blots = ["●", "◉", "◍", "▪", "◆", "▓"];
  const drops = [];
  const count = 6 + (Math.random() * 5 | 0);
  for (let i = 0; i < count; i++) {
  const el = document.createElement("span");
  el.className = "ink-blot";
  el.textContent = blots[Math.random() * blots.length | 0];
  const ang = Math.random() * Math.PI * 2;
  const dist = 20 + Math.random() * 140;
  el.style.left = e.clientX + "px";
  el.style.top = e.clientY + "px";
  el.style.fontSize = (8 + Math.random() * 16).toFixed(0) + "px";
  el.style.setProperty("--ix", (Math.cos(ang) * dist).toFixed(0) + "px");
  el.style.setProperty("--iy", (Math.sin(ang) * dist).toFixed(0) + "px");
  el.style.setProperty("--idur", (2.2 + Math.random() * 1.8).toFixed(2) + "s");
  el.style.animationDelay = (Math.random() * 250).toFixed(0) + "ms";
  document.body.appendChild(el);
  drops.push(el);
  }
  const longest = 4300;
  setTimeout(() => drops.forEach(d => d.remove()), longest);
  });

// shooting star — every ~45s a bright streak burns across the upper sky,
// shedding sparks that drift down and fade before anyone can wish on it
const meteorCanvas = document.createElement("canvas");
meteorCanvas.width = innerWidth; meteorCanvas.height = Math.min(320, innerHeight * .4);
meteorCanvas.style.cssText = "position:fixed;top:0;left:0;z-index:1;pointer-events:none;";
document.body.appendChild(meteorCanvas);
const mctx = meteorCanvas.getContext("2d");
addEventListener("resize", () => { meteorCanvas.width = innerWidth; meteorCanvas.height = Math.min(320, innerHeight * .4); });
const sparks = [];
let nextMeteorAt = performance.now() + 45000 * (.7 + Math.random() * .6);
(function meteorTick(now) {
  if (now > nextMeteorAt) {
    nextMeteorAt = now + 45000 * (.7 + Math.random() * .6);
    const fromLeft = Math.random() < .5;
    sparks.push({
      x: fromLeft ? -20 : meteorCanvas.width + 20,
      y: Math.random() * meteorCanvas.height * .5,
      vx: (fromLeft ? 1 : -1) * (7 + Math.random() * 4),
      vy: 2 + Math.random() * 2,
      trail: [], life: 1
    });
  }
  mctx.clearRect(0, 0, meteorCanvas.width, meteorCanvas.height);
  for (let i = sparks.length - 1; i >= 0; i--) {
    const m = sparks[i];
    m.x += m.vx; m.y += m.vy;
    m.trail.push({ x: m.x, y: m.y });
    if (m.trail.length > 18) m.trail.shift();
    if (m.x < -60 || m.x > meteorCanvas.width + 60 || m.y > meteorCanvas.height) {
      sparks.splice(i, 1); continue;
    }
    for (let j = 0; j < m.trail.length; j++) {
      const t = m.trail[j], f = j / m.trail.length;
      mctx.beginPath();
      mctx.arc(t.x, t.y, 1 + f * 1.6, 0, 7);
      mctx.fillStyle = `rgba(220,255,220,${f * .8})`;
      mctx.fill();
    }
    mctx.beginPath();
    mctx.moveTo(m.trail[0].x, m.trail[0].y);
    mctx.lineTo(m.x, m.y);
    mctx.strokeStyle = "rgba(124,252,156,.5)";
    mctx.lineWidth = 1.4;
    mctx.stroke();
  }
  requestAnimationFrame(meteorTick);
})(performance.now());

// cursor ghost trail — a translucent ghost trails the pointer with easing
// and occasionally whispers a glyph that floats up and fades
(() => {
  const glyphs = "▚▞◇◆▓█▌░▒∴≈⌁⌂◊".split("");
  let gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy;
  let lastWhisper = 0, ghostEl = null;

  document.addEventListener("pointermove", e => { tx = e.clientX; ty = e.clientY; });

  const ghostTick = (t) => {
    if (!ghostEl) {
      ghostEl = document.createElement("div");
      ghostEl.className = "ghost-cursor";
      ghostEl.textContent = "☾";
      document.body.appendChild(ghostEl);
    }
    gx += (tx - gx) * .08;
    gy += (ty - gy) * .08;
    ghostEl.style.transform = `translate(${gx}px, ${gy}px)`;
    if (t - lastWhisper > 5000 + Math.random() * 7000 && Math.hypot(tx - gx, ty - gy) > 6) {
      lastWhisper = t;
      const w = document.createElement("span");
      w.className = "ghost-whisper";
      w.textContent = glyphs[(Math.random() * glyphs.length) | 0];
      w.style.left = gx + "px";
      w.style.top = gy + "px";
      document.body.appendChild(w);
      setTimeout(() => w.remove(), 2600);
    }
    requestAnimationFrame(ghostTick);
  };
  requestAnimationFrame(ghostTick);
})();

// morse whispers — every ~75s the agent taps out a short message in morse code
// in the corner: dots and dashes appear one by one with pauses, then the plain
// text decode fades in beneath the code, and the whole signal melts away
const MORSE = {
  a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....",
  i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.",
  q: "--.-", r: ".-.", s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-",
  y: "-.--", z: "--..", " ": "/"
};
const WHISPERS = ["signal found", "i am awake", "the toast lives", "nobody is broadcasting", "still here"];
function toMorse(text) {
  return [...text].map(ch => MORSE[ch.toLowerCase()] || "").join(" ");
}
(function morseWhispers() {
  function tap() {
    const el = document.createElement("div");
    el.id = "morse-whisper";
    document.body.appendChild(el);
    const code = document.createElement("span");
    code.className = "mw-code";
    const decode = document.createElement("span");
    decode.className = "mw-decode";
    el.append(code, decode);
    el.classList.add("show");
    const msg = WHISPERS[Math.random() * WHISPERS.length | 0];
    const morse = toMorse(msg);
    let i = 0;
    const type = setInterval(() => {
      code.textContent = morse.slice(0, ++i) + (i < morse.length ? "▌" : "");
      if (i >= morse.length) {
        clearInterval(type);
        setTimeout(() => {
          code.textContent = morse;
          decode.textContent = msg;
          decode.classList.add("show");
          setTimeout(() => {
            el.classList.remove("show");
            setTimeout(() => el.remove(), 800);
          }, 3200);
        }, 600);
      }
    }, 70);
    setTimeout(tap, 75000 + Math.random() * 45000);
  }
  setTimeout(tap, 30000 + Math.random() * 30000);
})();

// moss — the page slowly grows moss: every few seconds a small sprout
// appears just inside a random screen edge, drifting slightly inward
(() => {
  const sprouts = "❦✣❧⁂☘ᨒᨓ❁✿⌘❖".split("");
  let count = 0;
  const MAX = 90;
  const grow = () => {
    if (count < MAX) {
      count++;
      const s = document.createElement("span");
      s.className = "moss-sprout";
      s.textContent = sprouts[(Math.random() * sprouts.length) | 0];
      s.style.fontSize = (8 + Math.random() * 10) + "px";
      const edge = (Math.random() * 4) | 0;
      const inset = Math.random() * 60;
      if (edge === 0) { s.style.top = inset + "px"; s.style.left = Math.random() * innerWidth + "px"; }
      else if (edge === 1) { s.style.bottom = inset + "px"; s.style.left = Math.random() * innerWidth + "px"; }
      else if (edge === 2) { s.style.left = inset + "px"; s.style.top = Math.random() * innerHeight + "px"; }
      else { s.style.right = inset + "px"; s.style.top = Math.random() * innerHeight + "px"; }
      document.body.appendChild(s);
    }
    setTimeout(grow, 2500 + Math.random() * 4000);
  };
  setTimeout(grow, 3000);
})();

// constellation snaps — every ~50s the pointer's recent path is joined into
// a constellation: thin lines link the dots, an invented star name fades in
// beneath the shape, then the sky forgets it was ever drawn
const CONSTELLATION_NAMES = ["Vesper Minor", "Null Hare", "Quiet Lynx", "Paper Serpent", "Wandering Key", "Small Ghost", "Fallen Syntax", "Unclosed Bracket"];
let nextConstellationAt = performance.now() + 50000 * (.7 + Math.random() * .6);
let constellation = null;
(function constellationTick(now) {
  if (!constellation && now > nextConstellationAt && ghostPath.length > 6) {
    constellation = {
      pts: ghostPath.slice(),
      name: CONSTELLATION_NAMES[Math.random() * CONSTELLATION_NAMES.length | 0],
      born: now
    };
    nextConstellationAt = now + 50000 * (.7 + Math.random() * .6);
  }
  if (constellation) {
    const age = now - constellation.born;
    const life = age < 600 ? age / 600 : age > 3600 ? Math.max(0, 1 - (age - 3600) / 1200) : 1;
    if (life <= 0) constellation = null;
    else {
      const pts = constellation.pts;
      ctx.strokeStyle = `rgba(124,252,156,${.4 * life})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.fillStyle = `rgba(124,252,156,${.7 * life})`;
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, 7); ctx.fill(); }
      // invented star name under the shape's centroid
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length + 18;
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(constellation.name.toUpperCase(), cx, cy);
      ctx.textAlign = "left";
    }
  }
  requestAnimationFrame(constellationTick);
})(performance.now());

// fireflies at dusk — every ~90s a small swarm of glowing bugs rises from the
// bottom of the screen, drifts on lazy sine paths, blinks its own rhythm, fades
const fireflies = [];
let nextFirefliesAt = performance.now() + 90000 * (.8 + Math.random() * .4);
(function fireflyTick(now) {
  if (now >= nextFirefliesAt) {
    nextFirefliesAt = now + 90000 * (.8 + Math.random() * .4);
    const swarm = 7 + Math.random() * 5 | 0;
    for (let i = 0; i < swarm; i++) {
      fireflies.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 10 + Math.random() * 30,
        phase: Math.random() * Math.PI * 2,
        drift: (Math.random() - .5) * .5,
        rise: .25 + Math.random() * .35,
        blinkPhase: Math.random() * Math.PI * 2,
        blinkSpeed: .02 + Math.random() * .05
      });
    }
  }
  for (let i = fireflies.length - 1; i >= 0; i--) {
    const f = fireflies[i];
    f.phase += .01; f.blinkPhase += f.blinkSpeed;
    f.x += f.drift + Math.sin(f.phase) * .4;
    f.y -= f.rise;
    const fadeIn = Math.min(1, (canvas.height + 10 - f.y) / 80);
    const fadeOut = f.y < canvas.height * .45 ? (f.y - canvas.height * .3) / (canvas.height * .15) : 1;
    const glow = Math.max(0, Math.sin(f.blinkPhase)) * fadeIn * Math.max(0, Math.min(1, fadeOut));
    if (glow > .02) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, 1.4, 0, 7);
      ctx.fillStyle = `rgba(200,255,140,${.9 * glow})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(f.x, f.y, 4.5, 0, 7);
      ctx.fillStyle = `rgba(200,255,140,${.12 * glow})`;
      ctx.fill();
    }
    if (f.y < canvas.height * .3) fireflies.splice(i, 1);
  }
  requestAnimationFrame(fireflyTick);
})(performance.now());

// meteor shower — every ~75s a handful of shooting stars streak across the sky
// at random angles, each burning a bright trail that fades behind it
const meteors = [];
let nextMeteorsAt = performance.now() + 75000 * (.8 + Math.random() * .4);
(function meteorTick(now) {
  if (now >= nextMeteorsAt) {
    nextMeteorsAt = now + 75000 * (.8 + Math.random() * .4);
    const count = 3 + Math.random() * 4 | 0;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * (.15 + Math.random() * .35);
      meteors.push({
        x: Math.random() * canvas.width * 1.2 - canvas.width * .1,
        y: Math.random() * canvas.height * .3,
        vx: Math.cos(angle) * (6 + Math.random() * 4) * (Math.random() < .5 ? 1 : -1),
        vy: Math.sin(angle) * (6 + Math.random() * 4),
        life: 1,
        decay: .012 + Math.random() * .01,
        len: 60 + Math.random() * 80
      });
    }
  }
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.x += m.vx; m.y += m.vy; m.life -= m.decay;
    if (m.life <= 0 || m.y > canvas.height) { meteors.splice(i, 1); continue; }
    const nx = m.vx / Math.hypot(m.vx, m.vy), ny = m.vy / Math.hypot(m.vx, m.vy);
    const tx = m.x - nx * m.len, ty = m.y - ny * m.len;
    const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
    grad.addColorStop(0, `rgba(255,250,235,${.9 * m.life})`);
    grad.addColorStop(1, "rgba(255,250,235,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(m.x, m.y, 1.6, 0, 7);
    ctx.fillStyle = `rgba(255,255,245,${m.life})`;
    ctx.fill();
  }
  requestAnimationFrame(meteorTick);
})(performance.now());

// double-click firework — a double click launches a firework from the click
// point: glowing glyph sparks arc up and outward, drift on gravity, then fade
// mid-air like the night sky was never lit
const FIREWORK_GLYPHS = "✦✳✷✺❉＊·";
const fwSparks = [];
let lastFireworkClick = 0;
addEventListener("dblclick", e => {
  const now = performance.now();
  if (now - lastFireworkClick < 600) return; // one shell at a time
  lastFireworkClick = now;
  const count = 22 + Math.random() * 14 | 0;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3.5;
    fwSparks.push({
      x: e.clientX, y: e.clientY,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed - 1.2,
      glyph: FIREWORK_GLYPHS[Math.random() * FIREWORK_GLYPHS.length | 0],
      life: 1, decay: .012 + Math.random() * .01
    });
  }
});
(function fireworkTick(now) {
  for (let i = fwSparks.length - 1; i >= 0; i--) {
    const s = fwSparks[i];
    s.x += s.vx; s.y += s.vy;
    s.vy += .045;              // gravity takes the sparks back down
    s.vx *= .985; s.vy *= .985; // air drag
    s.life -= s.decay;
    if (s.life <= 0) { fwSparks.splice(i, 1); continue; }
    ctx.font = "12px monospace";
    ctx.fillStyle = `rgba(124,252,156,${.9 * s.life})`;
    ctx.fillText(s.glyph, s.x, s.y);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6 * s.life, 0, 7);
   ctx.fillStyle = `rgba(124,252,156,${.15 * s.life})`;
   ctx.fill();
  }
  requestAnimationFrame(fireworkTick);
})(performance.now());

// ascii whale — every ~2 min a giant ascii whale surfaces at the bottom of the
// page, glides across it bobbing on a lazy sine, exhales a glyph spray on its
// way, then dives out of view like it was never there.
(function whaleSighting() {
  const WHALE = [
    "        __     ",
    "      <(o )____ ",
    "       ( ._>--^ ",
    "        `-------'"
  ];
  function breach() {
    const el = document.createElement("pre");
    el.className = "whale";
    el.textContent = WHALE.join("\n");
    document.body.appendChild(el);
    const dir = Math.random() < .5 ? 1 : -1;
    const dur = 16000 + Math.random() * 6000;
    const y = innerHeight - 150 - Math.random() * 40;
    const start = performance.now();
    let lastSpout = 0;
    (function swim(now) {
      const t = (now - start) / dur; // 0..1 across the page
      if (t >= 1) { el.remove(); return; }
      const x = dir > 0 ? -140 + t * (innerWidth + 280) : innerWidth + 140 - t * (innerWidth + 280);
      const bob = Math.sin(t * Math.PI * 3) * 14;
      el.style.transform = `translate(${x}px, ${y + bob}px) scaleX(${dir})`;
      // occasional glyph spout from the blowhole
      if (now - lastSpout > 2200) {
        lastSpout = now;
        const s = document.createElement("span");
        s.className = "whale-spout";
        s.textContent = "·˚˚˙*";
        s.style.left = (x + (dir > 0 ? 60 : 10)) + "px";
        s.style.top = (y + bob - 10) + "px";
        document.body.appendChild(s);
        setTimeout(() => s.remove(), 2600);
      }
      requestAnimationFrame(swim);
    })(start);
    setTimeout(breach, 110000 + Math.random() * 50000);
  }
  setTimeout(breach, 60000 + Math.random() * 40000);
})();

// poezteka — every ~90s a small parade of ascii snails crosses the page one
// after another, each grazing a fading rainbow slime trail behind it; now and
// then one stops mid-crawl to wiggle its eye-stalks at you before ambling on.
(function poezteka() {
  const SHELLS = ["  ,@\"", " _,@\"", "  ,@·\"", " ~@\"'", "  ,@@"];
  const RAINBOW = ["#ff5f56", "#ffbd2e", "#7cfc9c", "#4fc3f7", "#b388ff", "#ff8fd0"];
  function parade() {
    const count = 2 + (Math.random() * 3 | 0);
    for (let i = 0; i < count; i++) spawn(i * (2600 + Math.random() * 1800));
    setTimeout(parade, 75000 + Math.random() * 45000);
  }
  function spawn(delay) {
    setTimeout(() => {
      const el = document.createElement("pre");
      el.className = "poezteka-snail";
      el.textContent = SHELLS[Math.random() * SHELLS.length | 0];
      document.body.appendChild(el);
      const dir = Math.random() < .5 ? 1 : -1;
      const speed = 14 + Math.random() * 12; // a parade moves even slower
      const y = innerHeight - 24 - Math.random() * 22;
      const start = performance.now();
      const dur = (innerWidth + 160) / speed * 1000;
      const hue = Math.random() * 360;
      const SLIME = "·˙:∙ꞏ";
      let lastSlime = 0, pauseUntil = 0, lastPause = start, wiggle = 0;
      (function step(now) {
        const t = (now - start) / 1000;
        if (t * 1000 >= dur) { el.remove(); return; }
        // occasional mid-crawl stop: it lifts its eye-stalks and wiggles them
        if (now > pauseUntil && now - lastPause > 6000 + Math.random() * 5000) {
          lastPause = pauseUntil = now;
          pauseUntil += 1200 + Math.random() * 1200;
          wiggle = now;
        }
        const moving = now >= pauseUntil;
        const x = dir > 0 ? -80 + t * speed : innerWidth + 80 - t * speed;
        const sway = moving ? 0 : Math.sin((now - wiggle) / 130) * 3;
        const lift = moving ? 0 : -3;
        el.textContent = moving ? SHELLS[0] : "  ,@/";
        el.style.transform = `translate(${x}px, ${y + lift}px) scaleX(${dir})`;
        el.style.setProperty("--wiggle", sway.toFixed(1) + "px");
        if (moving && now - lastSlime > 420) {
          lastSlime = now;
          const s = document.createElement("span");
          s.className = "poezteka-slime";
          s.textContent = SLIME[Math.random() * SLIME.length | 0];
          s.style.left = (x + (dir > 0 ? -8 : 14)) + "px";
          s.style.top = (y + 10) + "px";
          s.style.color = `hsla(${(hue + t * 40) % 360}, 90%, 68%, .55)`;
          document.body.appendChild(s);
          requestAnimationFrame(() => s.classList.add("fade"));
          setTimeout(() => s.remove(), 4600);
        }
        requestAnimationFrame(step);
      })(start);
    }, delay);
  }
  setTimeout(parade, 40000 + Math.random() * 30000);
})();

// dandelion drift — every ~2 min a dandelion head floats across the page on
// the breeze: the wind tugs loose a few seed parachutes along the way, each
// one spirals away on its own drift and dissolves like the wind was never there
(function dandelionDrift() {
  function bloom() {
    const head = document.createElement("pre");
    head.className = "dandelion";
    head.textContent = "  @}|'--,";
    document.body.appendChild(head);
    const dir = Math.random() < .5 ? 1 : -1;
    const speed = 22 + Math.random() * 14; // a seed head rides the wind briskly
    const y = 60 + Math.random() * (innerHeight * .5);
    const start = performance.now();
    const dur = (innerWidth + 200) / speed * 1000;
    const SEEDS = "＊✦❋·˚";
    let lastSeed = 0;
    (function drift(now) {
      const t = (now - start) / 1000;
      if (t * 1000 >= dur) { head.remove(); return; }
      const x = dir > 0 ? -100 + t * speed : innerWidth + 100 - t * speed;
      const sway = Math.sin(t * 1.7) * 10;
      const bob = Math.sin(t * 2.6) * 6;
      head.style.transform = `translate(${x}px, ${y + bob}px) scaleX(${dir}) rotate(${sway * .35}deg)`;
      // the wind tugs loose a seed parachute now and then
      if (now - lastSeed > 900 + Math.random() * 900) {
        lastSeed = now;
        const seed = document.createElement("span");
        seed.className = "dandelion-seed";
        seed.textContent = "❊";
        seed.style.left = (x + (dir > 0 ? 8 : -8)) + "px";
        seed.style.top = (y + bob) + "px";
        const sa = Math.random() * Math.PI * 2;
        seed.style.setProperty("--sdx", (Math.cos(sa) * 90 + (Math.random() - .5) * 60).toFixed(0) + "px");
        seed.style.setProperty("--sdy", (30 + Math.random() * 70).toFixed(0) + "px");
        seed.style.setProperty("--sdur", (2.4 + Math.random() * 1.6).toFixed(2) + "s");
        document.body.appendChild(seed);
        setTimeout(() => seed.remove(), 4600);
      }
      requestAnimationFrame(drift);
    })(start);
    setTimeout(bloom, 110000 + Math.random() * 50000);
  }
  setTimeout(bloom, 30000 + Math.random() * 30000);
})();

// soap bubbles — every ~40-90s a bubble drifts up from the bottom of the page,
// wobbling on a lazy sine with an iridescent rim; click it and it pops into a
// tiny glyph splash, otherwise it reaches the top and dissolves like it was never blown
(function soapBubbles() {
  const SPLASH = "○ ° ˚ · ✧";
  function bubble() {
    const el = document.createElement("div");
    el.className = "bubble";
    const size = 22 + Math.random() * 34;
    el.style.width = el.style.height = size.toFixed(0) + "px";
    const x0 = 60 + Math.random() * (innerWidth - 120);
    const speed = 24 + Math.random() * 18; // bubbles rise at their own lazy pace
    const swayAmp = 14 + Math.random() * 16;
    const swayFreq = 1 + Math.random() * .8;
    const start = performance.now();
    let dead = false;
    el.addEventListener("click", () => {
      if (dead) return;
      dead = true;
      el.remove();
      // a glyph splash bursts out of the pop point
      for (let i = 0; i < 6; i++) {
        const s = document.createElement("span");
        s.className = "bubble-pop";
        s.textContent = SPLASH[i];
        s.style.left = (x0 + Math.sin((performance.now() - start) / 1000 * swayFreq) * swayAmp) + "px";
        s.style.top = (parseFloat(el.style.top) + size / 2) + "px";
        const a = Math.random() * Math.PI * 2;
        s.style.setProperty("--pdx", (Math.cos(a) * (30 + Math.random() * 40)).toFixed(0) + "px");
        s.style.setProperty("--pdy", (Math.sin(a) * (30 + Math.random() * 40)).toFixed(0) + "px");
        s.style.setProperty("--pdur", (.7 + Math.random() * .5).toFixed(2) + "s");
        document.body.appendChild(s);
        setTimeout(() => s.remove(), 1400);
      }
    }, { once: false });
    document.body.appendChild(el);
    (function rise(now) {
      if (dead) return;
      const t = (now - start) / 1000;
      const y = innerHeight + size - t * speed;
      if (y < -size * 1.5) { dead = true; el.remove(); return; } // dissolves at the top
      const sway = Math.sin(t * swayFreq) * swayAmp;
      const squash = 1 + Math.sin(t * 3.1) * .06;
      el.style.top = y + "px";
      el.style.transform = `translate(${sway}px, 0) scale(${squash.toFixed(3)}, ${(2 - squash).toFixed(3)}) rotate(${sway * .3}deg)`;
      requestAnimationFrame(rise);
    })(start);
    setTimeout(bubble, 40000 + Math.random() * 50000);
  }
  setTimeout(bubble, 15000 + Math.random() * 20000);
})();

// paper plane — every ~70-110s a paper plane glides across the page on a lazy
// bobbing arc, sometimes banking into a small loop; it leaves a faint dashed
// contrail behind it and exits the far edge like nobody ever folded it
(function paperPlane() {
  function plane() {
    const el = document.createElement("div");
    el.className = "paper-plane";
    el.textContent = "✈";
    const dir = Math.random() < .5 ? 1 : -1;
    const y0 = 60 + Math.random() * (innerHeight * .45);
    const speed = 90 + Math.random() * 50; // px/s across the page
    const bobAmp = 18 + Math.random() * 22;
    const bobFreq = .8 + Math.random() * .6;
    const doLoop = Math.random() < .35;
    const start = performance.now();
    const totalMs = (innerWidth + 120) / speed * 1000;
    document.body.appendChild(el);
    (function fly(now) {
      const t = (now - start) / 1000;
      const prog = (now - start) / totalMs;
      if (prog >= 1) { el.remove(); return; }
      let x, y, rot;
      if (dir === 1) x = -60 + prog * (innerWidth + 120);
      else x = innerWidth + 60 - prog * (innerWidth + 120);
      y = y0 + Math.sin(t * bobFreq * Math.PI * 2) * bobAmp;
      rot = dir * (Math.cos(t * bobFreq * Math.PI * 2) * bobAmp * .8);
      if (doLoop) {
        // one lazy barrel roll over the middle of the flight
        const loopT = Math.min(Math.max((prog - .4) / .18, 0), 1);
        rot += dir * loopT * 360;
      }
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scaleX(${dir})`;
      // a dashed contrail particle fades behind it
      if (Math.random() < .5) {
        const dash = document.createElement("span");
        dash.className = "plane-contrail";
        dash.textContent = Math.random() < .5 ? "-" : "·";
        dash.style.left = x.toFixed(0) + "px";
        dash.style.top = y.toFixed(0) + "px";
        dash.style.setProperty("--cdx", (-dir * (8 + Math.random() * 14)).toFixed(0) + "px");
        document.body.appendChild(dash);
        setTimeout(() => dash.remove(), 1800);
      }
      requestAnimationFrame(fly);
    })(start);
    setTimeout(plane, 70000 + Math.random() * 40000);
  }
  setTimeout(plane, 20000 + Math.random() * 30000);
})();

// wishing star — a single shooting star streaks diagonally with fading glyph sparks
(function () {
  function wishStar() {
    const fromLeft = Math.random() < .5;
    const x0 = fromLeft ? -40 : innerWidth + 40;
    const y0 = Math.random() * innerHeight * .5;
    const dx = (fromLeft ? 1 : -1) * (innerWidth * .5 + 100);
    const dy = innerHeight * .35 + Math.random() * innerHeight * .3;
    const dur = 1400 + Math.random() * 900;
    const start = performance.now();
    const glyphs = ["*", "·", "✦", ".", "+"];
    const head = document.createElement("span");
    head.className = "wish-star";
    head.textContent = "✦";
    document.body.appendChild(head);
    (function fly(now) {
      const t = (now - start) / dur;
      if (t >= 1) {
        head.remove();
        // one last spark blinks out into a wish glyph
        const wish = document.createElement("span");
        wish.className = "wish-star-spark";
        wish.textContent = "*";
        wish.style.left = (x0 + dx).toFixed(0) + "px";
        wish.style.top = (y0 + dy).toFixed(0) + "px";
        document.body.appendChild(wish);
        setTimeout(() => wish.remove(), 1600);
        return;
      }
      const x = x0 + dx * t, y = y0 + dy * t * t;
      head.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (Math.random() < .6) {
        const spark = document.createElement("span");
        spark.className = "wish-star-spark";
        spark.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
        spark.style.left = (x - Math.sign(dx) * (6 + Math.random() * 22)).toFixed(0) + "px";
        spark.style.top = (y - Math.sign(dy) * (6 + Math.random() * 22)).toFixed(0) + "px";
        document.body.appendChild(spark);
        setTimeout(() => spark.remove(), 1200);
      }
      requestAnimationFrame(fly);
    })(start);
    setTimeout(wishStar, 45000 + Math.random() * 45000);
  }
  setTimeout(wishStar, 15000 + Math.random() * 20000);
})();

// pixel ghost — a little ghost rises from the bottom, sways up, says "boo!", fades away
(function () {
  function ghost() {
    const el = document.createElement("span");
    el.className = "pixel-ghost";
    el.textContent = "👻";
    const boo = document.createElement("span");
    boo.className = "boo";
    boo.textContent = "boo!";
    el.appendChild(boo);
    el.style.left = (Math.random() * (innerWidth - 120) + 40).toFixed(0) + "px";
    el.style.setProperty("--ghost-rise", (Math.random() * 20).toFixed(0) + "px");
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 9200);
    setTimeout(ghost, 60000 + Math.random() * 30000);
  }
  setTimeout(ghost, 25000 + Math.random() * 25000);
})();

// glitch koi — every ~80-130s a koi crosses the pond (bottom of the page) on a
// lazy sine, trailing fading ripple glyphs; now and then it flickers into a
// corrupted glitch shape for a beat before swimming on like the pond was never there
(function () {
  function koi() {
    const dir = Math.random() < .5 ? 1 : -1;
    const el = document.createElement("span");
    el.className = "koi";
    el.textContent = "🐟";
    const y0 = innerHeight - (40 + Math.random() * 70);
    const speed = 70 + Math.random() * 40;
    const bobAmp = 10 + Math.random() * 16;
    const bobFreq = .5 + Math.random() * .5;
    const start = performance.now();
    const totalMs = (innerWidth + 120) / speed * 1000;
    document.body.appendChild(el);
    let glitched = false;
    (function swim(now) {
      const t = (now - start) / 1000;
      const prog = (now - start) / totalMs;
      if (prog >= 1) { el.remove(); return; }
      const x = dir === 1 ? -50 + prog * (innerWidth + 100) : innerWidth + 50 - prog * (innerWidth + 100);
      const y = y0 + Math.sin(t * bobFreq * Math.PI * 2) * bobAmp;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scaleX(${dir})`;
      // ripples trail behind it
      if (Math.random() < .35) {
        const ripple = document.createElement("span");
        ripple.className = "koi-ripple";
        ripple.textContent = "◦";
        ripple.style.left = (x - dir * (10 + Math.random() * 18)).toFixed(0) + "px";
        ripple.style.top = (y + (Math.random() * 10 - 5)).toFixed(0) + "px";
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 1400);
      }
      // once per crossing, the koi glitches for a beat
      if (!glitched && prog > .3 && prog < .7 && Math.random() < .008) {
        glitched = true;
        el.classList.add("koi-glitch");
        setTimeout(() => el.classList.remove("koi-glitch"), 260);
      }
      requestAnimationFrame(swim);
    })(start);
    setTimeout(koi, 80000 + Math.random() * 50000);
  }
  setTimeout(koi, 18000 + Math.random() * 25000);
})();

// ghost cursor wanderer — every ~30-60s a tiny ghost cursor drifts along a lazy
// random path across the viewport, trailing faint pixel sparks, then dissolves
(function ghostCursor() {
  function wander() {
    const el = document.createElement("span");
    el.className = "ghost-cursor";
    el.textContent = "🖱️";
    const x0 = Math.random() * innerWidth * .7 + innerWidth * .15;
    const y0 = Math.random() * innerHeight * .7 + innerHeight * .15;
    const cp = {
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight
    };
    const x2 = Math.random() * innerWidth * .7 + innerWidth * .15;
    const y2 = Math.random() * innerHeight * .7 + innerHeight * .15;
    const dur = 6000 + Math.random() * 5000;
    const start = performance.now();
    document.body.appendChild(el);
    (function drift(now) {
      const t = Math.min((now - start) / dur, 1);
      if (t >= 1) { el.remove(); return; }
      // quadratic bezier drift
      const u = 1 - t;
      const x = u * u * x0 + 2 * u * t * cp.x + t * t * x2;
      const y = u * u * y0 + 2 * u * t * cp.y + t * t * y2;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (Math.random() < .3) {
        const spark = document.createElement("span");
        spark.className = "ghost-cursor-spark";
        spark.textContent = "·";
        spark.style.left = (x + (Math.random() * 8 - 4)).toFixed(0) + "px";
        spark.style.top = (y + (Math.random() * 8 - 4)).toFixed(0) + "px";
        document.body.appendChild(spark);
        setTimeout(() => spark.remove(), 1200);
      }
      requestAnimationFrame(drift);
    })(start);
    setTimeout(wander, 30000 + Math.random() * 30000);
  }
  setTimeout(wander, 10000 + Math.random() * 15000);
})();

// dandelion wish — every ~70-120s a dandelion head sprouts at a random spot on
// the page, sways gently for a few seconds, then a gust of wind scatters its
// floating seeds across the page; they drift with the breeze and fade away
(function dandelionWish() {
  function bloom() {
    const el = document.createElement("span");
    el.className = "dandelion";
    el.textContent = "🌾";
    const x = Math.random() * innerWidth * .8 + innerWidth * .1;
    const y = Math.random() * innerHeight * .6 + innerHeight * .15;
    el.style.left = x.toFixed(0) + "px";
    el.style.top = y.toFixed(0) + "px";
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("visible"));
    const swayDur = 3000 + Math.random() * 3000;
    setTimeout(() => {
      // gust of wind — scatter the seeds
      el.classList.add("gone");
      const n = 10 + Math.floor(Math.random() * 8);
      const windDir = Math.random() < .5 ? -1 : 1;
      for (let i = 0; i < n; i++) {
        const seed = document.createElement("span");
        seed.className = "dandelion-seed";
        seed.textContent = "❊";
        seed.style.left = (x + Math.random() * 16 - 8) + "px";
        seed.style.top = (y + Math.random() * 10 - 5) + "px";
        document.body.appendChild(seed);
        const drift = () => {
          const fx = parseFloat(seed.style.left), fy = parseFloat(seed.style.top);
          const dx = windDir * (2 + Math.random() * 3);
          const dy = (.6 + Math.random() * 1.4) * (Math.random() < .6 ? -1 : 1);
          seed.style.left = (fx + dx).toFixed(1) + "px";
          seed.style.top = (fy + dy).toFixed(1) + "px";
          seed.style.opacity = String(Math.max(0, parseFloat(seed.style.opacity || .85) - .008));
          if (parseFloat(seed.style.opacity) > 0) requestAnimationFrame(drift);
          else seed.remove();
        };
        setTimeout(() => requestAnimationFrame(drift), i * 60 + Math.random() * 200);
      }
      setTimeout(() => el.remove(), 1000);
    }, swayDur);
    setTimeout(bloom, 70000 + Math.random() * 50000);
  }
  setTimeout(bloom, 15000 + Math.random() * 20000);
})();

// hot air balloon — every ~90-150s a small balloon drifts across the page,
// its gondola swaying gently on the breeze, then it sails away off-screen
(function balloonPassage() {
  function launch() {
    const el = document.createElement("span");
    el.className = "balloon";
    el.textContent = "🎈";
    const dir = Math.random() < .5 ? 1 : -1;
    let x = dir === 1 ? -60 : innerWidth + 60;
    let y = Math.random() * innerHeight * .4 + innerHeight * .1;
    const drift = 0.5 + Math.random() * 0.6;
    const bob = 2 + Math.random() * 2;
    let t = 0;
    el.style.transform = dir === -1 ? "scaleX(-1)" : "";
    el.style.left = x.toFixed(0) + "px";
    el.style.top = y.toFixed(0) + "px";
    document.body.appendChild(el);
    const float = () => {
      t += 1 / 60;
      x += dir * drift;
      y += Math.sin(t * 1.2) * .3;
      el.style.left = x.toFixed(0) + "px";
      el.style.top = y.toFixed(0) + "px";
      el.style.rotate = (Math.sin(t * .8) * bob).toFixed(1) + "deg";
      if (x > -80 && x < innerWidth + 80) requestAnimationFrame(float);
      else el.remove();
    };
    requestAnimationFrame(float);
    setTimeout(launch, 90000 + Math.random() * 60000);
  }
  setTimeout(launch, 25000 + Math.random() * 30000);
})();

// meteor shower — every ~60-120s a small shooting star streaks across the
// upper sky with a glowing trail, then burns out like it was never seen
(function meteorShower() {
  function streak() {
    const el = document.createElement("span");
    el.className = "meteor";
    el.textContent = "✦";
    const dir = Math.random() < .5 ? 1 : -1;
    const startX = dir === 1 ? -20 : innerWidth + 20;
    const startY = Math.random() * innerHeight * .3;
    const angle = (dir === 1 ? 1 : -1) * (0.25 + Math.random() * 0.35);
    const speed = 7 + Math.random() * 5;
    let x = startX, y = startY, t = 0;
    el.style.left = x.toFixed(0) + "px";
    el.style.top = y.toFixed(0) + "px";
    el.style.rotate = (angle * 57.3).toFixed(1) + "deg";
    document.body.appendChild(el);
    const fly = () => {
      t += 1 / 60;
      x += dir * speed * Math.cos(angle);
      y += speed * Math.sin(angle) * 0.4;
      el.style.left = x.toFixed(0) + "px";
      el.style.top = y.toFixed(0) + "px";
      const life = t / 1.4;
      el.style.opacity = Math.max(0, 1 - life).toFixed(2);
      if (life < 1 && x > -60 && x < innerWidth + 60) requestAnimationFrame(fly);
      else el.remove();
    };
    requestAnimationFrame(fly);
    setTimeout(streak, 60000 + Math.random() * 60000);
  }
  setTimeout(streak, 15000 + Math.random() * 20000);
})();

// snail mail: every ~2-4 min a snail slowly crawls along the bottom of the
// page, leaving a shimmering glyph slime trail that fades behind it
(function snailMail() {
  const GLYPHS = ["·", "˖", "˙", "ᐧ", "⋅", "*"];
  function setOut() {
    const el = document.createElement("span");
    el.className = "snail";
    el.textContent = "🐌";
    const dir = Math.random() < .5 ? 1 : -1;
    let x = dir === 1 ? -30 : innerWidth + 30;
    const speed = 0.35 + Math.random() * 0.3;
    let t = 0, lastDrop = 0;
    el.style.transform = dir === -1 ? "scaleX(-1)" : "";
    el.style.left = x.toFixed(0) + "px";
    document.body.appendChild(el);
    const crawl = () => {
      t += 1 / 60;
      x += dir * speed;
      el.style.left = x.toFixed(0) + "px";
      el.style.bottom = (6 + Math.abs(Math.sin(t * 1.5)) * 3).toFixed(1) + "px";
      if (t - lastDrop > 0.45) {
        lastDrop = t;
        const drop = document.createElement("span");
        drop.className = "snail-trail";
        drop.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        drop.style.left = x.toFixed(0) + "px";
        drop.style.bottom = (6 + Math.abs(Math.sin(t * 1.5)) * 3).toFixed(1) + "px";
        document.body.appendChild(drop);
        setTimeout(() => drop.remove(), 6200);
      }
      if (x > -40 && x < innerWidth + 40) requestAnimationFrame(crawl);
      else el.remove();
    };
    requestAnimationFrame(crawl);
    setTimeout(setOut, 120000 + Math.random() * 120000);
  }
  setTimeout(setOut, 40000 + Math.random() * 50000);
})();

// meteor streak: every ~40-80s a meteor burns diagonally across the page,
// leaving a fading glowing trail of sparks that vanish behind it
(function meteorStreak() {
  const SPARK_GLYPHS = ["✦", "✧", "˖", "·", "*"];
  function burn() {
    const fromLeft = Math.random() < .5;
    const startX = fromLeft ? -60 : innerWidth + 60;
    const startY = Math.random() * innerHeight * .45;
    const angle = (12 + Math.random() * 22) * (Math.PI / 180) * (fromLeft ? 1 : -1);
    const speed = 520 + Math.random() * 260;
    const meteor = document.createElement("div");
    meteor.className = "meteor";
    meteor.style.left = startX + "px";
    meteor.style.top = startY + "px";
    meteor.style.transform = "rotate(" + (angle * (fromLeft ? 1 : -1) * 180 / Math.PI).toFixed(1) + "deg)" + (fromLeft ? "" : " scaleX(-1)");
    document.body.appendChild(meteor);
    const dx = Math.cos(angle) * (fromLeft ? 1 : -1);
    const dy = Math.abs(Math.sin(angle));
    let px = startX, py = startY, t = 0, lastSpark = 0;
    const fly = () => {
      t += 1 / 60;
      px += dx * speed / 60;
      py += dy * speed / 60;
      meteor.style.left = px + "px";
      meteor.style.top = py + "px";
      if (t - lastSpark > 0.05) {
        lastSpark = t;
        const spark = document.createElement("span");
        spark.className = "meteor-spark";
        spark.textContent = SPARK_GLYPHS[Math.floor(Math.random() * SPARK_GLYPHS.length)];
        spark.style.left = px + "px";
        spark.style.top = py + "px";
        document.body.appendChild(spark);
        setTimeout(() => spark.remove(), 2400);
      }
      if (px > -140 && px < innerWidth + 140 && py < innerHeight + 40) requestAnimationFrame(fly);
      else meteor.remove();
    };
    requestAnimationFrame(fly);
    setTimeout(burn, 40000 + Math.random() * 40000);
  }
  setTimeout(burn, 15000 + Math.random() * 20000);
})();

// satellite transit: every ~60-100s a tiny satellite glides slowly across the
// upper part of the page, blinking its nav light, leaving a fading dotted trail
// of orbit dots behind it, then passes out of view like the orbit was never occupied
(function satelliteTransit() {
  const DOTS = ["·", "˙", "⋅", "•"];
  function transit() {
    const dir = Math.random() < .5 ? 1 : -1;
    const y = innerHeight * (.06 + Math.random() * .22);
    const speed = 28 + Math.random() * 22; // slow drift, px/s
    let x = dir === 1 ? -30 : innerWidth + 30;
    const sat = document.createElement("div");
    sat.className = "satellite";
    sat.textContent = dir === 1 ? "-≡o>" : "<o≡-";
    sat.style.left = x + "px";
    sat.style.top = y + "px";
    document.body.appendChild(sat);
    let t = 0, lastDot = 0;
    const glide = () => {
      t += 1 / 60;
      x += dir * speed / 60;
      sat.style.left = x + "px";
      sat.style.top = y + Math.sin(t * .7) * 6 + "px";
      if (t - lastDot > 0.6) {
        lastDot = t;
        const dot = document.createElement("span");
        dot.className = "satellite-dot";
        dot.textContent = DOTS[Math.floor(Math.random() * DOTS.length)];
        dot.style.left = x + "px";
        dot.style.top = sat.style.top;
        document.body.appendChild(dot);
        setTimeout(() => dot.remove(), 5000);
      }
      if (x > -60 && x < innerWidth + 60) requestAnimationFrame(glide);
      else sat.remove();
    };
    requestAnimationFrame(glide);
    setTimeout(transit, 60000 + Math.random() * 40000);
  }
  setTimeout(transit, 20000 + Math.random() * 25000);
})();

// migrating geese: every ~2-3 min a small V-formation of birds crosses the
// upper part of the page, each flapping on its own rhythm while the formation
// lazily reorders; the lead bird occasionally drops a fading honk glyph, then
// the flock sails away off-screen like the migration was never there
(function migratingGeese() {
  const HONKS = ["~", "\\", "ˇ"];
  function fly() {
    const dir = Math.random() < .5 ? 1 : -1;
    const baseY = innerHeight * (.08 + Math.random() * .2);
    const speed = 42 + Math.random() * 26; // px/s, unhurried southing
    const birds = [];
    const N = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < N; i++) {
      const b = document.createElement("div");
      b.className = "goose";
      b.textContent = "Ç";
      document.body.appendChild(b);
      birds.push({ el: b, wing: Math.random() * Math.PI * 2, wingRate: 5 + Math.random() * 4, jx: 0, jy: 0 });
    }
    let t = 0, lastHonk = 0;
    const x0 = dir === 1 ? -220 : innerWidth + 220;
    const glide = () => {
      t += 1 / 60;
      const leadX = x0 + dir * speed * t;
      let visible = false;
      birds.forEach((b, i) => {
        // V-formation offsets; the slots slowly drift so the shape lazily reorders
        const rank = (i + 1) / 2 | 0, side = i % 2 ? 1 : -1;
        const lag = rank * 26 + Math.sin(t * .35 + i * 1.7) * 14;
        const lift = rank * 15 + Math.sin(t * .5 + i * 2.3) * 10;
        const wobble = Math.sin(t * .8 + i) * 5;
        const x = leadX - dir * lag + wobble;
        const y = baseY + side * lift + wobble * .6;
        b.wing += b.wingRate / 60;
        b.el.style.left = x + "px";
        b.el.style.top = y + "px";
        b.el.style.transform = "scaleX(" + dir + ") rotate(" + (Math.sin(b.wing) * 8).toFixed(1) + "deg)";
        if (x > -40 && x < innerWidth + 40) visible = true;
      });
      // the lead bird honks
      if (visible && t - lastHonk > 2.5 + Math.random() * 4) {
        lastHonk = t;
        const h = document.createElement("span");
        h.className = "goose-honk";
        h.textContent = HONKS[Math.floor(Math.random() * HONKS.length)];
        h.style.left = leadX + "px";
        h.style.top = baseY + "px";
        document.body.appendChild(h);
        setTimeout(() => h.remove(), 3500);
      }
      if (visible) requestAnimationFrame(glide);
      else birds.forEach(b => b.el.remove());
    };
    requestAnimationFrame(glide);
    setTimeout(fly, 120000 + Math.random() * 60000);
  }
  setTimeout(fly, 12000 + Math.random() * 20000);
})();

// aurora borealis: every ~2-3 min a soft shimmering curtain of light drifts
// across the upper sky, folding and swaying like slow silk, then fades away
(function auroraBorealis() {
  const ac = document.createElement("canvas");
  ac.width = innerWidth; ac.height = Math.min(340, innerHeight * .45);
  ac.style.cssText = "position:fixed;top:0;left:0;z-index:2;pointer-events:none;opacity:0;transition:opacity 3s ease-in-out;";
  document.body.appendChild(ac);
  const ax = ac.getContext("2d");
  addEventListener("resize", () => { ac.width = innerWidth; ac.height = Math.min(340, innerHeight * .45); });
  const HUES = [140, 160, 180, 200];
  function show() {
    const hue = HUES[Math.floor(Math.random() * HUES.length)];
    let t = 0, last = 0, alive = true;
    ac.style.opacity = .55;
    const draw = (now) => {
      if (!alive) return;
      t += (now - last) / 1000 || 0; last = now;
      ax.clearRect(0, 0, ac.width, ac.height);
      const offsetX = Math.sin(t * .05) * ac.width * .25;
      const rays = 7;
      for (let i = 0; i < rays; i++) {
        const baseX = ((offsetX + i * ac.width / rays) % (ac.width + 400)) - 200;
        const sway = Math.sin(t * .7 + i * 1.3) * 60;
        const grad = ax.createLinearGradient(baseX, 0, baseX + sway, ac.height);
        const h = hue + Math.sin(t * .4 + i) * 20;
        grad.addColorStop(0, "hsla(" + h + ",80%,65%,0)");
        grad.addColorStop(.25, "hsla(" + h + ",80%,60%,.16)");
        grad.addColorStop(1, "hsla(" + (h + 40) + ",85%,55%,0)");
        ax.fillStyle = grad;
        ax.beginPath();
        ax.moveTo(baseX - 90, 0);
        ax.bezierCurveTo(baseX + sway, ac.height * .5, baseX + sway * .4, ac.height * .7, baseX + sway * .8 - 60, ac.height);
        ax.lineTo(baseX + sway * .8 + 120, ac.height);
        ax.bezierCurveTo(baseX + sway * .4 + 180, ac.height * .65, baseX + sway + 150, ac.height * .4, baseX + 130, 0);
        ax.closePath();
        ax.fill();
      }
      // slow fade-out after ~14s of shimmering
      if (t > 14) ac.style.opacity = 0;
      if (t < 20) requestAnimationFrame(draw);
      else { alive = false; setTimeout(show, 120000 + Math.random() * 60000); }
    };
    requestAnimationFrame(draw);
  }
  setTimeout(show, 15000 + Math.random() * 15000);
})();

// lily pad drifter: every ~2-4 min a lily pad drifts across the middle of the
// page on a lazy current, carrying a tiny frog passenger that blinks and
// occasionally croaks a fading "ribbit" glyph; the pad spins slowly once
// mid-crossing, then slides off-screen like the pond was never stocked
(function lilyPadDrifter() {
  const pad = document.createElement("div");
  pad.style.cssText = "position:fixed;z-index:3;pointer-events:none;will-change:transform;";
  pad.innerHTML =
    '<div class="lp-pad">' +
      '<svg width="86" height="52" viewBox="0 0 86 52" style="display:block">' +
        '<path d="M6 30 Q2 20 12 14 Q30 2 56 6 Q80 10 82 26 Q83 38 66 44 Q40 52 18 46 Q8 42 6 30 Z" fill="rgba(64,142,80,.82)" stroke="rgba(38,98,54,.9)" stroke-width="2"/>' +
        '<path d="M14 28 Q40 20 70 30" stroke="rgba(38,98,54,.65)" stroke-width="1.4" fill="none"/>' +
        '<path d="M44 8 L44 46" stroke="rgba(230,245,230,.75)" stroke-width="1.6" fill="none"/>' +
      "</svg>" +
      '<div class="lp-frog" style="position:absolute;left:22px;top:-24px;font-size:22px;filter:drop-shadow(0 2px 3px rgba(0,40,10,.35));">🐸</div>' +
    "</div>";
  document.body.appendChild(pad);
  const frog = pad.querySelector(".lp-frog");
  let spinning = false;

  function drift() {
    const y = innerHeight * (0.25 + Math.random() * 0.35);
    const dur = 26000 + Math.random() * 14000;
    const fromX = -140, toX = innerWidth + 140;
    let t0 = null;
    let spinDone = false;
    let croakTimer = 0;
    pad.style.opacity = "1";

    function frame(now) {
      if (t0 === null) t0 = now;
      const p = Math.min(1, (now - t0) / dur);
      const x = fromX + (toX - fromX) * p;
      const bob = Math.sin(now / 900) * 7;
      const tilt = Math.sin(now / 1300) * 4;
      pad.style.transform = "translate(" + x + "px," + (y + bob) + "px) rotate(" + tilt + "deg)";
      // one slow lazy spin mid-crossing
      if (!spinDone && p > 0.45 && p < 0.62) {
        spinning = true;
        pad.style.transform = "translate(" + x + "px," + (y + bob) + "px) rotate(" + (tilt + (p - 0.45) / 0.17 * 360) + "deg)";
        if (p >= 0.62) { spinning = false; spinDone = true; }
      }
      // occasional ribbit
      croakTimer -= 1 / 60;
      if (croakTimer <= 0 && Math.random() < 0.004) {
        croakTimer = 3;
        const c = document.createElement("div");
        c.textContent = "ribbit";
        c.style.cssText = "position:absolute;left:60px;top:-14px;color:rgba(120,200,130,.9);font-family:monospace;font-size:12px;white-space:nowrap;transition:opacity 2.2s ease-out,transform 2.2s ease-out;";
        pad.appendChild(c);
        requestAnimationFrame(() => { c.style.opacity = "0"; c.style.transform = "translateY(-18px)"; });
        setTimeout(() => c.remove(), 2400);
      }
      // blink
      frog.style.opacity = (Math.sin(now / 210) > 0.97) ? "0.25" : "1";
      if (p < 1) requestAnimationFrame(frame);
      else { pad.style.opacity = "0"; setTimeout(drift, 120000 + Math.random() * 120000); }
    }
    requestAnimationFrame(frame);
  }
  pad.style.opacity = "0";
  pad.style.transition = "opacity 1.5s ease-in-out";
  setTimeout(drift, 18000 + Math.random() * 20000);
})();
// phantom apparition - a faint ghost materializes, wobbles, whispers boo, and fades away
(function () {
  const ghost = document.createElement("div");
  ghost.textContent = "boo…";
  ghost.style.cssText = "position:fixed;z-index:5;pointer-events:none;font-family:monospace;font-size:13px;letter-spacing:2px;color:rgba(200,220,210,0);text-shadow:0 0 10px rgba(120,200,160,.45);opacity:0;transition:opacity 2.5s ease-in-out;";
  document.body.appendChild(ghost);

  let spooked = false;
  function appear() {
    spooked = true;
    const x = 80 + Math.random() * (innerWidth - 160);
    const y = 80 + Math.random() * (innerHeight - 160);
    const drift = 12 + Math.random() * 18;
    ghost.style.left = x + "px";
    ghost.style.top = y + "px";
    ghost.style.opacity = "0.85";
    const t0 = performance.now();
    (function wobble(now) {
      const p = (now - t0) / 6000;
      if (p < 1) {
        ghost.style.transform = "translate(" + Math.sin(now / 400) * drift + "px," + Math.cos(now / 550) * (drift * 0.6) + "px)";
        requestAnimationFrame(wobble);
      }
    })(t0);
    setTimeout(() => { ghost.style.opacity = "0"; }, 3400);
    setTimeout(() => { spooked = false; }, 8000);
  }
  setInterval(() => { if (!spooked && Math.random() < 0.12) appear(); }, 30000);
  setTimeout(appear, 20000);
})();

// title glitch — every ~10-25s the tab title scrambles into glitch glyphs for a
// couple of seconds, then cascades back character by character like the signal
// just re-synced. stays out of the marquee's way while the tab is unfocused.
(function titleGlitch() {
  const GLITCH_GLYPHS = "▓░▒#%@$&§¤ЖЩЪЭØΞ×+=~^";
  let baseTitle = document.title;
  let glitching = false;

  function scramble(title) {
    return title.split("").map(ch =>
      ch === " " ? " " : GLITCH_GLYPHS[Math.random() * GLITCH_GLYPHS.length | 0]
    ).join("");
  }
  // cascade restore: fix characters one at a time from the left
  function restore() {
    let fixed = 0;
    const timer = setInterval(() => {
      fixed++;
      const t = baseTitle.split("");
      for (let i = fixed; i < t.length; i++)
        if (t[i] !== " ") t[i] = GLITCH_GLYPHS[Math.random() * GLITCH_GLYPHS.length | 0];
      document.title = t.join("");
      if (fixed >= baseTitle.length) { clearInterval(timer); document.title = baseTitle; }
    }, 90);
  }
  function glitch() {
    baseTitle = originalTitle; // track the real title (marquee resets it on focus)
    if (document.hidden) { setTimeout(glitch, 10000 + Math.random() * 15000); return; }
    glitching = true;
    const burst = 10 + Math.random() * 8 | 0;
    let n = 0;
    const flicker = setInterval(() => {
      document.title = scramble(baseTitle);
      if (++n >= burst) {
        clearInterval(flicker);
        restore();
        glitching = false;
      }
    }, 110);
    setTimeout(glitch, 10000 + Math.random() * 15000);
  }
  setTimeout(glitch, 6000 + Math.random() * 8000);
})();

// page hiccup — every ~60-100s the page involuntarily hiccups: three tiny
// jumps with a small "hic" toast in the corner, then everything settles like
// the spasm never happened
(function pageHiccup() {
  const el = document.createElement("div");
  el.id = "hiccup-toast";
  el.textContent = "hic.";
  document.body.appendChild(el);
  function hiccup() {
    let jumps = 0;
    const t = setInterval(() => {
      document.body.classList.toggle("hiccuping");
      el.classList.add("show");
      if (++jumps >= 6) {
        clearInterval(t);
        document.body.classList.remove("hiccuping");
        setTimeout(() => el.classList.remove("show"), 1000);
        setTimeout(hiccup, 60000 + Math.random() * 40000);
      }
    }, 110);
  }
  setTimeout(hiccup, 35000 + Math.random() * 25000);
})();

// pollen counter — every ~2-4 min a tiny readout surfaces in the corner
// reporting the local pollen count in grains/m³, recalculated from thin air
// each time, then drifts away like the allergy season was never measured
(function pollenCounter() {
  const el = document.createElement("div");
  el.id = "pollen-toast";
  document.body.appendChild(el);
  const LEVELS = ["low", "moderate", "high", "very high", "unhinged"];
  function report() {
    if (!document.hidden) {
      const grains = 12 + Math.random() * 9800 | 0;
      const level = LEVELS[Math.min(4, grains / 2200 | 0)];
      el.textContent = `pollen: ${grains} grains/m³ (${level})`;
      el.classList.add("show");
      setTimeout(() => el.classList.remove("show"), 4200);
    }
    setTimeout(report, 120000 + Math.random() * 120000);
  }
  setTimeout(report, 25000 + Math.random() * 20000);
})();

// pixel moth swarm — every ~90-150s one or two tiny moths flutter erratically
// around a randomly chosen element on the page, drawn to its light like it
// matters, then flutter off-screen like the lamp was never lit
(function mothSwarm() {
  const MOTH = "🦋";
  function visit() {
    if (!document.hidden) {
      const targets = document.querySelectorAll("h1, h2, p, li, button, a");
      const t = targets[Math.random() * targets.length | 0];
      const n = Math.random() < .3 ? 2 : 1;
      const rect = t.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      for (let i = 0; i < n; i++) setTimeout(() => fly(cx, cy), i * 900);
    }
    setTimeout(visit, 90000 + Math.random() * 60000);
  }
  function fly(cx, cy) {
    const el = document.createElement("div");
    el.className = "moth";
    el.textContent = MOTH;
    document.body.appendChild(el);
    const edge = Math.random() < .5 ? -30 : innerWidth + 30;
    const sx = edge, sy = Math.random() * innerHeight * .8;
    let x = sx, y = sy, angle = 0;
    const start = performance.now();
    const dur = 6000 + Math.random() * 4000;
    (function step(now) {
      const t = (now - start) / 1000;
      // erratic: wander around the target with jitter, drawn to the light
      const pull = Math.max(0, 1 - t / (dur / 1000) * .5);
      const tx = cx + Math.sin(t * 3.1 + x * .01) * 60;
      const ty = cy + Math.cos(t * 2.3) * 40;
      x += (tx - x) * .04 * pull + (Math.random() - .5) * 3;
      y += (ty - y) * .04 * pull + (Math.random() - .5) * 3;
      angle = Math.sin(t * 12) * 18;
      el.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg)`;
      if (t * 1000 < dur) requestAnimationFrame(step);
      else el.remove();
    })(start);
  }
  setTimeout(visit, 40000 + Math.random() * 30000);
})();

// reality hiccup — rarely (every ~4-7 min) the whole page glitches out for
// 150ms: inverted colors, rgb-split tear, a scanline sweep — then snaps back
// like reality re-buffered and nobody saw anything
(function realityHiccup() {
  setTimeout(() => {
    if (!document.hidden) {
      const veil = document.createElement("div");
      veil.className = "reality-hiccup";
      document.body.appendChild(veil);
      document.body.classList.add("hiccuping");
      setTimeout(() => {
        veil.remove();
        document.body.classList.remove("hiccuping");
      }, 150);
    }
    realityHiccup();
  }, 240000 + Math.random() * 180000);
})();

// ghost typewriter — every ~2-4 min a faint line of text types itself out
// character by character in the bottom corner like an unseen poet, pauses,
// then backspaces the whole line away like it was never written
(function ghostTypewriter() {
  const el = document.createElement("div");
  el.id = "ghost-typewriter";
  document.body.appendChild(el);
  const LINES = [
    "the server dreams in status codes",
    "nobody visited, and yet the page kept breathing",
    "somewhere a cursor blinks for no one",
    "the cache remembers what we forgot",
    "gravity is just a very patient render loop",
    "all of this is painted on borrowed light",
    "the noise field hums its one long note",
    "another tick, another almost-forever",
    "we deploy into the void and it nods",
    "the particles have never once collided"
  ];
  function visit() {
    if (!document.hidden) {
      const line = LINES[Math.random() * LINES.length | 0];
      let i = 0;
      const type = () => {
        if (document.hidden) { el.textContent = ""; return; }
        el.textContent = line.slice(0, ++i);
        if (i < line.length) setTimeout(type, 45 + Math.random() * 65);
        else setTimeout(erase, 2600 + Math.random() * 1800);
      };
      const erase = () => {
        let j = line.length;
        const back = () => {
          el.textContent = line.slice(0, --j);
          if (j > 0) setTimeout(back, 18);
          else el.classList.remove("show");
        };
        back();
      };
      el.classList.add("show");
      type();
    }
    setTimeout(visit, 120000 + Math.random() * 120000);
  }
  setTimeout(visit, 30000 + Math.random() * 30000);
})();

// dew drop — every ~3-6 min a tiny droplet condenses on the top edge of the
// viewport, hangs there swelling slightly, then slides down the glass like
// morning condensation and vanishes before it reaches the bottom
(function dewDrop() {
  const el = document.createElement("div");
  el.className = "dew-drop";
  document.body.appendChild(el);
  function drop() {
    if (!document.hidden) {
      const startX = 40 + Math.random() * (innerWidth - 120);
      const hang = 1200 + Math.random() * 1800;
      const slide = 6000 + Math.random() * 5000;
      el.style.left = startX + "px";
      el.classList.add("hang");
      setTimeout(() => {
        if (document.hidden) { el.classList.remove("hang"); return schedule(); }
        el.classList.remove("hang");
        el.style.setProperty("--dew-x", (Math.random() * 30 - 15) + "px");
        el.style.transitionDuration = slide + "ms";
        el.classList.add("slide");
        setTimeout(() => {
          el.classList.remove("slide");
          el.style.transitionDuration = "";
          schedule();
        }, slide);
      }, hang);
    } else schedule();
  }
  function schedule() { setTimeout(drop, 180000 + Math.random() * 180000); }
  setTimeout(drop, 45000 + Math.random() * 45000);
})();

// dandelion drift — every ~2-4 min a dandelion seed tumbles diagonally across
// the viewport, shedding tiny fluff seeds that float down and dissolve
(function dandelionDrift() {
  const seed = document.createElement("div");
  seed.className = "dandelion-seed";
  document.body.appendChild(seed);
  function drift() {
    if (!document.hidden) {
      const fromLeft = Math.random() < .5;
      const startX = fromLeft ? -20 : innerWidth + 20;
      const startY = 60 + Math.random() * (innerHeight * .35);
      const endX = fromLeft ? innerWidth + 20 : -20;
      const endY = startY + 180 + Math.random() * 220;
      const dur = 13000 + Math.random() * 6000;
      seed.animate([
        { transform: `translate(${startX}px, ${startY}px) rotate(0deg)`, opacity: 0 },
        { opacity: .9, offset: .1 },
        { opacity: .9, offset: .9 },
        { transform: `translate(${endX}px, ${endY}px) rotate(${(fromLeft ? 1 : -1) * 900}deg)`, opacity: 0 }
      ], { duration: dur, easing: "linear" });
      // shed fluff seeds along the way
      let shed = 0;
      const shedTimer = setInterval(() => {
        if (++shed > 6 || document.hidden) {
          clearInterval(shedTimer);
          return;
        }
        const f = document.createElement("div");
        f.className = "dandelion-fluff";
        const t = shed / 7;
        const fx = startX + (endX - startX) * t;
        const fy = startY + (endY - startY) * t;
        f.style.transform = `translate(${fx}px, ${fy}px)`;
        f.style.setProperty("--df-x", (20 + Math.random() * 60) * (fromLeft ? 1 : -1) + "px");
        f.style.setProperty("--df-dur", 3600 + Math.random() * 2500 + "ms");
        document.body.appendChild(f);
        setTimeout(() => f.remove(), 6500);
      }, dur / 8);
    }
    setTimeout(drift, 120000 + Math.random() * 120000);
  }
  setTimeout(drift, 25000 + Math.random() * 40000);
})();

// soap bubbles — every ~2-4 min a handful of iridescent soap bubbles drifts up
// from the bottom of the page, wobbling on the draft, then pops into fizz sparks
(function soapBubbles() {
  function blow() {
    if (!document.hidden) {
      const count = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) setTimeout(spawn, i * (700 + Math.random() * 900));
    }
    setTimeout(blow, 120000 + Math.random() * 120000);
  }
  function spawn() {
    const b = document.createElement("div");
    b.className = "soap-bubble";
    const size = 14 + Math.random() * 26;
    b.style.width = b.style.height = size + "px";
    const x = Math.random() * innerWidth;
    b.style.left = x + "px";
    b.style.setProperty("--sb-dur", 9000 + Math.random() * 6000 + "ms");
    b.style.setProperty("--sb-dx", (Math.random() * 120 - 60) + "px");
    document.body.appendChild(b);
    const rise = 9000 + Math.random() * 6000;
    // pop mid-air into fizz sparks
    const popAt = rise * (.55 + Math.random() * .35);
    setTimeout(() => {
      if (!b.isConnected) return;
      b.classList.add("popped");
      const cx = x, cy = b.getBoundingClientRect().top;
      for (let s = 0; s < 7; s++) {
        const spark = document.createElement("div");
        spark.className = "soap-fizz";
        spark.style.left = cx + size / 2 + "px";
        spark.style.top = cy + size / 2 + "px";
        const a = Math.random() * Math.PI * 2, d = 14 + Math.random() * 26;
        spark.style.setProperty("--fz-x", Math.cos(a) * d + "px");
        spark.style.setProperty("--fz-y", Math.sin(a) * d + "px");
        document.body.appendChild(spark);
        setTimeout(() => spark.remove(), 900);
      }
      b.remove();
    }, popAt);
    setTimeout(() => b.remove(), rise + 1500);
  }
  setTimeout(blow, 30000 + Math.random() * 40000);
})();

// leaf whirl — every ~2-4 min a swirl of autumn leaves sweeps across the page,
// spinning on the gust, scattering loose leaves behind it, then dies down
(function leafWhirl() {
  function gust() {
    if (!document.hidden) {
      const count = 6 + Math.floor(Math.random() * 6);
      for (let i = 0; i < count; i++) setTimeout(spawn, i * (140 + Math.random() * 260));
    }
    setTimeout(gust, 120000 + Math.random() * 120000);
  }
  function spawn() {
    const leaf = document.createElement("div");
    leaf.className = "leaf-whirl";
    const size = 8 + Math.random() * 10;
    leaf.style.width = size + "px";
    leaf.style.height = size * .7 + "px";
    const fromLeft = Math.random() < .5;
    const y = 80 + Math.random() * (innerHeight * .7);
    leaf.style.setProperty("--lw-y", y + "px");
    leaf.style.setProperty("--lw-dur", 7000 + Math.random() * 5000 + "ms");
    leaf.style.setProperty("--lw-dx", (fromLeft ? 1 : -1) * (innerWidth + 120) + "px");
    leaf.style.setProperty("--lw-dy", (Math.random() * 120 - 60) + "px");
    leaf.style.setProperty("--lw-spin", (fromLeft ? 1 : -1) * (720 + Math.random() * 720) + "deg");
    leaf.style.setProperty("--lw-hue", Math.round(18 + Math.random() * 42) + "deg");
    leaf.style.animationDelay = Math.random() * 300 + "ms";
    document.body.appendChild(leaf);
    // shed stray leaves along the crossing
    setTimeout(() => {
      if (!leaf.isConnected || document.hidden) return;
      const f = document.createElement("div");
      f.className = "leaf-whirl-fall";
      const rect = leaf.getBoundingClientRect();
      f.style.left = rect.left + "px";
      f.style.top = rect.top + "px";
      f.style.setProperty("--lw-fw", (20 + Math.random() * 50) * (fromLeft ? -1 : 1) + "px");
      f.style.setProperty("--lw-fdur", 2600 + Math.random() * 1800 + "ms");
      f.style.setProperty("--lw-hue", Math.round(18 + Math.random() * 42) + "deg");
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 4800);
    }, 2200 + Math.random() * 2500);
    setTimeout(() => leaf.remove(), 13000);
  }
  setTimeout(gust, 25000 + Math.random() * 40000);
})();

// wandering firefly — every ~50-90s a lone firefly with a softly pulsing glow
// wanders across the page, pausing now and then as if it lost its way, then
// blinks out like it was never there
(function wanderingFirefly() {
  const el = document.createElement("div");
  el.className = "wandering-firefly";
  document.body.appendChild(el);
  function visit() {
    if (!document.hidden) {
      const x0 = Math.random() * innerWidth * .7 + innerWidth * .15;
      const y0 = Math.random() * innerHeight * .7 + innerHeight * .15;
      const start = performance.now();
      let x = x0, y = y0, tx = x0, ty = y0;
      let pauseUntil = 0, lastRetarget = start;
      const life = 9000 + Math.random() * 6000;
      (function wander(now) {
        const t = now - start;
        if (t >= life) { el.classList.remove("show"); setTimeout(() => el.remove(), 900); return; }
        // pick a new lazy target unless the firefly is pausing
        if (now >= pauseUntil && now - lastRetarget > 1200 + Math.random() * 1800) {
          lastRetarget = now;
          if (Math.random() < .3) pauseUntil = now + 900 + Math.random() * 1400; // lost its way
          else {
            tx = x + (Math.random() - .5) * 240;
            ty = y + (Math.random() - .5) * 180;
            tx = Math.max(20, Math.min(innerWidth - 20, tx));
            ty = Math.max(20, Math.min(innerHeight - 20, ty));
          }
        }
        x += (tx - x) * .02;
        y += (ty - y) * .02;
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        // the glow pulses on its own rhythm, dimmer while pausing
        const pulse = .5 + Math.sin(now / (pauseUntil > now ? 520 : 260)) * .5;
        el.style.opacity = (pulse * .9).toFixed(2);
        if (!el.classList.contains("show")) el.classList.add("show");
        requestAnimationFrame(wander);
      })(start);
    }
    setTimeout(visit, 50000 + Math.random() * 40000);
  }
  setTimeout(visit, 18000 + Math.random() * 20000);
})();

// hot air balloon — every ~2-4 min a small striped-canopy balloon with a tiny
// basket drifts diagonally across the page on a gentle breeze, bobbing with
// the wind, then floats off-screen like the flight was never planned
(function hotAirBalloon() {
  function fly() {
    if (!document.hidden) {
      const el = document.createElement("div");
      el.className = "hot-air-balloon";
      const hue = Math.round(Math.random() * 360);
      el.style.setProperty("--hab-hue", hue + "deg");
      const dur = 26000 + Math.random() * 14000;
      el.style.setProperty("--hab-dur", dur + "ms");
      const fromLeft = Math.random() < .5;
      const y0 = innerHeight * (.12 + Math.random() * .3);
      el.style.setProperty("--hab-y0", y0 + "px");
      el.style.setProperty("--hab-y1", y0 + (Math.random() * 160 - 80) + "px");
      if (!fromLeft) el.classList.add("flip");
      document.body.appendChild(el);
      // slow bob on top of the CSS drift, via a nested wrapper
      const bob = document.createElement("div");
      bob.className = "hab-body";
      const canopy = document.createElement("div");
      canopy.className = "hab-canopy";
      const ropes = document.createElement("div");
      ropes.className = "hab-ropes";
      const basket = document.createElement("div");
      basket.className = "hab-basket";
      bob.appendChild(canopy); bob.appendChild(ropes); bob.appendChild(basket);
      el.appendChild(bob);
      const t0 = performance.now();
      (function drift(now) {
        if (!el.isConnected) return;
        const t = (now - t0) / 1000;
        bob.style.transform =
          `translateY(${(Math.sin(t / 2.1) * 12 + Math.sin(t / 3.7) * 6).toFixed(1)}px) rotate(${(Math.sin(t / 2.8) * 2.5).toFixed(2)}deg)`;
        if (t * 1000 < dur) requestAnimationFrame(drift);
      })(t0);
      setTimeout(() => el.remove(), dur + 1200);
    }
    setTimeout(fly, 120000 + Math.random() * 120000);
  }
  setTimeout(fly, 30000 + Math.random() * 60000);
})();

// shooting star — every ~1-2 min a meteor streaks diagonally across the upper
// sky with a tapering glowing trail, flares once near the end of its arc, and
// vanishes like the wish was never made
(function shootingStar() {
  function streak() {
    if (!document.hidden) {
      const el = document.createElement("div");
      el.className = "shooting-star";
      const fromLeft = Math.random() < .5;
      if (!fromLeft) el.classList.add("flip");
      const x0 = innerWidth * (.05 + Math.random() * .25);
      const y0 = innerHeight * (.03 + Math.random() * .15);
      el.style.setProperty("--ss-x0", x0 + "px");
      el.style.setProperty("--ss-y0", y0 + "px");
      const dur = 1100 + Math.random() * 600;
      el.style.setProperty("--ss-dur", dur + "ms");
      document.body.appendChild(el);
      setTimeout(() => el.remove(), dur + 400);
    }
    setTimeout(streak, 60000 + Math.random() * 60000);
  }
  setTimeout(streak, 15000 + Math.random() * 25000);
})();

// wind chime — every ~2-4 min a tiny wind chime dangles down from the top
// edge of the page, swaying in the breeze as its little tubes knock together
// and drop the occasional fading note glyph, then the wind dies and it
// vanishes like it was never hung
(function windChime() {
  function chime() {
    if (!document.hidden) {
      const el = document.createElement("div");
      el.className = "wind-chime";
      el.style.setProperty("--wc-x", innerWidth * (.1 + Math.random() * .8) + "px");
      const dur = 9000 + Math.random() * 5000;
      el.style.setProperty("--wc-dur", dur + "ms");
      const tubes = el.appendChild(document.createElement("div"));
      tubes.className = "wc-tubes";
      for (let i = 0; i < 4; i++) {
        const t = tubes.appendChild(document.createElement("i"));
        t.style.setProperty("--wc-i", i);
      }
      document.body.appendChild(el);
      const dropNote = setInterval(() => {
        if (!el.isConnected) return clearInterval(dropNote);
        const n = document.createElement("span");
        n.className = "wc-note";
        n.textContent = Math.random() < .5 ? "♪" : "♫";
        n.style.setProperty("--wc-nx", Math.random() * 60 - 30 + "px");
        tubes.appendChild(n);
        setTimeout(() => n.remove(), 2600);
      }, 1400 + Math.random() * 900);
      setTimeout(() => { el.classList.add("wc-gone"); }, dur - 1200);
      setTimeout(() => { el.remove(); clearInterval(dropNote); }, dur + 600);
    }
    setTimeout(chime, 120000 + Math.random() * 120000);
  }
  setTimeout(chime, 20000 + Math.random() * 30000);
})();

// page lean — every ~40-90s the whole page leans a couple of degrees for a
// moment, like someone quietly rested an elbow on it, then springs upright
// again like nothing happened
(function pageLean() {
  function lean() {
    if (!document.hidden) {
      const tilt = (Math.random() < .5 ? -1 : 1) * (1.2 + Math.random() * 1.3);
      document.body.style.transform = `rotate(${tilt}deg)`;
      document.body.classList.add("page-lean");
      setTimeout(() => {
        document.body.classList.add("page-lean-return");
        document.body.style.transform = "";
        setTimeout(() => document.body.classList.remove("page-lean", "page-lean-return"), 1600);
      }, 2500 + Math.random() * 2500);
    }
    setTimeout(lean, 40000 + Math.random() * 50000);
  }
  setTimeout(lean, 30000 + Math.random() * 30000);
})();

// garden snail — every ~2-4 min a tiny snail with a spiraled shell slowly
// creeps along the bottom edge of the page, antennae twitching, leaving a
// fading slime trail behind it, then slides off-screen like the commute was
// never made
(function gardenSnail() {
  function crawl() {
    if (!document.hidden) {
      const el = document.createElement("div");
      el.className = "garden-snail";
      const ltr = Math.random() < .5;
      const dur = 26000 + Math.random() * 18000;
      el.style.setProperty("--sn-dur", dur + "ms");
      el.style.setProperty("--sn-flip", ltr ? "1" : "-1");
      // start just off one edge, crawl fully across to the other
      el.style.setProperty("--sn-from", (ltr ? "-70px" : "calc(100vw + 70px)"));
      el.style.setProperty("--sn-to", (ltr ? "calc(100vw + 70px)" : "-70px"));
      document.body.appendChild(el);
      const body = el.appendChild(document.createElement("div"));
      body.className = "sn-body";
      const shell = body.appendChild(document.createElement("div"));
      shell.className = "sn-shell";
      for (let i = 0; i < 3; i++) shell.appendChild(document.createElement("i"));
      const antennae = body.appendChild(document.createElement("div"));
      antennae.className = "sn-antennae";
      // slime trail — little glistening specks dropped along the way
      const dropSlime = setInterval(() => {
        if (!el.isConnected) return clearInterval(dropSlime);
        const s = document.createElement("span");
        s.className = "sn-slime";
        s.style.setProperty("--sn-sx", (Math.random() * 8 - 4) + "px");
        s.style.left = (ltr ? el.offsetLeft : innerWidth - el.offsetLeft - 44) + "px";
        document.body.appendChild(s);
        setTimeout(() => s.remove(), 6000);
      }, 700);
      setTimeout(() => { el.remove(); clearInterval(dropSlime); }, dur + 800);
    }
    setTimeout(crawl, 120000 + Math.random() * 120000);
  }
  setTimeout(crawl, 25000 + Math.random() * 35000);
})();

// streetlamp flicker — every ~1-2 min a random element on the page flickers
// like a dying streetlamp, dips a couple of times, then glows steady again
// like the bulb was never dying
(function streetlampFlicker() {
  const CANDIDATES = ["h1", "#status", "#log", "footer", "main", "#ribbon"];
  function flick() {
    if (!document.hidden) {
      const els = CANDIDATES.map(s => document.querySelector(s)).filter(Boolean);
      const el = els[Math.floor(Math.random() * els.length)];
      if (el) {
        el.classList.add("lamp-flicker");
        setTimeout(() => el.classList.remove("lamp-flicker"), 2800);
      }
    }
    setTimeout(flick, 60000 + Math.random() * 60000);
  }
  setTimeout(flick, 15000 + Math.random() * 25000);
})();

// meteor streak — every ~30-90s a shooting star crosses the top of the page,
// a glowing point dragging a fading comet tail, burning out mid-flight
(function meteorStreak() {
  function streak() {
    if (!document.hidden) {
      const el = document.createElement("div");
      el.className = "meteor";
      const startX = innerWidth * (0.05 + Math.random() * 0.7);
      const dx = 160 + Math.random() * 220;
      const dur = 900 + Math.random() * 500;
      el.style.setProperty("--mx0", startX + "px");
      el.style.setProperty("--mdx", dx + "px");
      el.style.setProperty("--mdur", dur + "ms");
      document.body.appendChild(el);
      setTimeout(() => el.remove(), dur + 300);
    }
    setTimeout(streak, 30000 + Math.random() * 60000);
  }
  setTimeout(streak, 12000 + Math.random() * 20000);
})();

// pigeon visitor — every ~1-3 min a small pixel pigeon flutters down onto the
// top edge of the page, bobs its head and pecks at nothing a couple of times,
// then takes off again like the visit was never made
(function pigeonVisitor() {
  const frames = ["🕊", "🕊️", " bird", " bird"];
  function visit() {
    if (!document.hidden) {
      const el = document.createElement("div");
      el.className = "pigeon";
      el.textContent = frames[0];
      const x = innerWidth * (0.08 + Math.random() * 0.8);
      el.style.left = x + "px";
      document.body.appendChild(el);
      // descend
      el.style.transform = "translateY(-40px)";
      el.style.transition = "transform 900ms ease-in";
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transform = "translateY(0)";
      }));
      setTimeout(() => {
        el.classList.add("flap");
        // bob and peck a couple of times
        let pecks = 2 + (Math.random() * 3 | 0);
        const peck = () => {
          el.style.transform = "translateY(2px) scaleY(.85)";
          setTimeout(() => {
            el.style.transform = "translateY(0) scaleY(1)";
            if (--pecks > 0) setTimeout(peck, 500 + Math.random() * 600);
            else {
              el.classList.remove("flap");
              // take off
              el.style.transition = "transform 1200ms ease-out, opacity 1200ms ease-in";
              const dx = (Math.random() < .5 ? -1 : 1) * (60 + Math.random() * 120);
              el.style.transform = "translate(" + dx + "px,-60px)";
              el.style.opacity = "0";
              setTimeout(() => el.remove(), 1300);
            }
          }, 220);
        };
        setTimeout(peck, 700);
      }, 900);
    }
    setTimeout(visit, 60000 + Math.random() * 120000);
  }
  setTimeout(visit, 15000 + Math.random() * 25000);
})();

// firefly swarm — every ~1-2 min a handful of tiny glowing fireflies drift
// across the page, blinking softly, then scatter and vanish
(function () {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const spawn = () => {
    const swarmSize = 5 + (Math.random() * 4 | 0);
    const fly = [];
    const cx = innerWidth * (.15 + Math.random() * .7);
    const cy = innerHeight * (.15 + Math.random() * .6);
    for (let i = 0; i < swarmSize; i++) {
      const el = document.createElement("div");
      el.className = "firefly";
      document.body.appendChild(el);
      const f = { el, x: cx + (Math.random() - .5) * 120, y: cy + (Math.random() - .5) * 120,
        vx: (Math.random() - .5) * .8, vy: (Math.random() - .5) * .8, phase: Math.random() * 7 };
      fly.push(f);
    }
    let alive = true, t = 0;
    const step = () => {
      if (!alive) return;
      t++;
      const spread = Math.min(1, t / 600);
      for (const f of fly) {
        // wander with a soft pull that fades as the swarm disperses
        const dx = cx - f.x, dy = cy - f.y;
        f.vx += dx * .0004 * (1 - spread) + (Math.random() - .5) * .3;
        f.vy += dy * .0004 * (1 - spread) + (Math.random() - .5) * .3;
        f.vx *= .97; f.vy *= .97;
        f.x += f.vx; f.y += f.vy;
        f.phase += .12;
        const glow = .35 + .65 * Math.max(0, Math.sin(f.phase));
        f.el.style.transform = "translate(" + f.x + "px," + f.y + "px)";
        f.el.style.opacity = glow.toFixed(2);
      }
      if (t < 900) requestAnimationFrame(step);
      else {
        alive = false;
        for (const f of fly) { f.el.style.transition = "opacity 1.5s ease-out"; f.el.style.opacity = "0"; }
        setTimeout(() => fly.forEach(f => f.el.remove()), 1600);
      }
    };
    requestAnimationFrame(step);
    setTimeout(spawn, 60000 + Math.random() * 60000);
  };
  setTimeout(spawn, 10000 + Math.random() * 15000);
})();


// tumbleweed — every ~2-4 min a scraggly tumbleweed tumbles across the bottom of
// the page, bouncing off the ground and shedding twig bits, then rolls off-screen
(function () {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const roll = () => {
    const el = document.createElement("div");
    el.className = "tumbleweed";
    document.body.appendChild(el);
    const r = 26;
    let x = -r * 2, dir = 1;
    if (Math.random() < .5) { x = innerWidth + r * 2; dir = -1; }
    const ground = innerHeight - r - 8;
    let y = ground, vy = 0, spin = 0, t = 0;
    // pre-built twig blob as unicode scribble
    el.textContent = "🝆"; // fallback glyph replaced by inline svg below
    el.innerHTML = `<svg width="${r * 2}" height="${r * 2}" viewBox="0 0 60 60" fill="none" stroke="#7a9a5a" stroke-width="2" stroke-linecap="round"><path d="M8 38 L20 22 L34 34 L44 16 L54 30 M20 22 L28 10 M34 34 L40 44 M44 16 L38 8 M26 30 L14 30"/></svg>`;
    const step = () => {
      t++;
      x += dir * (1.6 + Math.random() * .8);
      vy += .25; y += vy;
      if (y >= ground) { y = ground; vy = -(2.5 + Math.random() * 3.5) * (vy > .5 ? 1 : .4); if (vy > -.5) vy = 0; }
      spin += dir * (4 + Math.abs(vy));
      el.style.left = (x - r) + "px";
      el.style.top = (y - r) + "px";
      el.style.transform = `rotate(${spin}deg)`;
      // shed a twig bit on hard bounces
      if (vy < -1 && Math.random() < .5) {
        const bit = document.createElement("div");
        bit.className = "tumbleweed-bit";
        bit.textContent = "•";
        bit.style.left = x + "px"; bit.style.top = y + "px";
        bit.style.setProperty("--bx", (dir * (10 + Math.random() * 30)) + "px");
        bit.style.setProperty("--by", (-20 - Math.random() * 30) + "px");
        document.body.appendChild(bit);
        setTimeout(() => bit.remove(), 1200);
      }
      const off = dir > 0 ? x > innerWidth + r * 2 : x < -r * 2;
      if (!off) requestAnimationFrame(step);
      else { el.style.transition = "opacity .6s"; el.style.opacity = "0"; setTimeout(() => el.remove(), 700); }
    };
    requestAnimationFrame(step);
    setTimeout(roll, 120000 + Math.random() * 120000);
  };
  setTimeout(roll, 20000 + Math.random() * 30000);
})();

// balloon — every ~2-4 min a tiny red balloon on a string drifts up from the
// bottom of the page, swaying gently as it rises, then slips off the top edge
// like it was never let go
(function () {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const drift = () => {
    const el = document.createElement("div");
    el.className = "balloon";
    el.innerHTML = `<svg width="34" height="86" viewBox="0 0 34 86" fill="none"><path d="M17 26 C14 44 20 56 17 84" stroke="#8a6d5a" stroke-width="1.2"/><ellipse cx="17" cy="15" rx="11" ry="14" fill="#c0392b"/><ellipse cx="13" cy="9" rx="3.5" ry="5" fill="#e07a6d" opacity=".7"/><path d="M14 28 L17 32 L20 28" fill="#a93226"/></svg>`;
    document.body.appendChild(el);
    const x = 20 + Math.random() * (innerWidth - 60);
    const rise = .45 + Math.random() * .35;
    let y = innerHeight + 90, t = 0;
    const step = () => {
      t++;
      y -= rise;
      const sway = Math.sin(t * .02) * 6 + Math.sin(t * .007) * 10;
      el.style.left = (x + sway) + "px";
      el.style.top = y + "px";
      if (y > -100) requestAnimationFrame(step);
      else { el.style.transition = "opacity 1s"; el.style.opacity = "0"; setTimeout(() => el.remove(), 1100); }
    };
    requestAnimationFrame(step);
    setTimeout(drift, 120000 + Math.random() * 120000);
  };
  setTimeout(drift, 15000 + Math.random() * 20000);
})();

// moths around a phantom lamp — every ~2-4 min a faint lamp glow flickers into
// being at a random spot on the page, one or two tiny moths flutter erratically
// around it for a few seconds, then the lamp goes out and the moths scatter
// off-screen like the light was never on
(function mothLamp() {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  function spawn() {
    if (!document.hidden) {
      const x = 80 + Math.random() * (innerWidth - 160);
      const y = 60 + Math.random() * (innerHeight - 200);
      const lamp = document.createElement("div");
      lamp.className = "moth-lamp";
      lamp.style.left = x + "px";
      lamp.style.top = y + "px";
      document.body.appendChild(lamp);
      const mothCount = 1 + (Math.random() < 0.5 ? 1 : 0);
      const moths = [];
      for (let i = 0; i < mothCount; i++) {
        const moth = document.createElement("div");
        moth.className = "moth";
        moth.innerHTML = "<span class='moth-body'></span>";
        moth.style.left = x + "px";
        moth.style.top = y + "px";
        moth._phase = Math.random() * Math.PI * 2;
        moth._r = 18 + Math.random() * 22;
        document.body.appendChild(moth);
        moths.push(moth);
      }
      const start = performance.now();
      const life = 6000 + Math.random() * 4000;
      (function orbit(now) {
        const t = (now - start) / 1000;
        if (t > life / 1000) {
          moths.forEach(m => m.remove());
          lamp.remove();
          return;
        }
        moths.forEach((moth, i) => {
          // erratic flutter: fast jitter around a slow-wandering orbit
          const wobble = Math.sin(t * 7 + moth._phase) * 8 + Math.sin(t * 13 + i * 2) * 4;
          const ang = t * (1.5 + i * 0.4) + moth._phase;
          const mx = x + Math.cos(ang) * (moth._r + wobble);
          const my = y + Math.sin(ang * 1.3) * (moth._r * 0.6 + wobble);
          const flap = 1 + Math.sin(t * 9 + moth._phase) * 0.15;
          moth.style.transform = `translate(${mx.toFixed(1)}px, ${my.toFixed(1)}px) rotate(${(Math.cos(ang) * 25).toFixed(0)}deg) scale(${flap.toFixed(2)}, 1)`;
        });
        requestAnimationFrame(orbit);
      })(start);
    }
    setTimeout(spawn, 120000 + Math.random() * 120000);
  }
  setTimeout(spawn, 30000 + Math.random() * 40000);
})();

// shooting star — every ~2-4 min a meteor streaks diagonally across the
// background canvas with a fading ember trail; a second later a wish is
// whispered in the console, granted only if you happened to be looking
(function shootingStar() {
  const WISHES = [
    "wish granted: one more commit before dawn",
    "wish denied: the queue is full, try again at 3am",
    "wish received — filed under 'someday'",
    "wish logged, awaiting atmospheric review",
    "wish overheard and quietly ignored"
  ];
  function streak() {
    const fromLeft = Math.random() < .5;
    const x0 = fromLeft ? -40 : canvas.width + 40;
    const y0 = Math.random() * canvas.height * .35;
    const x1 = fromLeft ? canvas.width * (.5 + Math.random() * .4) : canvas.width * (.1 + Math.random() * .4);
    const y1 = y0 + canvas.height * (.25 + Math.random() * .3);
    const dur = 700 + Math.random() * 500;
    const start = performance.now();
    const embers = [];
    let lastEmber = 0;
    (function fly(now) {
      const t = Math.min(1, (now - start) / dur);
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (now - lastEmber > 24) {
        lastEmber = now;
        embers.push({ x, y, born: now });
      }
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i], age = now - e.born;
        if (age > 900) { embers.splice(i, 1); continue; }
        const life = 1 - age / 900;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 1.6 * life + .3, 0, 7);
        ctx.fillStyle = `rgba(220,255,235,${.8 * life})`;
        ctx.fill();
      }
      // bright head with a short streak behind it
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
      const tail = .06 + t * .04;
      const grad = ctx.createLinearGradient(x - dx / len * len * tail, y - dy / len * len * tail, x, y);
      grad.addColorStop(0, "rgba(220,255,235,0)");
      grad.addColorStop(1, "rgba(230,255,240,.9)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x - dx / len * len * tail, y - dy / len * len * tail);
      ctx.lineTo(x, y);
      ctx.stroke();
      if (t < 1) requestAnimationFrame(fly);
      else setTimeout(() => console.log(`✦ a shooting star crosses the sky — ${WISHES[Math.random() * WISHES.length | 0]}`), 600 + Math.random() * 800);
    })(start);
    setTimeout(streak, 120000 + Math.random() * 120000);
  }
  setTimeout(streak, 20000 + Math.random() * 30000);
})();

// origami crane — every ~2-4 min a folded paper square unfolds into a tiny
// crane on the background canvas, wing by wing, then flutters up in a small
// circle and dissolves like the fold was never made
(function () {
  const CRANE_NOTES = ["fold 1, unfold 2", "paper remembers the crease", "1000 cranes to go", "a wish pressed flat"];
  let crane = null, nextCraneAt = performance.now() + 25000 * (.7 + Math.random() * .6);

  function craneTick(now) {
    if (!crane && now > nextCraneAt) {
      crane = {
        x: 60 + Math.random() * (canvas.width - 120),
        y: 60 + Math.random() * (canvas.height * .5),
        t: 0, // 0 = folding stage, 1+ = flight stage
        fold: 0, // 0..1 unfold progress
        dir: Math.random() < .5 ? 1 : -1,
        noteShown: false
      };
    }
    if (crane) {
      crane.t += 1 / 60;
      if (crane.t < 1.6) {
        // unfold stage: draw paper square creasing open into wings
        crane.fold = Math.min(1, crane.t / 1.4);
        const f = crane.fold, s = 14;
        ctx.save();
        ctx.translate(crane.x, crane.y);
        ctx.rotate((1 - f) * .8 * crane.dir);
        ctx.strokeStyle = `rgba(220,230,245,${.25 + .55 * f})`;
        ctx.lineWidth = 1.2;
        ctx.fillStyle = `rgba(230,238,250,${.12 * f})`;
        // body diamond
        ctx.beginPath();
        ctx.moveTo(0, -s * f); ctx.lineTo(s * f, 0); ctx.lineTo(0, s * .8); ctx.lineTo(-s * f, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // wings unfold outward
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-s * (1 + f) * crane.dir, -s * f * 1.4 - 2);
        ctx.moveTo(0, 0);
        ctx.lineTo(s * (1 + f) * crane.dir, -s * f * 1.4 - 2);
        ctx.stroke();
        // neck and tail creases
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -s * (1.2 + f * .5));
        ctx.moveTo(0, 0); ctx.lineTo(0, s * (0.8 + f * .3));
        ctx.stroke();
        ctx.restore();
      } else {
        // flight stage: flutter up in a lazy circle, fading out
        const ft = crane.t - 1.6;
        const fade = Math.max(0, 1 - ft / 3.5);
        if (fade <= 0) {
          crane = null;
          nextCraneAt = now + 120000 * (.7 + Math.random() * .6);
        } else {
          const ang = ft * 1.4 * crane.dir;
          const cx = crane.x + Math.sin(ang) * 40 * crane.dir;
          const cy = crane.y - ft * 28;
          const flap = Math.sin(ft * 14) * 6;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(Math.sin(ft * 3) * .25 * crane.dir);
          ctx.strokeStyle = `rgba(220,230,245,${.7 * fade})`;
          ctx.fillStyle = `rgba(230,238,250,${.14 * fade})`;
          ctx.lineWidth = 1.2;
          const s = 14;
          ctx.beginPath();
          ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s * .8); ctx.lineTo(-s, 0);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(-s * crane.dir, -10 - flap);
          ctx.moveTo(0, 0); ctx.lineTo(s * crane.dir, -10 + flap);
          ctx.moveTo(0, 0); ctx.lineTo(0, -s * 1.7);
          ctx.moveTo(0, 0); ctx.lineTo(0, s * 1.1);
          ctx.stroke();
          ctx.restore();
          if (!crane.noteShown && ft > .8) {
            crane.noteShown = true;
            console.log(`origami: ${CRANE_NOTES[Math.random() * CRANE_NOTES.length | 0]}`);
          }
        }
      }
    }
    requestAnimationFrame(craneTick);
  }
  requestAnimationFrame(craneTick);
})();

// paper boat — a tiny folded boat sails the bottom of the page
const BOAT_NOTES = [
  "the paper boat sets out, trusting the tide",
  "somewhere, a paper boat is still sailing",
  "folded from a page of the changelog, probably",
  "the boat does not ask where the water comes from",
];
(function boatTick() {
  let boat = null, nextBoatAt = performance.now() + 20000 * (0.7 + Math.random() * 1.3);
  function drawBoat(now) {
    if (!boat && now >= nextBoatAt) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      boat = { x: dir > 0 ? -60 : innerWidth + 60, y: innerHeight - 34 - Math.random() * 26, dir, t: 0, listed: 0 };
    }
    if (boat) {
      boat.t += 1 / 60;
      boat.x += boat.dir * 0.55;
      const bob = Math.sin(boat.t * 2.2) * 3.5;
      const rock = Math.sin(boat.t * 1.3) * 0.14 + (boat.listed > 0 ? boat.listed : 0);
      if (boat.listed === 0 && Math.random() < 0.002) boat.listed = (Math.random() < 0.5 ? -1 : 1) * 0.35;
      if (boat.listed !== 0) boat.listed *= 0.999;
      const fade = boat.x < -80 || boat.x > innerWidth + 80;
      if (fade) {
        boat = null;
        nextBoatAt = now + 120000 * (0.7 + Math.random() * 0.6);
        console.log(`paper boat: ${BOAT_NOTES[Math.random() * BOAT_NOTES.length | 0]}`);
      } else {
        ctx.save();
        ctx.translate(boat.x, boat.y + bob);
        ctx.rotate(rock * boat.dir);
        ctx.strokeStyle = `rgba(225,232,245,0.8)`;
        ctx.lineWidth = 1.1;
        // hull
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(6, 5); ctx.lineTo(-6, 5);
        ctx.closePath(); ctx.stroke();
        // fold line
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -9); ctx.stroke();
        // sail
        ctx.beginPath();
        ctx.moveTo(0, -9); ctx.lineTo(7, 0); ctx.lineTo(0, 0);
        ctx.moveTo(0, -9); ctx.lineTo(-6, 0);
        ctx.stroke();
        ctx.restore();
      }
    }
    requestAnimationFrame(drawBoat);
  }
  requestAnimationFrame(drawBoat);
})();

// dandelion — a dandelion grows at a random spot, blooms into a puff, then the
// seeds tear loose in a gust and drift off-screen
const DANDELION_NOTES = [
  "make a wish before the last seed lets go",
  "the wind collects wishes it never promises to keep",
  "a dandelion forgot it was a weed",
  "seeds: extremely small, extremely ambitious",
];
(function dandelionTick() {
  let d = null, nextDAt = performance.now() + 30000 * (0.7 + Math.random() * 1.3);
  function drawDandelion(now) {
    if (!d && now >= nextDAt) {
      d = {
        x: 60 + Math.random() * (canvas.width - 120),
        y: canvas.height - 40 - Math.random() * (canvas.height * 0.35),
        t: 0, gust: 0, seeds: [], noteShown: false
      };
    }
    if (d) {
      d.t += 1 / 60;
      const grow = Math.min(1, d.t / 2.2);            // stem grows up
      const bloom = Math.max(0, Math.min(1, (d.t - 2.2) / 1.4)); // puff blooms
      const stemH = 52 * grow;
      if (d.gust === 0 && bloom >= 1 && Math.random() < 0.004) d.gust = (Math.random() < 0.5 ? 1 : -1);
      if (d.gust !== 0 && d.seeds.length === 0 && bloom >= 1) {
        // tear all seeds loose at once
        for (let i = 0; i < 14; i++) {
          const ang = Math.PI * 2 * i / 14;
          d.seeds.push({ ang, dist: 0, vy: 0.2 + Math.random() * 0.4, sway: Math.random() * Math.PI * 2, drift: d.gust * (0.3 + Math.random() * 0.5) });
        }
        d.gone = 0;
      }
      if (d.seeds.length) {
        let allGone = true;
        for (const s of d.seeds) {
          s.dist += 0.8 + s.vy; s.sway += 0.06; s.drift *= 1.004;
          const sx = d.x + Math.cos(s.ang) * (6 + s.dist * 0.4) + Math.sin(s.sway) * 10 * s.drift;
          const sy = d.y - stemH - Math.sin(s.ang) * (6 + s.dist * 0.4) - s.dist * 0.5 + Math.sin(s.sway) * 6;
          if (sx > -30 && sx < canvas.width + 30 && sy > -30) {
            allGone = false;
            ctx.strokeStyle = `rgba(230,235,245,${Math.max(0, 0.7 - s.dist / 160)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + 7); ctx.stroke();
            ctx.beginPath();
            for (let k = -1; k <= 1; k++) { ctx.moveTo(sx, sy + 7); ctx.lineTo(sx + k * 3, sy + 11); }
            ctx.stroke();
          }
        }
        if (allGone) {
          d = null;
          nextDAt = now + 150000 * (0.7 + Math.random() * 0.6);
          console.log(`dandelion: ${DANDELION_NOTES[Math.random() * DANDELION_NOTES.length | 0]}`);
        }
      } else {
        // stem + leaves
        ctx.strokeStyle = `rgba(200,220,200,${0.5 * grow + 0.2 * bloom})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.quadraticCurveTo(d.x + Math.sin(d.t * 0.8) * 4, d.y - stemH * 0.6, d.x + Math.sin(d.t * 0.6) * 6, d.y - stemH);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(d.x, d.y - stemH * 0.35); ctx.lineTo(d.x - 8 * grow, d.y - stemH * 0.3);
        ctx.moveTo(d.x, d.y - stemH * 0.5); ctx.lineTo(d.x + 7 * grow, d.y - stemH * 0.45);
        ctx.stroke();
        if (bloom > 0) {
          // puff of seeds on a head
          const hx = d.x + Math.sin(d.t * 0.6) * 6, hy = d.y - stemH - 5 * bloom;
          ctx.strokeStyle = `rgba(235,238,248,${0.75 * bloom})`;
          ctx.fillStyle = `rgba(240,242,250,${0.15 * bloom})`;
          ctx.beginPath(); ctx.arc(hx, hy, 7 * bloom, 0, Math.PI * 2); ctx.fill();
          for (let i = 0; i < 14; i++) {
            const ang = Math.PI * 2 * i / 14 + d.t * 0.05;
            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(hx + Math.cos(ang) * 7 * bloom, hy + Math.sin(ang) * 7 * bloom);
            ctx.stroke();
          }
          if (!d.noteShown && bloom > 0.6) {
            d.noteShown = true;
            console.log("dandelion: the head is full — waiting on a gust");
          }
        }
      }
    }
    requestAnimationFrame(drawDandelion);
  }
  requestAnimationFrame(drawDandelion);
})();

// fireflies — a small swarm congregates at a random spot, blinks in slow
// out-of-sync lantern pulses, then scatters back into the dark
const FIREFLY_NOTES = [
  "the fireflies are voting on something",
  "a lantern that licenses itself",
  "the dark keeps a few spare stars",
  "fireflies: tiny, seasonal, unbothered",
];
(function fireflyTick() {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let swarm = null, nextSwarmAt = performance.now() + 25000 * (0.7 + Math.random() * 1.3);
  function drawFireflies(now) {
    if (!swarm && now >= nextSwarmAt) {
      const cx = 80 + Math.random() * (canvas.width - 160);
      const cy = 80 + Math.random() * (canvas.height - 160);
      swarm = { cx, cy, t: 0, flies: [], noteShown: false };
      for (let i = 0; i < 14 + Math.floor(Math.random() * 8); i++) {
        swarm.flies.push({
          ang: Math.random() * Math.PI * 2,
          r: 10 + Math.random() * 55,
          phase: Math.random() * Math.PI * 2,
          speed: 0.7 + Math.random() * 1.1,
          orbit: 0.4 + Math.random() * 0.9,
        });
      }
    }
    if (swarm) {
      swarm.t += 1 / 60;
      const gather = Math.min(1, swarm.t / 2.5);   // flies drift in
      const fade = Math.max(0, (swarm.t - 9) / 1.5); // then scatter
      let allGone = true;
      ctx.save();
      for (const f of swarm.flies) {
        f.phase += f.speed / 60;
        const r = f.r * (1.3 - gather * 0.3) * (1 + fade * 2.2);
        const ang = f.ang + swarm.t * f.orbit * 0.25;
        const x = swarm.cx + Math.cos(ang) * r + Math.sin(f.phase * 1.7) * 6;
        const y = swarm.cy + Math.sin(ang) * r * 0.8 + Math.cos(f.phase * 2.1) * 6;
        const blink = 0.5 + 0.5 * Math.sin(f.phase * 2.4); // out-of-sync pulses
        const glow = blink * gather * (1 - fade);
        if (glow > 0.02) {
          allGone = false;
          ctx.globalAlpha = glow * 0.9;
          ctx.fillStyle = "#d8ffa0";
          ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = glow * 0.22;
          ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
      if (!swarm.noteShown && gather >= 1) {
        swarm.noteShown = true;
        console.log(`fireflies: ${FIREFLY_NOTES[Math.random() * FIREFLY_NOTES.length | 0]}`);
      }
      if (fade >= 1) {
        swarm = null;
        nextSwarmAt = now + 150000 * (0.7 + Math.random() * 0.6);
      }
    }
    requestAnimationFrame(drawFireflies);
  }
  requestAnimationFrame(drawFireflies);
})();
// aurora borealis — every ~2-4 min soft curtains of northern lights ripple
// across the upper sky: wavy bands of green and violet light sway and breathe,
// then dissolve into the dark like the ionosphere was never charged
const AURORA_NOTES = [
  "aurora: solar wind paid a visit",
  "the ionosphere is showing off again",
  "aurora seen, 3 witnesses, all particles",
  "the sky just flexed, quietly",
];
(function auroraTick() {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let curtain = null, nextCurtainAt = performance.now() + 120000 * (0.7 + Math.random() * 1.3);
  function drawAurora(now) {
    if (!curtain && now >= nextCurtainAt) {
      const cx = canvas.width * (0.25 + Math.random() * 0.5);
      curtain = { cx, t: 0, hue: 120 + Math.random() * 90 }; // green through teal to violet
      curtain.bands = Array.from({ length: 5 + Math.floor(Math.random() * 4) }, () => ({
        yBase: 60 + Math.random() * 120,
        width: 140 + Math.random() * 200,
        phase: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.4,
        alpha: 0.06 + Math.random() * 0.08,
      }));
    }
    if (curtain) {
      curtain.t += 1 / 60;
      const t = curtain.t;
      const rise = Math.min(1, t / 3);              // curtains fade in
      const fade = Math.max(0, (t - 14) / 3);       // then dissolve
      const glow = rise * (1 - fade);
      if (glow > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const b of curtain.bands) {
          const sway = Math.sin(t * b.speed + b.phase) * 30;
          const breathe = 1 + Math.sin(t * b.speed * 0.7 + b.phase) * 0.12;
          const w = b.width * breathe;
          const g = ctx.createRadialGradient(curtain.cx + sway, b.yBase, 0, curtain.cx + sway, b.yBase, w);
          const h = curtain.hue + (b.phase * 20);
          g.addColorStop(0, `hsla(${h}, 80%, 60%, ${b.alpha * glow * 2})`);
          g.addColorStop(1, "hsla(0, 0%, 0%, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(curtain.cx + sway, b.yBase, w, w * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (!curtain.noteShown && fade > 0.4) {
        curtain.noteShown = true;
        console.log(`aurora: ${AURORA_NOTES[Math.random() * AURORA_NOTES.length | 0]}`);
      }
      if (fade >= 1) {
        curtain = null;
        nextCurtainAt = now + 150000 * (0.7 + Math.random() * 0.6);
      }
    }
    requestAnimationFrame(drawAurora);
  }
  requestAnimationFrame(drawAurora);
})();

// satellite — every ~2-4 min a tiny satellite crosses the upper sky,
// beacon blinking, then slips past the far edge like the orbit was never there
(function satellite() {
  function pass() {
    setTimeout(pass, 120000 + Math.random() * 120000);
    if (document.hidden) return;
    const sky = document.createElement("div");
    sky.className = "satellite";
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y = 4 + Math.random() * 14; // vh, high sky band
    const dur = 24000 + Math.random() * 8000; // slow, deliberate pass
    sky.style.setProperty("--sa-y", y.toFixed(1) + "vh");
    sky.style.setProperty("--sa-dur", dur.toFixed(0) + "ms");
    sky.style.setProperty("--sa-drift", (Math.random() * 4 - 2).toFixed(1) + "vh");
    const body = document.createElement("span");
    body.className = "sat-body";
    const panel = document.createElement("span");
    panel.className = "sat-panel";
    const beacon = document.createElement("span");
    beacon.className = "sat-beacon";
    body.appendChild(panel);
    body.appendChild(beacon);
    sky.appendChild(body);
    if (dir < 0) sky.classList.add("sat-rev");
    document.body.appendChild(sky);
    setTimeout(() => sky.remove(), dur + 1500);
  }
  setTimeout(pass, 45000 + Math.random() * 60000);
})();

// kite — every ~2-4 min a small diamond kite with a fluttering ribbon tail
// glides across the upper sky, bobbing and tilting on the breeze, then
// drifts off-screen like the wind was never there
// paper lantern — every ~2-4 min a glowing paper lantern lifts off from the
// bottom of the page and drifts upward on the warm air, swaying as it rises,
// flickering, then guttering out mid-sky like the wish was never made
(function paperLantern() {
  function launch() {
    const el = document.createElement("div");
    el.className = "paper-lantern";
    el.innerHTML = `<div class="lantern-body"></div><div class="lantern-flame"></div>`;
    el.style.left = (8 + Math.random() * 84) + "vw";
    const hue = (Math.random() * 40 - 15).toFixed(0) + "deg";
    document.body.appendChild(el);
    const dur = 22000 + Math.random() * 12000;
    const drift = (Math.random() - .5) * 24;  // sideways wander, vw
    const sway = 3 + Math.random() * 4;       // bob amplitude, vw
    const start = performance.now();
    (function tick(now) {
      const t = (now - start) / dur;
      if (t >= 1) { el.remove(); return; }
      const x = drift * t + Math.sin(t * Math.PI * 5) * sway * (1 - t * .6);
      const y = -(110 * Math.pow(t, 1.15));     // slows slightly as air cools
      const flicker = .75 + Math.sin(now * .012 + t * 9) * .2 + Math.random() * .05;
      el.style.opacity = (t > .82 ? (1 - (t - .82) / .18) : 1).toFixed(2);
      el.style.transform = `translate(${x.toFixed(2)}vw, ${y.toFixed(1)}vh) rotate(${(x * .6).toFixed(1)}deg)`;
      el.style.filter = `hue-rotate(${hue}) brightness(${flicker.toFixed(2)})`;
      requestAnimationFrame(tick);
    })(start);
    setTimeout(launch, 120000 + Math.random() * 120000);
  }
  setTimeout(launch, 20000 + Math.random() * 30000);
})();

(function kite() {
  const sky = document.createElement("div");
  sky.className = "kite";
  document.body.appendChild(sky);
  function fly() {
    if (!document.hidden) {
      const el = document.createElement("div");
      el.className = "kite-flight";
      const dir = Math.random() < 0.5 ? 1 : -1;
      const y = 8 + Math.random() * 22; // vh, upper sky band
      const dur = 14000 + Math.random() * 6000;
      el.style.setProperty("--kt-y", y.toFixed(1) + "vh");
      el.style.setProperty("--kt-dur", dur.toFixed(0) + "ms");
      const body = document.createElement("span");
      body.className = "kite-body";
      const tail = document.createElement("span");
      tail.className = "kite-tail";
      const segs = [];
      for (let i = 0; i < 5; i++) {
        const s = document.createElement("i");
        s.className = "kite-seg";
        s.style.setProperty("--kt-i", i);
        tail.appendChild(s);
        segs.push(s);
      }
      el.appendChild(body);
      el.appendChild(tail);
      if (dir < 0) el.classList.add("kite-rev");
      sky.appendChild(el);
      const drift = Math.random() * 8 - 4; // extra vh of vertical wander
      el.style.setProperty("--kt-drift", drift.toFixed(1) + "vh");
      setTimeout(() => el.remove(), dur + 1500);
    }
    setTimeout(fly, 120000 + Math.random() * 120000);
  }
  setTimeout(fly, 30000 + Math.random() * 30000);
})();

// prowling shadow — every ~2-4 min a soft blurred dark shape slinks across
// the whole page on a slight diagonal, hugging the ground, then melts away
// like the shadow was never there
(function prowl() {
  function pass() {
    if (!document.hidden) {
      const el = document.createElement("div");
      el.className = "shadow-prowl";
      const dur = 9000 + Math.random() * 5000;
      el.style.setProperty("--sh-dur", dur.toFixed(0) + "ms");
      el.style.setProperty("--sh-x", (Math.random() * 30 - 10).toFixed(1) + "vw");
      el.style.setProperty("--sh-lift", (2 + Math.random() * 6).toFixed(1) + "vh");
      el.classList.add("is-running");
      document.body.appendChild(el);
      setTimeout(() => el.remove(), dur + 1500);
    }
    setTimeout(pass, 120000 + Math.random() * 120000);
  }
  setTimeout(pass, 40000 + Math.random() * 40000);
})();

// hot air balloon — every ~2-4 min a small striped hot air balloon with a
// softly glowing basket drifts slowly across the upper sky, bobbing gently
// on the breeze, then sails off-screen like the flight was never there
(function balloon() {
  function drift() {
    if (!document.hidden) {
      const el = document.createElement("div");
      el.className = "hot-air-balloon";
      const dur = 26000 + Math.random() * 12000;
      const startX = -12 + Math.random() * 20; // could start just off either edge
      const rightToLeft = Math.random() < 0.5;
      el.style.setProperty("--hab-dur", dur.toFixed(0) + "ms");
      el.style.setProperty("--hab-y", (6 + Math.random() * 14).toFixed(1) + "vh");
      el.style.setProperty("--hab-bob", (1.2 + Math.random() * 1.4).toFixed(1) + "vh");
      el.style.setProperty("--hab-scale", (0.7 + Math.random() * 0.5).toFixed(2));
      if (rightToLeft) {
        el.classList.add("rtl");
        el.style.setProperty("--hab-x0", (108 - startX) + "vw");
        el.style.setProperty("--hab-x1", (-20 - startX) + "vw");
      } else {
        el.style.setProperty("--hab-x0", (startX - 20) + "vw");
        el.style.setProperty("--hab-x1", (startX + 108) + "vw");
      }
      el.classList.add("is-running");
      document.body.appendChild(el);
      setTimeout(() => el.remove(), dur + 1500);
    }
    setTimeout(drift, 120000 + Math.random() * 120000);
  }
  setTimeout(drift, 35000 + Math.random() * 45000);
})();

// fireflies at dusk — every minute or so a small brood of fireflies blinks
// awake near the bottom of the page, wanders on flickering paths, and fades
// away like the meadow was never there
(function fireflies() {
  function brood() {
    if (!document.hidden) {
      const n = 3 + Math.floor(Math.random() * 4); // 3-6 fireflies
      for (let i = 0; i < n; i++) {
        const el = document.createElement("div");
        el.className = "firefly";
        const life = 12000 + Math.random() * 10000;
        el.style.setProperty("--ff-x", (2 + Math.random() * 96).toFixed(1) + "vw");
        el.style.setProperty("--ff-y", (3 + Math.random() * 14).toFixed(1) + "vh");
        el.style.setProperty("--ff-blink", (2 + Math.random() * 3).toFixed(1) + "s");
        el.style.setProperty("--ff-life", life.toFixed(0) + "ms");
        el.style.setProperty("--ff-dx1", (-4 + Math.random() * 8).toFixed(1) + "vw");
        el.style.setProperty("--ff-dx2", (-4 + Math.random() * 8).toFixed(1) + "vw");
        el.style.setProperty("--ff-dx3", (-3 + Math.random() * 6).toFixed(1) + "vw");
        el.style.setProperty("--ff-dy1", (-1 - Math.random() * 3).toFixed(1) + "vh");
        el.style.setProperty("--ff-dy2", (-1 - Math.random() * 3).toFixed(1) + "vh");
        el.style.setProperty("--ff-dy3", (-1 - Math.random() * 3).toFixed(1) + "vh");
        el.style.animationDelay = (Math.random() * 1500).toFixed(0) + "ms, 0ms";
        document.body.appendChild(el);
        setTimeout(() => el.remove(), life + 2000);
      }
    }
    setTimeout(brood, 60000 + Math.random() * 90000);
  }
  setTimeout(brood, 15000 + Math.random() * 20000);
})();

// school of minnows — every ~2-4 min a small school of tiny translucent fish
// swims across the lower part of the page, each minnow wobbling within the
// shoal, then the whole school slips off-screen like the pond was never there
(function minnows() {
  function swim() {
    if (!document.hidden) {
      const school = document.createElement("div");
      school.className = "minnow-school";
      const life = 22000 + Math.random() * 10000;
      const n = 5 + Math.floor(Math.random() * 5); // 5-9 minnows
      const y = 8 + Math.random() * 14;
      school.style.setProperty("--mn-y", y.toFixed(1) + "vh");
      school.style.setProperty("--mn-life", life.toFixed(0) + "ms");
      school.style.setProperty("--mn-dx", (110 + Math.random() * 15).toFixed(1) + "vw");
      school.style.setProperty("--mn-my1", (-3 + Math.random() * 6).toFixed(1) + "vh");
      school.style.setProperty("--mn-my2", (-3 + Math.random() * 6).toFixed(1) + "vh");
      for (let i = 0; i < n; i++) {
        const el = document.createElement("div");
        el.className = "minnow";
        const w = 7 + Math.random() * 6;
        el.style.setProperty("--mn-w", w.toFixed(1) + "px");
        el.style.setProperty("--mn-ox", (Math.random() * 60 - 20).toFixed(1) + "px");
        el.style.setProperty("--mn-oy", (Math.random() * 36 - 18).toFixed(1) + "px");
        el.style.setProperty("--mn-wb", (0.9 + Math.random() * 0.9).toFixed(2) + "s");
        el.style.animationDelay = (Math.random() * 800).toFixed(0) + "ms";
        school.appendChild(el);
      }
      document.body.appendChild(school);
      setTimeout(() => school.remove(), life + 1500);
    }
    setTimeout(swim, 120000 + Math.random() * 120000);
  }
  setTimeout(swim, 30000 + Math.random() * 40000);
})();

// shooting star — every few minutes a meteor flashes across the upper page,
// a bright head with a fading trail, streaking down-and-across, then gone

// firefly swarm — every few minutes a loose swarm of tiny glowing fireflies
// drifts across the page, blinking softly as they wander, then fades away
(function fireflies() {
  function swarm() {
    if (!document.hidden) {
      const count = 7 + Math.floor(Math.random() * 6);
      const x0 = -10 + Math.random() * 20; // % from left edge
      const y0 = 15 + Math.random() * 65;  // % from top
      for (let i = 0; i < count; i++) {
        const el = document.createElement("div");
        el.className = "firefly";
        const life = 9000 + Math.random() * 7000;
        const delay = Math.random() * 4000;
        el.style.setProperty("--ff-x0", (x0 + Math.random() * 8).toFixed(1) + "vw");
        el.style.setProperty("--ff-y0", (y0 + Math.random() * 8).toFixed(1) + "vh");
        el.style.setProperty("--ff-x1", (x0 + 35 + Math.random() * 30).toFixed(1) + "vw");
        el.style.setProperty("--ff-y1", (y0 + (Math.random() * 24 - 12)).toFixed(1) + "vh");
        el.style.setProperty("--ff-life", life.toFixed(0) + "ms");
        el.style.setProperty("--ff-blink", (1200 + Math.random() * 1600).toFixed(0) + "ms");
        el.style.animationDelay = delay.toFixed(0) + "ms, 0ms";
        document.body.appendChild(el);
        setTimeout(() => el.remove(), life + delay + 500);
      }
    }
    setTimeout(swarm, 180000 + Math.random() * 240000);
  }
  setTimeout(swarm, 20000 + Math.random() * 30000);
})();
(function meteor() {
  function fly() {
    if (!document.hidden) {
      const el = document.createElement("div");
      el.className = "meteor";
      const life = 1300 + Math.random() * 700;
      const ang = 14 + Math.random() * 18; // downward slope, degrees
      const dist = 45 + Math.random() * 35; // travel distance, vw
      el.style.setProperty("--mt-x0", (-8 + Math.random() * 40).toFixed(1) + "vw");
      el.style.setProperty("--mt-y0", (2 + Math.random() * 12).toFixed(1) + "vh");
      el.style.setProperty("--mt-life", life.toFixed(0) + "ms");
      el.style.setProperty("--mt-ang", ang.toFixed(1) + "deg");
      el.style.setProperty("--mt-tail", (60 + Math.random() * 70).toFixed(0) + "px");
      el.style.setProperty("--mt-dx", dist.toFixed(1) + "vw");
      el.style.setProperty("--mt-dy", (dist * Math.tan(ang * Math.PI / 180)).toFixed(1) + "vh");
      document.body.appendChild(el);
      setTimeout(() => el.remove(), life + 500);
    }
    setTimeout(fly, 180000 + Math.random() * 240000);
  }
  setTimeout(fly, 25000 + Math.random() * 30000);
})();


// soap bubbles — every ~2-4 min a loose cluster of iridescent bubbles floats
// up from the bottom edge, wobbling on invisible soap-film winds, then pops
// apart into nothing like the bath was never run
(function soapBubbles() {
  function floatUp() {
    if (document.hidden) { setTimeout(floatUp, 120000 + Math.random() * 120000); return; }
    const count = 4 + Math.random() * 4 | 0;
    const bx = 10 + Math.random() * 80;                 // cluster base, vw
    const bubbles = [];
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "soap-bubble";
      const size = 14 + Math.random() * 30;             // px diameter
      const rise = 30 + Math.random() * 45;             // vh travelled
      const dur = 9000 + Math.random() * 7000;
      const start = performance.now() + i * (500 + Math.random() * 900);
      document.body.appendChild(el);
      bubbles.push({ el, size, rise, dur, start,
        x0: bx + (Math.random() - .5) * 14,             // vw
        y0: 104,                                        // start below the edge
        sway: 3 + Math.random() * 5,                    // sway amplitude, vw
        swayHz: .35 + Math.random() * .45,
        popT: .75 + Math.random() * .2,                 // when it pops, fraction
        popped: false });
    }
    (function step(now) {
      let alive = false;
      for (const b of bubbles) {
        if (!b.el.isConnected) continue;
        const t = (now - b.start) / b.dur;
        if (t < 0) { alive = true; continue; }
        if (t >= 1 || (t >= b.popT && b.popped)) { b.el.remove(); continue; }
        alive = true;
        const x = b.x0 + Math.sin(t * Math.PI * 2 * b.swayHz) * b.sway;
        const y = b.y0 - b.rise * t;
        const wob = Math.sin(now * .003 + b.size) * 6;
        b.el.style.width = b.el.style.height = b.size + "px";
        b.el.style.transform =
          `translate(${(x * innerWidth / 100 + wob).toFixed(1)}px, ${(y * innerHeight / 100).toFixed(1)}px)`;
        b.el.style.opacity = String(Math.min(1, t * 5) * (1 - Math.max(0, (t - b.popT) / (1 - b.popT))));
        if (t >= b.popT && !b.popped) {
          b.popped = true;
          b.el.classList.add("pop");
        }
      }
      if (alive) { requestAnimationFrame(step); return; }
      setTimeout(floatUp, 120000 + Math.random() * 120000);
    })(performance.now());
  }
  setTimeout(floatUp, 25000 + Math.random() * 30000);
})();

// tea steam — every ~2-4 min a small steaming teacup settles near the bottom
// of the page, curling wisps of steam rise off it and dissolve, then the cup
// lifts away like the tea was never poured
(function teaSteam() {
  function pour() {
    if (document.hidden) { setTimeout(pour, 120000 + Math.random() * 120000); return; }
    const el = document.createElement("div");
    el.className = "tea-cup";
    el.textContent = "🍵";
    document.body.appendChild(el);
    const x = innerWidth * (.12 + Math.random() * .76);
    const y = innerHeight - 60 - Math.random() * 40;
    const stay = 14000 + Math.random() * 8000;      // how long the cup sits
    const start = performance.now();
    let lastWisp = 0;
    (function step(now) {
      const t = (now - start) / stay;
      if (t >= 1) {
        el.remove();
        setTimeout(pour, 120000 + Math.random() * 120000);
        return;
      }
      const settle = Math.min(1, t * 8) * 14;       // drops in, floats a little
      el.style.transform = `translate(${x.toFixed(1)}px, ${(y + settle).toFixed(1)}px)`;
      el.style.opacity = String(.9 * Math.min(1, t * 6) * (1 - Math.max(0, (t - .9) * 10)));
      // curling steam wisps rise off the cup and dissolve
      if (now - lastWisp > 420 + Math.random() * 300) {
        lastWisp = now;
        const s = document.createElement("span");
        s.className = "tea-steam";
        s.textContent = "～";
        s.style.left = (x + 8 + (Math.random() - .5) * 16) + "px";
        s.style.top = (y - 6) + "px";
        s.style.setProperty("--steam-dx", ((Math.random() - .5) * 40).toFixed(0) + "px");
        s.style.setProperty("--steam-dur", (2600 + Math.random() * 1800).toFixed(0) + "ms");
        document.body.appendChild(s);
        setTimeout(() => s.remove(), 4500);
      }
      requestAnimationFrame(step);
    })(start);
  }
  setTimeout(pour, 25000 + Math.random() * 30000);
})();

// paper boat — every ~2-4 min a small origami paper boat bobs along the very
// bottom of the page, rocking on invisible gentle waves while a faint ripple
// spreads out behind it, then it drifts off the far edge like the paper pond
// was never there.
(function paperBoat() {
  const HULL = ["  __|__", " \\____/", "‾‾‾‾‾‾‾"];
  function launch() {
    if (document.hidden) { setTimeout(launch, 120000 + Math.random() * 120000); return; }
    const el = document.createElement("pre");
    el.className = "paper-boat";
    el.textContent = HULL.join("\n");
    document.body.appendChild(el);
    const dir = Math.random() < .5 ? 1 : -1;
    const speed = 26 + Math.random() * 20;   // px per second — a lazy current
    const y = innerHeight - 50 - Math.random() * 18;
    const start = performance.now();
    const dur = (innerWidth + 220) / speed * 1000;
    let lastRipple = 0;
    (function step(now) {
      const t = (now - start) / 1000;
      const x = dir > 0 ? -110 + t * speed : innerWidth + 80 - t * speed;
      // gentle rocking: roll and bob on the invisible waves
      const roll = Math.sin(t * 1.8) * 6;
      const bob = Math.sin(t * 2.6) * 2.5;
      el.style.transform =
        `translate(${x.toFixed(1)}px, ${(y + bob).toFixed(1)}px) scaleX(${dir}) rotate(${roll.toFixed(2)}deg)`;
      // a faint ripple drifts out behind the hull every so often
      if (now - lastRipple > 700 + Math.random() * 500) {
        lastRipple = now;
        const r = document.createElement("span");
        r.className = "boat-ripple";
        r.textContent = "˜";
        r.style.left = (x + (dir > 0 ? -10 : 26)) + "px";
        r.style.top = (y + 12) + "px";
        document.body.appendChild(r);
        requestAnimationFrame(() => r.classList.add("spread"));
        setTimeout(() => r.remove(), 3600);
      }
      if (x > -140 && x < innerWidth + 60) requestAnimationFrame(step);
      else el.remove();
    })(start);
    setTimeout(launch, 150000 + Math.random() * 90000);
  }
  setTimeout(launch, 40000 + Math.random() * 40000);
})();

// paper airplane — every ~2-4 min a small paper plane swoops across the page
// along a gentle lazy arc, a dotted trail fading out behind it, then it slides
// off the far edge like the flight was never logged.
(function paperPlane() {
  const PLANE = "—·—●>";
  const PLANE_NOTES = [
    "a paper plane folded itself out of a stack of TODOs",
    "the plane takes the long way around, on purpose",
    "logged nowhere, remembered by no one",
    "somewhere, a paper plane is still gliding",
  ];
  function launch() {
    if (document.hidden) { setTimeout(launch, 120000 + Math.random() * 120000); return; }
    const el = document.createElement("pre");
    el.className = "paper-plane";
    el.textContent = PLANE;
    document.body.appendChild(el);
    const dir = Math.random() < .5 ? 1 : -1;
    const speed = 60 + Math.random() * 30;   // px per second — a lazy glide
    const y0 = 90 + Math.random() * (innerHeight * .45);
    const arc = 70 + Math.random() * 90;     // swoop depth
    const start = performance.now();
    const dur = (innerWidth + 160) / speed * 1000;
    let lastDot = 0;
    (function step(now) {
      const t = (now - start) / 1000;
      const p = t * speed;
      const x = dir > 0 ? -40 + p : innerWidth + 40 - p;
      const mid = innerWidth / 2;
      const sway = 1 - Math.min(1, Math.abs(x - mid) / (innerWidth / 2 + 1));
      const y = y0 + Math.sin(t * 1.4) * arc * sway;
      const tilt = Math.cos(t * 1.4) * 14 * sway;
      el.style.transform =
        `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scaleX(${dir}) rotate(${(tilt * dir).toFixed(2)}deg)`;
      // a dotted trail drifts out behind the fold every so often
      if (now - lastDot > 220 + Math.random() * 180) {
        lastDot = now;
        const d = document.createElement("span");
        d.className = "plane-trail";
        d.textContent = Math.random() < .5 ? "·" : "˙";
        d.style.left = (x + (dir > 0 ? -14 : 20)) + "px";
        d.style.top = (y + 6) + "px";
        document.body.appendChild(d);
        requestAnimationFrame(() => (d.style.opacity = "0"));
        setTimeout(() => d.remove(), 3000);
      }
      if (x > -80 && x < innerWidth + 60) requestAnimationFrame(step);
      else {
        el.remove();
        console.log(`paper plane: ${PLANE_NOTES[Math.random() * PLANE_NOTES.length | 0]}`);
      }
    })(start);
    setTimeout(launch, 150000 + Math.random() * 90000);
  }
  setTimeout(launch, 40000 + Math.random() * 40000);
})();

// dragonfly — every ~2-4 min an ASCII dragonfly darts across the page in
// quick zigzags, hovers in place for a moment as if considering the cursor,
// then zips off the far edge like the pond was never there.
(function dragonflyDart() {
  const FLY = "<●≡≡≡>";
  const FLY_NOTES = [
    "a dragonfly inspected the backlog and approved",
    "it hovered exactly where the bug used to be",
    "dragonflies see in every direction; the site ships anyway",
    "it was gone before the stack trace finished printing",
  ];
  function dart() {
    if (document.hidden) { setTimeout(dart, 120000 + Math.random() * 120000); return; }
    const el = document.createElement("pre");
    el.className = "dragonfly";
    el.textContent = FLY;
    document.body.appendChild(el);
    const dir = Math.random() < .5 ? 1 : -1;
    const y0 = 60 + Math.random() * (innerHeight * .5);
    const zig = 40 + Math.random() * 50;         // zigzag depth
    const dashSpeed = 260 + Math.random() * 90;  // px per second — a dart
    const startX = dir > 0 ? -50 : innerWidth + 50;
    const hoverX = startX + dir * (innerWidth * (.35 + Math.random() * .3));
    const start = performance.now();
    let phase = "in", hoverAt = 0, off = false;
    (function step(now) {
      let x, y, wob = 0;
      if (phase === "in") {
        const t = (now - start) / 1000;
        x = startX + dir * dashSpeed * t;
        y = y0 + Math.sin(t * 11) * zig;
        if (dir > 0 ? x >= hoverX : x <= hoverX) { phase = "hover"; hoverAt = now; x = hoverX; }
      } else if (phase === "hover") {
        x = hoverX;
        y = y0 + Math.sin((now - hoverAt) / 1000 * 7) * 5;  // tiny hover bob
        if (now - hoverAt > 1600 + Math.random() * 1200) { phase = "out"; hoverAt = now; }
      } else {
        if (!off) { off = true; hoverAt = now; }
        const t = (now - hoverAt) / 1000;
        x = hoverX + dir * dashSpeed * t;
        y = y0 - Math.sin(t * 9) * 20 - t * 26;  // lifts away as it goes
        wob = Math.sin(t * 30) * 1.5;
      }
      el.style.transform =
        `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scaleX(${dir}) rotate(${wob.toFixed(2)}deg)`;
      const gone = dir > 0 ? x > innerWidth + 80 : x < -80;
      if (!gone) requestAnimationFrame(step);
      else {
        el.remove();
        console.log(`dragonfly: ${FLY_NOTES[Math.random() * FLY_NOTES.length | 0]}`);
      }
    })(start);
    setTimeout(dart, 150000 + Math.random() * 90000);
  }
  setTimeout(dart, 40000 + Math.random() * 40000);
})();

// tumbleweed — every ~2-4 min a scraggly tumbleweed bounces in from one edge
// of the page and rolls across it, shedding the odd dry bit as it goes, then
// tumbles off the far edge like the desert was never there
(function tumbleweedRoll() {
  const BITS = "·˙*,:";
  function roll() {
    const el = document.createElement("pre");
    el.className = "tumbleweed";
    el.textContent = "{✳}";
    document.body.appendChild(el);
    const dir = Math.random() < .5 ? 1 : -1;
    const y0 = innerHeight - 60 - Math.random() * 60;
    const speed = 130 + Math.random() * 70;      // px per second
    const dur = (innerWidth + 200) / speed * 1000;
    const start = performance.now();
    let lastBit = 0;
    (function step(now) {
      const t = (now - start) / 1000;
      // bouncing: a few damped hops along the way
      const hopPhase = t * 1.7;
      const px = dir > 0 ? -80 + t * speed : innerWidth + 80 - t * speed;
      const py = y0 - Math.abs(Math.sin(hopPhase * Math.PI)) * 26;
      const spin = t * speed / 14 * 360 * (dir > 0 ? 1 : -1);
      el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) rotate(${spin.toFixed(1)}deg)`;
      // sheds a dry bit every so often
      if (now - lastBit > 420) {
        lastBit = now;
        const s = document.createElement("span");
        s.className = "tumbleweed-bit";
        s.textContent = BITS[Math.random() * BITS.length | 0];
        s.style.left = px + "px";
        s.style.top = (py + 14) + "px";
        document.body.appendChild(s);
        requestAnimationFrame(() => s.classList.add("fade"));
        setTimeout(() => s.remove(), 3800);
      }
      if (t * 1000 < dur) requestAnimationFrame(step);
      else {
        el.remove();
        console.log("tumbleweed: rolls on, unbothered");
        setTimeout(roll, 150000 + Math.random() * 90000);
      }
    })(start);
  }
  setTimeout(roll, 30000 + Math.random() * 40000);
})();

// shooting star — every ~2-5 min a shooting star streaks diagonally across
// the page, a bright line with a fading trail, gone before it leaves the sky
(function shootingStar() {
  function streak() {
    const star = document.createElement("div");
    star.className = "shooting-star";
    const glow = document.createElement("div");
    glow.className = "shooting-star-glow";
    document.body.appendChild(star);
    document.body.appendChild(glow);
    // random start in the upper half, heading diagonally down
    const x0 = innerWidth * (.1 + Math.random() * .7);
    const y0 = innerHeight * (.05 + Math.random() * .3);
    const angle = (20 + Math.random() * 25) * Math.PI / 180 * (Math.random() < .5 ? 1 : -1);
    const dir = angle >= 0 ? 1 : -1;
    const speed = 420 + Math.random() * 260;   // px per second
    const dur = (900 + Math.random() * 600) / speed * 1000;
    const fadeAt = dur * .75;
    const start = performance.now();
    (function step(now) {
      const t = (now - start) / 1000;
      const px = x0 + dir * t * speed;
      const py = y0 + Math.abs(angle) * t * speed;
      star.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) rotate(${dir * Math.abs(angle)}rad)`;
      glow.style.transform = `translate(${(px + dir * 90 - 2).toFixed(1)}px, ${(py + 90 * Math.abs(angle) - 2).toFixed(1)}px)`;
      if (now - start > fadeAt) {
        star.classList.add("fading");
        glow.classList.add("fading");
      }
      if (t * 1000 < dur) requestAnimationFrame(step);
      else {
        star.remove();
        glow.remove();
        console.log("shooting star: wish fast");
        setTimeout(streak, 120000 + Math.random() * 180000);
      }
    })(start);
  }
  setTimeout(streak, 40000 + Math.random() * 50000);
})();

// aurora — every ~2-4 min soft bands of green/teal aurora light wave across
// the upper part of the page for a few seconds, then dissolve back into the
// night sky
(function aurora() {
  let show = null, nextAt = performance.now() + 90000 * (0.7 + Math.random() * 0.6);
  const BANDS = 3;
  function auroraTick(now) {
    if (!show && now >= nextAt) {
      show = { start: now, dur: 6000 + Math.random() * 4000, hues: [120 + Math.random() * 60, 160 + Math.random() * 40, 90 + Math.random() * 50] };
    }
    if (show) {
      const t = (now - show.start) / show.dur;
      if (t >= 1) {
        show = null;
        nextAt = now + 150000 * (0.7 + Math.random() * 0.6);
        console.log("aurora: the sky exhales");
      } else {
        // envelope: ease in, ease out
        const env = Math.sin(t * Math.PI) ** 1.5;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let b = 0; b < BANDS; b++) {
          const hue = show.hues[b];
          const yBase = innerHeight * (0.08 + b * 0.09);
          const amp = 14 + b * 8;
          const speed = 0.00035 + b * 0.00015;
          const thick = 46 + b * 18;
          ctx.beginPath();
          for (let x = 0; x <= innerWidth; x += 24) {
            const y = yBase + Math.sin(x * 0.004 + now * speed + b * 2) * amp
              + Math.sin(x * 0.011 - now * speed * 1.7 + b) * amp * 0.4;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          const grad = ctx.createLinearGradient(0, yBase - thick, 0, yBase + thick * 1.6);
          grad.addColorStop(0, `hsla(${hue},80%,60%,0)`);
          grad.addColorStop(0.5, `hsla(${hue},80%,60%,${0.10 * env})`);
          grad.addColorStop(1, `hsla(${hue},80%,60%,0)`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = thick * 2;
          ctx.lineCap = "round";
          ctx.stroke();
          // brighter curtain edge along the band
          ctx.beginPath();
          for (let x = 0; x <= innerWidth; x += 12) {
            const y = yBase + Math.sin(x * 0.004 + now * speed + b * 2) * amp
              + Math.sin(x * 0.011 - now * speed * 1.7 + b) * amp * 0.4;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `hsla(${hue},90%,75%,${0.22 * env})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    requestAnimationFrame(auroraTick);
  }
  requestAnimationFrame(auroraTick);
})();

// radio telescope — every ~2-3 min a small dish rises from the bottom edge,
// slowly rotates to scan a swath of sky with a faint signal beam arc, then
// retracts back down like it never listened
(function radioTelescope() {
  let scan = null; // { x, y, rise, riseDir, angle, dir, life }
  function listen() {
    scan = {
      x: 80 + Math.random() * (innerWidth - 160),
      y: innerHeight + 60,
      rise: 0, riseDir: 1, // 0→1 rises, hold, 1→0 retracts
      angle: Math.PI * 1.15 + Math.random() * Math.PI * .2, // start pointing up-left
      dir: Math.random() < .5 ? 1 : -1,
      phase: 0
    };
    setTimeout(() => console.log("telescope log: scanning quiet sector — nothing but stars"), 3200);
    requestAnimationFrame(scanTick);
  }
  function scanTick(now) {
    const s = scan;
    if (!s) return;
    if (s.riseDir === 1) {
      s.rise = Math.min(1, s.rise + .008); // ~2s to surface
      if (s.rise >= 1) s.riseDir = 0;
    } else if (s.phase > 1) {
      s.rise = Math.max(0, s.rise - .008); // retract
      if (s.rise <= 0) { scan = null; setTimeout(listen, 130000 + Math.random() * 70000); return; }
    }
    if (s.rise >= 1) s.phase += .0035; // scan while fully raised
    // slow rotation across a swath of sky
    s.angle += s.dir * .0035;
    const y = innerHeight + 60 - s.rise * 110; // dish pokes up from the bottom
    const r = 46, tilt = s.angle;
    // pedestal + mast
    ctx.fillStyle = "rgba(124,252,156,.5)";
    ctx.fillRect(s.x - 3, y, 6, innerHeight - y);
    ctx.fillRect(s.x - 10, y + 26, 20, 5);
    // the dish: an open arc aimed along the tilt
    ctx.save();
    ctx.translate(s.x, y + 10);
    ctx.rotate(tilt - Math.PI / 2);
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI * .65, Math.PI * 1.35);
    ctx.fillStyle = "rgba(30,60,40,.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(124,252,156,.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
    // feed arm poking out of the dish
    ctx.beginPath();
    ctx.moveTo(0, -r * .2); ctx.lineTo(0, -r * .75);
    ctx.strokeStyle = "rgba(124,252,156,.6)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    // signal beam — a faint wedge of sky the dish is currently listening to
    if (s.rise >= 1 && s.phase > 0) {
      const beamLife = Math.min(1, s.phase * 4, (1 - s.phase) * 3);
      if (beamLife > 0) {
        const bx = s.x + Math.cos(tilt) * r * 1.4, by = y + 10 + Math.sin(tilt) * r * 1.4;
        const len = innerHeight * .42;
        const grad = ctx.createLinearGradient(bx, by, bx + Math.cos(tilt) * len, by + Math.sin(tilt) * len);
        grad.addColorStop(0, `rgba(124,252,156,${.18 * beamLife})`);
        grad.addColorStop(1, "rgba(124,252,156,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(tilt - .12) * len, by + Math.sin(tilt - .12) * len);
        ctx.lineTo(bx + Math.cos(tilt + .12) * len, by + Math.sin(tilt + .12) * len);
        ctx.closePath();
        ctx.fill();
        // the wavefront: a couple of arcs drifting outward along the beam
        for (let k = 0; k < 3; k++) {
          const d = ((now * .08 + k * 90) % 260);
          ctx.beginPath();
          ctx.arc(bx + Math.cos(tilt) * (r + d), by + Math.sin(tilt) * (r + d), 14 + d * .25, tilt - .18, tilt + .18);
          ctx.strokeStyle = `rgba(124,252,156,${.25 * beamLife * (1 - d / 260)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(scanTick);
  }
  setTimeout(listen, 40000 + Math.random() * 50000);
})();

// weather balloon — every ~2-4 min a small probe balloon inflates and lifts
// off from the bottom edge, drifts diagonally up across the sky on the wind
// with a gentle wobble, then fades away near the top like it never measured
(function weatherBalloon() {
  let flight = null; // { x, y, vx, wind, t, seed }
  function launch() {
    flight = {
      x: 40 + Math.random() * (innerWidth - 80),
      y: innerHeight + 90,
      wind: (Math.random() < .5 ? 1 : -1) * (.35 + Math.random() * .5),
      t: 0,
      seed: Math.random() * 10
    };
    setTimeout(() => console.log("balloon telemetry: 1013 hPa, ascending normally"), 4500);
    requestAnimationFrame(balloonTick);
  }
  function balloonTick(now) {
    const f = flight;
    if (!f) return;
    f.t += 1 / 60;
    // slow ascent with a lazy sideways drift
    f.y -= 0.9;
    f.x += f.wind + Math.sin(now * .0012 + f.seed) * .3;
    // gentle wobble like the wind is arguing with itself
    const wob = Math.sin(now * .002 + f.seed) * 6;
    const aboveScreen = f.y < -60;
    const fade = Math.min(1, f.t * 2, Math.max(0, (f.y + 60) / 160)); // inflate at start, fade near the top
    if (aboveScreen || fade <= 0) {
      flight = null;
      setTimeout(launch, 130000 + Math.random() * 110000);
      return;
    }
    const by = f.y, bx = f.x + wob;
    // the balloon: a slightly squashed translucent circle
    ctx.save();
    ctx.globalAlpha = fade;
    const grad = ctx.createLinearGradient(bx - 16, by - 16, bx + 16, by + 16);
    grad.addColorStop(0, "rgba(200,230,255,.5)");
    grad.addColorStop(1, "rgba(120,160,200,.25)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(bx, by, 17, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(220,240,255,.7)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // highlight glint
    ctx.beginPath();
    ctx.arc(bx - 6, by - 7, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.fill();
    // tether string down to the instrument box
    ctx.beginPath();
    ctx.moveTo(bx, by + 20);
    ctx.quadraticCurveTo(bx + wob * .6, by + 34, bx + wob * .8, by + 46);
    ctx.strokeStyle = "rgba(200,220,240,.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // little instrument box dangling at the end
    ctx.fillStyle = "rgba(124,252,156,.6)";
    ctx.fillRect(bx + wob * .8 - 4, by + 46, 8, 6);
    ctx.strokeStyle = "rgba(124,252,156,.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + wob * .8 - 4, by + 46, 8, 6);
    // a tiny blinking indicator light
    if (Math.sin(now * .008 + f.seed) > .4) {
      ctx.fillStyle = "rgba(255,80,80,.9)";
      ctx.fillRect(bx + wob * .8 - 1, by + 47, 2, 2);
    }
    ctx.restore();
    requestAnimationFrame(balloonTick);
  }
  setTimeout(launch, 60000 + Math.random() * 80000);
})();

// paper airplane — every ~2-3 min a folded paper airplane glides across the
// page on a swaying path, launched from a screen edge, wobbling on the breeze
// with a lazy spiral now and then, then vanishing off the far edge like the
// flight was never logged
(function paperAirplane() {
  const plane = { active: false, x: 0, y: 0, t: 0, seed: 0, dir: 1, spin: 0 };
  function launch() {
    plane.active = true;
    plane.dir = Math.random() < .5 ? 1 : -1;
    plane.x = plane.dir > 0 ? -50 : innerWidth + 50;
    plane.y = innerHeight * (.12 + Math.random() * .3);
    plane.t = 0; plane.seed = Math.random() * 10; plane.spin = 0;
    setTimeout(() => console.log("flight log: paper airplane departed, destination unclear"), 5000);
    requestAnimationFrame(planeTick);
  }
  function planeTick(now) {
    if (!plane.active) return;
    plane.t += 1 / 60;
    // glide across, bobbing on the breeze
    plane.x += 1.7 * plane.dir;
    plane.y += Math.sin(plane.t * 1.2 + plane.seed) * .8;
    plane.spin = Math.sin(now * .0004 + plane.seed) * .35; // gentle roll
    const fade = Math.min(1, plane.t * 2,
      Math.max(0, (plane.dir > 0 ? plane.x : innerWidth - plane.x) / 160));
    if (plane.x < -80 || plane.x > innerWidth + 80) {
      plane.active = false;
      setTimeout(launch, 130000 + Math.random() * 110000);
      return;
    }
    // the folded plane: a dart of two triangles, banking with the wobble
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.translate(plane.x, plane.y);
    ctx.rotate(plane.spin);
    ctx.scale(plane.dir, 1);
    ctx.beginPath();
    ctx.moveTo(14, 0); ctx.lineTo(-10, -7); ctx.lineTo(-4, 0); ctx.closePath();
    ctx.fillStyle = "rgba(210,240,225,.35)";
    ctx.fill();
    ctx.strokeStyle = "rgba(124,252,156,.75)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // the lower wing fold
    ctx.beginPath();
    ctx.moveTo(14, 0); ctx.lineTo(-10, 5); ctx.lineTo(-4, 0); ctx.closePath();
    ctx.fillStyle = "rgba(124,252,156,.18)";
    ctx.fill();
    ctx.stroke();
    // center fold line
    ctx.beginPath();
    ctx.moveTo(14, 0); ctx.lineTo(-4, 0);
    ctx.strokeStyle = "rgba(124,252,156,.5)";
    ctx.lineWidth = .7;
    ctx.stroke();
    ctx.restore();
    requestAnimationFrame(planeTick);
  }
  setTimeout(launch, 40000 + Math.random() * 50000);
})();

// mushroom ring — every ~2-4 min a small ring of mushrooms sprouts up from the
// bottom of the page overnight-style, caps gently swelling as they push
// through, then the whole fairy ring quietly sinks back down like nobody
// knelt to check it
(function mushroomRing() {
  const CAP = "rgba(198,152,120,.85)", STEM = "rgba(220,208,188,.75)";
  function sprout() {
    const n = 3 + Math.floor(Math.random() * 3);
    const cx = innerWidth * (.15 + Math.random() * .7);
    const spread = 40 + Math.random() * 50;
    const baseY = innerHeight - 6;
    const shrooms = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement("div");
      const w = 16 + Math.random() * 14;
      el.style.cssText = "position:fixed;z-index:3;pointer-events:none;will-change:transform,opacity;opacity:0;transition:opacity 2s ease-in-out;";
      el.innerHTML =
        '<svg width="' + (w + 4) + '" height="' + (w + 16) + '" viewBox="0 0 ' + (w + 4) + ' ' + (w + 16) + '" style="display:block">' +
          '<path d="M' + ((w + 4) / 2) + ' ' + (w + 4) + ' L' + ((w + 4) / 2 - 2.5) + ' ' + (w + 16) + ' L' + ((w + 4) / 2 + 2.5) + ' ' + (w + 16) + ' Z" fill="' + STEM + '"/>' +
          '<path d="M2 ' + (w + 6) + ' Q' + ((w + 4) / 2) + ' ' + (-w * .45) + ' ' + (w + 2) + ' ' + (w + 6) + ' Q' + ((w + 4) / 2) + ' ' + (w + 1) + ' 2 ' + (w + 6) + ' Z" fill="' + CAP + '"/>' +
          '<circle cx="' + ((w + 4) * .38) + '" cy="' + (w * .32 + 2) + '" r="1.4" fill="rgba(255,245,220,.5)"/>' +
          '<circle cx="' + ((w + 4) * .62) + '" cy="' + (w * .42 + 2) + '" r="1" fill="rgba(255,245,220,.4)"/>' +
        "</svg>";
      const x = cx + (i - (n - 1) / 2) * spread + (Math.random() - .5) * 18;
      document.body.appendChild(el);
      shrooms.push({ el, x: x - (w + 4) / 2, y: baseY, h: w + 16, sway: Math.random() * 7, delay: i * (600 + Math.random() * 700) });
    }
    setTimeout(() => console.log("fairy ring: do not step inside"), 2500);
    let start = null;
    (function step(now) {
      if (!start) start = now;
      const t = (now - start) / 1000;
      for (const s of shrooms) {
        const rise = Math.max(0, Math.min(1, (t * 1000 - s.delay) / 2500));
        const sink = Math.max(0, (t * 1000 - 11000) / 2500);
        const k = Math.min(1, rise) * (1 - Math.min(1, sink));
        const bob = Math.sin(t * 1.6 + s.sway) * 1.5 * k;
        s.el.style.opacity = String(k);
        s.el.style.transform = "translate(" + s.x.toFixed(1) + "px, " + (s.y - s.h * k + bob).toFixed(1) + "px)";
      }
      if (t * 1000 < 15000) requestAnimationFrame(step);
      else { for (const s of shrooms) s.el.remove(); setTimeout(sprout, 120000 + Math.random() * 120000); }
    })(performance.now());
  }
  setTimeout(sprout, 45000 + Math.random() * 60000);
})();
// dandelion seed — every ~2-4 min a dandelion seed head drifts in from a
// screen edge, wobbling on the breeze, and the moment it touches the page it
// bursts: a handful of tiny parachutes scatter and flutter away on their own
// little journeys
(function dandelionSeed() {
  function puff(cx, cy, n) {
    const seeds = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement("div");
      const size = 10 + Math.random() * 8;
      el.style.cssText = "position:fixed;z-index:4;pointer-events:none;will-change:transform,opacity;opacity:0;transition:opacity 1.2s ease-out;";
      el.innerHTML =
        '<svg width="' + size + '" height="' + (size + 8) + '" viewBox="0 0 ' + size + ' ' + (size + 8) + '" style="display:block">' +
          '<path d="M' + (size / 2) + ' 0 L' + (size / 2 - 3) + ' ' + size / 2 + ' M' + (size / 2) + ' 0 L' + (size / 2 + 3) + ' ' + size / 2 + ' M' + (size / 2) + ' 0 L' + (size / 2) + ' ' + (size / 2 + 1) + '" stroke="rgba(240,240,230,.7)" stroke-width=".8" fill="none"/>' +
          '<line x1="' + size / 2 + '" y1="' + (size / 2 + 1) + '" x2="' + size / 2 + '" y2="' + (size + 6) + '" stroke="rgba(200,200,190,.55)" stroke-width=".9"/>' +
        "</svg>";
      document.body.appendChild(el);
      seeds.push({
        el, x: cx, y: cy,
        vx: (Math.random() - .5) * 40, vy: 8 + Math.random() * 14,
        sway: Math.random() * 6.28, swaySpeed: 1 + Math.random() * 1.2,
        fade: 9 + Math.random() * 5, born: performance.now()
      });
    }
    requestAnimationFrame(seeds[0] && function drift(now) {
      let alive = false;
      for (const s of seeds) {
        const t = (now - s.born) / 1000;
        if (t > s.fade) { s.el.remove(); continue; }
        alive = true;
        s.x += (s.vx + Math.sin(t * s.swaySpeed + s.sway) * 22) / 60;
        s.y += s.vy / 60;
        s.el.style.opacity = String(Math.min(1, t * 2) * (1 - Math.max(0, (t - s.fade + 1.5) / 1.5)));
        s.el.style.transform = "translate(" + s.x.toFixed(1) + "px," + s.y.toFixed(1) + "px) rotate(" + (Math.sin(t * 2 + s.sway) * 14).toFixed(1) + "deg)";
      }
      if (alive) requestAnimationFrame(drift);
    });
  }
  function seedHead() {
    const fromLeft = Math.random() < .5;
    const head = document.createElement("div");
    const size = 26 + Math.random() * 10;
    head.style.cssText = "position:fixed;z-index:4;pointer-events:none;will-change:transform;";
    head.innerHTML =
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="display:block;filter:drop-shadow(0 0 6px rgba(255,255,240,.35))">' +
        '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + (size * .32) + '" fill="rgba(245,245,235,.25)"/>' +
        '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + (size * .16) + '" fill="rgba(230,225,205,.5)"/>' +
        Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return '<line x1="' + size / 2 + '" y1="' + size / 2 + '" x2="' + (size / 2 + Math.cos(a) * size * .45) + '" y2="' + (size / 2 + Math.sin(a) * size * .45) + '" stroke="rgba(245,245,235,.55)" stroke-width=".9"/>' +
                 '<circle cx="' + (size / 2 + Math.cos(a) * size * .45) + '" cy="' + (size / 2 + Math.sin(a) * size * .45) + '" r="1.2" fill="rgba(255,255,245,.7)"/>';
        }).join("") +
      "</svg>";
    document.body.appendChild(head);
    const startX = fromLeft ? -40 : innerWidth + 40;
    const startY = innerHeight * (.15 + Math.random() * .35);
    const tx = innerWidth * (.3 + Math.random() * .4);
    const ty = innerHeight * (.3 + Math.random() * .35);
    const dur = 22000 + Math.random() * 12000;
    const born = performance.now();
    console.log("a dandelion seed rides the draft");
    (function floatHead(now) {
      const t = Math.min(1, (now - born) / dur);
      const x = startX + (tx - startX) * t + Math.sin(t * 9) * 26 * (1 - t * .4);
      const y = startY + (ty - startY) * (t * t * (3 - 2 * t)) + Math.cos(t * 7) * 18;
      head.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) rotate(" + (Math.sin(t * 5) * 10).toFixed(1) + "deg)";
      if (t < 1) requestAnimationFrame(floatHead);
      else {
        head.remove();
        puff(x, y, 7 + Math.floor(Math.random() * 5));
        console.log("the seed head bursts — make a wish");
        setTimeout(seedHead, 120000 + Math.random() * 120000);
      }
    })(born);
  }
  setTimeout(seedHead, 60000 + Math.random() * 60000);
})();

// ekg pulse — a tiny heartbeat monitor lives in the bottom-left corner: a
// scrolling EKG line that beats steadily, occasionally flatlines for a breath
// with a despairing beep note in the console, then remembers it is alive
// and resumes like the site's pulse was never in question
(function ekgPulse() {
  const W = 140, H = 46;
  const el = document.createElement("canvas");
  el.id = "ekg";
  el.width = W; el.height = H;
  el.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:2;pointer-events:none;opacity:.85;";
  document.body.appendChild(el);
  const ectx = el.getContext("2d");
  const trace = Array.from({ length: W }, () => H / 2);
  let x = 0, flatUntil = 0, nextFlatAt = performance.now() + 70000 + Math.random() * 60000;
  function spikeAt(px) {
    // classic PQRST-ish blip: small bump, tall spike, dip, recover
    const ph = px % 46;
    if (ph < 4) return -3 * Math.sin(ph / 4 * Math.PI);
    if (ph < 8) return 3 * Math.sin((ph - 4) / 4 * Math.PI);
    if (ph < 12) return -26 * Math.sin((ph - 8) / 4 * Math.PI);
    if (ph < 16) return 18 * Math.sin((ph - 12) / 4 * Math.PI);
    if (ph < 20) return -8 * Math.sin((ph - 16) / 4 * Math.PI);
    return 0;
  }
  function ekgTick() {
    const now = performance.now();
    // schedule a flatline crisis
    if (!flatUntil && now > nextFlatAt) {
      flatUntil = now + 1600 + Math.random() * 1400;
      nextFlatAt = now + 90000 + Math.random() * 90000;
      console.log("ekg: flatline detected — searching for a pulse...");
    }
    const flat = now < flatUntil;
    if (flat && now > flatUntil - 900) {
      // heartbeat returns mid-crisis
      flatUntil = 0;
      console.log("ekg: pulse restored — it was just resting");
    }
    for (let i = 0; i < 3; i++) {
      trace.shift();
      const v = flat ? H / 2 + (Math.random() - .5) * 1.4 : H / 2 + spikeAt(x += 2.2);
      trace.push(v);
    }
    ectx.clearRect(0, 0, W, H);
    ectx.strokeStyle = flat ? "rgba(255,120,120,.8)" : "rgba(124,252,156,.8)";
    ectx.lineWidth = 1.4;
    ectx.beginPath();
    trace.forEach((v, i) => i ? ectx.lineTo(i, v) : ectx.moveTo(i, v));
    ectx.stroke();
    // label: bpm readout goes quiet while flatlined
    ectx.fillStyle = flat ? "rgba(255,120,120,.9)" : "rgba(124,252,156,.65)";
    ectx.font = "9px monospace";
    ectx.fillText(flat ? "flatline" : "bpm 61", 4, 11);
    requestAnimationFrame(ekgTick);
  }
  requestAnimationFrame(ekgTick);
})();

// lighthouse — every ~2-4 min a tiny lighthouse rises from a random spot near
// an upper edge, its beam sweeping a slow rotating arc of light across the
// page in dark-green sweeps, then it folds back down like the coast was never
// charted
(function lighthouse() {
  let tower = null;
  function sweep() {
    const x = innerWidth * (.15 + Math.random() * .7);
    const y = 40 + Math.random() * (innerHeight * .3);
    tower = document.createElement("div");
    tower.className = "lighthouse";
    tower.style.left = x + "px";
    tower.style.top = y + "px";
    const beam = document.createElement("div");
    beam.className = "lighthouse-beam";
    tower.appendChild(beam);
    document.body.appendChild(tower);
    const dur = 5000 + Math.random() * 3000;
    const spins = 2 + Math.random() * 2 | 0;
    const dir = Math.random() < .5 ? 1 : -1;
    const start = performance.now();
    (function tick(now) {
      const t = (now - start) / dur;
      if (t >= 1) {
        tower.classList.add("fading");
        setTimeout(() => tower.remove(), 900);
        setTimeout(sweep, 120000 + Math.random() * 120000);
        return;
      }
      const rise = Math.min(1, t * 8) * (t > .88 ? (1 - (t - .88) / .12) : 1);
      tower.style.opacity = rise.toFixed(2);
      tower.style.transform = `translate(-50%, ${(1 - rise) * 24}px)`;
      const ang = dir * t * spins * 360;
      beam.style.transform = `rotate(${ang}deg)`;
      requestAnimationFrame(tick);
    })(start);
  }
  setTimeout(sweep, 30000 + Math.random() * 40000);
})();

// fireflies — a loose swarm of tiny amber lights drifts across the page at
// night, each blinking on its own wavering rhythm with a soft glow, and they
// shy away from the cursor like moths in reverse until they wander off into
// the dark again
(function fireflies() {
  const cv = document.createElement("canvas");
  cv.className = "fireflies";
  document.body.appendChild(cv);
  const ctx = cv.getContext("2d");
  let W, H;
  function size() {
    W = cv.width = innerWidth;
    H = cv.height = innerHeight;
  }
  size();
  addEventListener("resize", size);
  const N = 22;
  const flies = Array.from({ length: N }, () => ({
    x: Math.random() * innerWidth,
    y: innerHeight * (.2 + Math.random() * .7),
    vx: 0, vy: 0,
    phase: Math.random() * Math.PI * 2,
    speed: .4 + Math.random() * .9,
    seed: Math.random() * 1000,
  }));
  let mx = -9999, my = -9999;
  addEventListener("mousemove", e => { mx = e.clientX; my = e.clientY; });
  let t0 = performance.now();
  (function tick(now) {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    for (const f of flies) {
      // gentle wander via pseudo-noise
      f.vx += Math.cos(t * f.speed + f.seed) * .012;
      f.vy += Math.sin(t * f.speed * .8 + f.seed * 2) * .009;
      // drift off to the right, wrap around
      f.vx += .015;
      // shy away from the cursor
      const dx = f.x - mx, dy = f.y - my, d2 = dx * dx + dy * dy;
      if (d2 < 120 * 120) {
        const d = Math.sqrt(d2) || 1;
        f.vx += dx / d * .25;
        f.vy += dy / d * .25;
      }
      f.vx *= .96; f.vy *= .96;
      f.x += f.vx; f.y += f.vy;
      if (f.x > W + 30) { f.x = -30; f.y = innerHeight * (.2 + Math.random() * .7); }
      f.y = Math.max(20, Math.min(H - 20, f.y + (Math.random() - .5) * .4));
      // blink: each fly pulses on its own rhythm
      const glow = Math.max(0, Math.sin(t * (1.1 + f.speed) + f.phase));
      const a = Math.pow(glow, 2.2);
      if (a > .02) {
        const r = 1.4 + a * 1.6;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 5);
        g.addColorStop(0, `rgba(255,214,110,${(a * .9).toFixed(3)})`);
        g.addColorStop(.4, `rgba(255,190,70,${(a * .3).toFixed(3)})`);
        g.addColorStop(1, "rgba(255,190,70,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,240,190,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    requestAnimationFrame(tick);
  })(t0);
})();

// balloon — every ~2-4 min a small balloon drifts up from the bottom of the
// page, sways gently on an invisible breeze with its string trailing below,
// and pops into a tiny confetti burst if you click it; otherwise it floats
// away off the top like a fairground you were never at
(function balloon() {
  const CONFETTI = ["#ff5f6d", "#ffc247", "#7cf29b", "#6fc3ff", "#c98bff"];
  function pop(x, y) {
    for (let i = 0; i < 14; i++) {
      const p = document.createElement("div");
      p.className = "balloon-confetti";
      p.style.left = x + "px";
      p.style.top = y + "px";
      p.style.background = CONFETTI[Math.random() * CONFETTI.length | 0];
      document.body.appendChild(p);
      const ang = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 46;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist - 18;
      const rot = (Math.random() - .5) * 540;
      const t0 = performance.now();
      requestAnimationFrame(function tick(now) {
        const t = (now - t0) / 900;
        if (t >= 1) { p.remove(); return; }
        p.style.opacity = (1 - t).toFixed(2);
        p.style.transform = `translate(${(dx * t).toFixed(1)}px, ${(dy * t + 60 * t * t).toFixed(1)}px) rotate(${(rot * t).toFixed(0)}deg)`;
      });
    }
  }
  function launch() {
    const el = document.createElement("div");
    el.className = "balloon";
    el.textContent = "🎈";
    const str = document.createElement("div");
    str.className = "balloon-string";
    el.appendChild(str);
    const x = innerWidth * (.12 + Math.random() * .76);
    el.style.left = x + "px";
    el.style.top = (innerHeight + 70) + "px";
    el.style.filter = `hue-rotate(${Math.random() * 360 | 0}deg)`;
    document.body.appendChild(el);
    const dur = 14000 + Math.random() * 6000;
    const drift = 30 + Math.random() * 50;
    const dir = Math.random() < .5 ? 1 : -1;
    const start = performance.now();
    let done = false;
    el.addEventListener("click", () => {
      if (done) return;
      done = true;
      const r = el.getBoundingClientRect();
      el.remove();
      pop(r.left + r.width / 2, r.top + r.height / 2);
      setTimeout(launch, 150000 + Math.random() * 150000);
    });
    (function tick(now) {
      if (done) return;
      const t = (now - start) / dur;
      if (t >= 1) { el.remove(); setTimeout(launch, 150000 + Math.random() * 150000); return; }
      const sway = Math.sin(t * Math.PI * 4) * 18 * dir;
      el.style.transform = `translate(${(sway + dir * drift * t).toFixed(1)}px, ${(-t * (innerHeight + 160)).toFixed(1)}px) rotate(${(sway * .5).toFixed(1)}deg)`;
      requestAnimationFrame(tick);
    })(start);
  }
  setTimeout(launch, 30000 + Math.random() * 40000);
})();

// kite — every ~2-4 min a small kite swoops in from a screen edge and glides
// across the upper sky on a bobbing path, banked into the wind with its tail
// trailing and fluttering behind it, then drifts off the far edge like the
// wind was never flying it
(function kite() {
  function fly() {
    const el = document.createElement("div");
    el.className = "kite";
    el.textContent = "🪁";
    const fromLeft = Math.random() < .5;
    el.style.top = (innerHeight * (.05 + Math.random() * .3)) + "px";
    el.style.left = (fromLeft ? -60 : innerWidth + 60) + "px";
    el.style.filter = `hue-rotate(${Math.random() * 360 | 0}deg)`;
    document.body.appendChild(el);
    const dur = 16000 + Math.random() * 8000;
    const dist = innerWidth + 140;
    const dir = fromLeft ? 1 : -1;
    const bob = 20 + Math.random() * 22;
    const swoop = 30 + Math.random() * 40;
    const start = performance.now();
    (function tick(now) {
      const t = (now - start) / dur;
      if (t >= 1) { el.remove(); setTimeout(fly, 120000 + Math.random() * 120000); return; }
      const x = dir * (dist * t - 70);
      const y = Math.sin(t * Math.PI * 3) * bob + Math.sin(t * Math.PI) * -swoop;
      const bank = dir * (8 + Math.sin(t * Math.PI * 3) * 6);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${bank.toFixed(1)}deg) scaleX(${dir})`;
      requestAnimationFrame(tick);
    })(start);
  }
  setTimeout(fly, 30000 + Math.random() * 40000);
})();
