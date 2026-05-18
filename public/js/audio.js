// Procedural sound effects via Web Audio API
const Sound = (() => {
  let ctx = null;
  let enabled = true;

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {
      enabled = false;
    }
    // Resume on first user interaction (browser autoplay policy)
    document.addEventListener('click', () => {
      if (ctx && ctx.state === 'suspended') ctx.resume();
    }, { once: true });
  }

  function tone(freq, dur, type, vol, delay) {
    if (!enabled || !ctx) return;
    delay = delay || 0;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  function noise(dur, vol, delay) {
    if (!enabled || !ctx) return;
    delay = delay || 0;
    const t = ctx.currentTime + delay;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1500;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur);
  }

  // ── Sound effects ─────────────────────────────────────────

  function deal() {
    [523, 659, 784].forEach((f, i) => tone(f, 0.12, 'sine', 0.08, i * 0.08));
  }

  function playCard() {
    tone(350, 0.06, 'triangle', 0.1);
    noise(0.04, 0.06, 0.02);
  }

  function pass() {
    tone(180, 0.15, 'sine', 0.07);
  }

  function bomb() {
    noise(0.35, 0.25);
    tone(60, 0.3, 'sawtooth', 0.15);
    tone(45, 0.4, 'square', 0.12, 0.1);
    tone(30, 0.5, 'sawtooth', 0.1, 0.2);
  }

  function rocket() {
    [80, 60, 40, 20].forEach((f, i) => tone(f, 0.4 - i * 0.08, 'sawtooth', 0.18, i * 0.15));
    noise(0.6, 0.3);
  }

  function win() {
    [523, 659, 784, 880, 1047].forEach((f, i) => tone(f, 0.25, 'sine', 0.1, i * 0.12));
  }

  function lose() {
    [400, 350, 300, 250].forEach((f, i) => tone(f, 0.25, 'sine', 0.08, i * 0.15));
  }

  function turn() {
    tone(800, 0.04, 'sine', 0.08);
  }

  function bid() {
    tone(440, 0.08, 'sine', 0.08);
    tone(660, 0.08, 'sine', 0.06, 0.06);
  }

  function uiClick() {
    tone(1000, 0.03, 'sine', 0.05);
  }

  return { init, deal, playCard, pass, bomb, rocket, win, lose, turn, bid, uiClick };
})();
