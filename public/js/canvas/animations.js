// Simple tween/animation system
const Animator = (() => {
  let running = false;
  let tweens = [];
  let onFrame = null; // callback called each frame

  // Tween: { startTime, duration, from, to, easing, onUpdate, onComplete }
  function start(callback) {
    onFrame = callback;
    if (!running) {
      running = true;
      requestAnimationFrame(tick);
    }
  }

  function stop() {
    running = false;
    tweens = [];
  }

  function tick(now) {
    if (!running) return;
    requestAnimationFrame(tick);

    const active = [];
    for (const tw of tweens) {
      const elapsed = now - tw.startTime;
      if (elapsed >= tw.duration) {
        // Complete
        if (tw.onUpdate) tw.onUpdate(1, tw.to);
        if (tw.onComplete) tw.onComplete();
      } else {
        const progress = elapsed / tw.duration;
        const eased = tw.easing ? tw.easing(progress) : progress;
        if (tw.onUpdate) tw.onUpdate(eased, tw.from + (tw.to - tw.from) * eased);
        active.push(tw);
      }
    }
    tweens = active;

    // Always call the frame callback for continuous rendering
    if (onFrame) onFrame();
  }

  function add(from, to, duration, onUpdate, onComplete, easing) {
    tweens.push({
      startTime: performance.now(),
      duration,
      from,
      to,
      onUpdate,
      onComplete,
      easing: easing || easeOutCubic
    });
  }

  function clear() {
    tweens = [];
  }

  // Easing functions
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutBounce(t) {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    else if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    else if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    else return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }

  return { start, stop, add, clear, easeOutCubic, easeInOutCubic, easeOutBounce };
})();
