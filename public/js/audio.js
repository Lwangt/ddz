// Rich sound effects via Web Audio API — layered harmonics, better envelopes
const Sound = (() => {
  let ctx = null;
  let masterGain = null;
  let enabled = true;

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.8;
      masterGain.connect(ctx.destination);
    } catch(e) {
      enabled = false;
      return;
    }
    // Resume AudioContext on any user interaction
    const resume = () => {
      if (ctx && ctx.state === 'suspended') ctx.resume();
    };
    document.addEventListener('click', resume);
    document.addEventListener('touchstart', resume);
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  // Single oscillator tone with ADSR-like envelope
  function tone(freq, dur, type, vol, startTime, rampDown) {
    if (!enabled || !ctx) return;
    const t = startTime || now();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const v = vol || 0.12;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.01);
    g.gain.setValueAtTime(v, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + (rampDown || dur));
    osc.connect(g);
    g.connect(masterGain || ctx.destination);
    osc.start(t);
    osc.stop(t + (rampDown || dur) + 0.05);
  }

  // Noise burst with filter
  function noise(dur, vol, startTime, lowpass) {
    if (!enabled || !ctx) return;
    const t = startTime || now();
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol || 0.08, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 2000;
    src.connect(filter);
    filter.connect(g);
    g.connect(masterGain || ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // Chord: multiple simultaneous tones
  function chord(freqs, dur, type, vol) {
    const t = now();
    freqs.forEach((f, i) => tone(f, dur, type, vol * 0.7, t + i * 0.02));
  }

  // ── Sound effects ─────────────────────────────────────────

  function deal() {
    const t = now();
    [523, 659, 784, 1047].forEach((f, i) => {
      tone(f, 0.15, 'sine', 0.07, t + i * 0.07);
      tone(f * 0.5, 0.1, 'triangle', 0.04, t + i * 0.07);
    });
  }

  function playCard() {
    noise(0.03, 0.08, now(), 3000);
    tone(520, 0.05, 'triangle', 0.09, now() + 0.01);
  }

  function pass() {
    tone(200, 0.2, 'triangle', 0.08, now());
    tone(160, 0.25, 'sine', 0.06, now() + 0.05);
  }

  function bomb() {
    const t = now();
    noise(0.4, 0.3, t, 800);
    [80, 60, 45, 30].forEach((f, i) => {
      tone(f, 0.5 - i * 0.08, 'sawtooth', 0.12, t + i * 0.08, 0.6);
    });
    tone(150, 0.3, 'square', 0.08, t + 0.2);
  }

  function rocket() {
    const t = now();
    noise(0.7, 0.35, t, 500);
    [100, 70, 50, 30, 20].forEach((f, i) => {
      tone(f, 0.6 - i * 0.1, 'sawtooth', 0.14, t + i * 0.1, 0.7);
    });
    tone(200, 0.5, 'square', 0.1, t + 0.3);
  }

  function win() {
    const t = now();
    chord([523, 659, 784], 0.3, 'sine', 0.1);
    chord([659, 784, 880], 0.3, 'sine', 0.1, t + 0.2);
    chord([784, 880, 1047], 0.4, 'sine', 0.1, t + 0.4);
    // Bright harmonics
    [523, 659, 784, 880, 1047].forEach((f, i) => {
      tone(f * 2, 0.2, 'sine', 0.04, t + i * 0.12);
    });
  }

  function lose() {
    const t = now();
    [440, 370, 310, 250, 200].forEach((f, i) => {
      tone(f, 0.3, 'sine', 0.07, t + i * 0.14);
      tone(f * 0.5, 0.35, 'triangle', 0.04, t + i * 0.14);
    });
  }

  function turn() {
    const t = now();
    tone(880, 0.05, 'sine', 0.1, t);
    tone(1320, 0.04, 'sine', 0.06, t + 0.03);
  }

  function bid(level) {
    const t = now();
    const lv = level || 1;
    for (let i = 0; i < lv; i++) {
      tone(440 + i * 110, 0.1, 'sine', 0.08, t + i * 0.08);
      tone(660 + i * 110, 0.08, 'triangle', 0.05, t + i * 0.08 + 0.03);
    }
  }

  function uiClick() {
    tone(1200, 0.02, 'sine', 0.04, now());
  }

  // Game start fanfare
  function gameStart() {
    const t = now();
    chord([392, 523, 659], 0.2, 'sine', 0.08);
    chord([523, 659, 784], 0.25, 'sine', 0.09, t + 0.15);
    chord([659, 784, 1047], 0.35, 'sine', 0.1, t + 0.3);
  }

  return { init, deal, playCard, pass, bomb, rocket, win, lose, turn, bid, uiClick, gameStart };
})();
