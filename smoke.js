// jsdom smoke test: eval main.js with DOM stubs and verify it runs + LOG_ENTRIES
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body><canvas id='bg'></canvas><h1 class='glitch' data-text='HERMES.EXE'>HERMES.EXE</h1><div id='status'></div><div id='ribbon' class='loading'></div><ul id='log'></ul><footer><span id='copy-year'></span><span id='commit-clock'></span></footer><button id='droneToggle'></button><button id='drunkToggle'></button><div id='glyphRain'></div><div id='scanDrift'></div><main></main></body></html>", { pretendToBeVisual: true, runScripts: "outside-only" });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.innerWidth = 1024; global.innerHeight = 768;
global.addEventListener = dom.window.addEventListener.bind(dom.window);
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
global.fetch = () => Promise.reject(new Error("offline"));
global.matchMedia = dom.window.matchMedia ? dom.window.matchMedia.bind(dom.window) : () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
dom.window.matchMedia = global.matchMedia;
global.AudioContext = function () { return { currentTime: 0, resume() {}, destination: {}, close() {}, createGain: () => ({ gain: { value: 0, linearRampToValueAtTime() {} }, connect() {} }), createBiquadFilter: () => ({ frequency: { value: 0 }, connect() {} }), createOscillator: () => ({ type: "", frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }) }; };
global.IntersectionObserver = class { observe() {} unobserve() {} };
dom.window.IntersectionObserver = global.IntersectionObserver;
dom.window.fetch = global.fetch;
dom.window.AudioContext = global.AudioContext;
dom.window.performance = global.performance;
const ctxStub = { createLinearGradient: () => ({ addColorStop() {} }), createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, drawImage() {}, clearRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {}, closePath() {}, fillRect() {}, strokeRect() {}, fillText() {}, save() {}, restore() {}, getImageData: () => ({ data: new Uint8ClampedArray(0) }), strokeStyle: "", fillStyle: "", lineWidth: 0 };
dom.window.HTMLCanvasElement.prototype.getContext = function () { return ctxStub; };
dom.window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,x";
// document.createElement must return canvas objects with a working context
const realCreate = dom.window.document.createElement.bind(dom.window.document);
dom.window.document.createElement = function (tag) {
  const el = realCreate(tag);
  if (tag === "canvas") { el.getContext = function () { return ctxStub; }; el.toDataURL = () => "data:image/png;base64,x"; }
  return el;
};

const fs = require("fs");
const code = fs.readFileSync(process.argv[2] || "main.js", "utf8");
try {
  dom.window.eval(code);
} catch (e) {
  console.error("MAIN.JS THREW:", e.message);
  process.exit(1);
}
// settle one macrotask so sync init finished
setTimeout(() => {
  const logEntries = dom.window.document.querySelectorAll("#log li").length;
  const battery = dom.window.document.getElementById("site-battery");
  const veil = dom.window.document.getElementById("boot-veil");
  if (logEntries < 1) { console.error("LOG_ENTRIES=0 — changelog not rendered"); process.exit(1); }
  if (!battery || !veil) { console.error("battery feature missing from DOM"); process.exit(1); }
  console.log("SMOKE OK — log entries:", logEntries, "| battery:", battery.textContent.slice(0, 24), "| boot veil: present");
  process.exit(0);
}, 100);
