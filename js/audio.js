'use strict';
// 외부 파일 없이 WebAudio로 만드는 짧은 효과음
const Sfx = (() => {
  let ctx = null;
  function beep(freq, dur, type = 'square', vol = 0.07) {
    if (!state || !state.settings.sound) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = vol;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.stop(ctx.currentTime + dur);
    } catch (e) { /* 오디오 불가 */ }
  }
  return {
    ok()      { beep(660, 0.1); setTimeout(() => beep(880, 0.15), 90); },
    bad()     { beep(160, 0.3, 'sawtooth', 0.05); },
    coin()    { beep(1300, 0.08, 'sine', 0.06); setTimeout(() => beep(1700, 0.1, 'sine', 0.06), 60); },
    hit()     { beep(220, 0.12, 'triangle', 0.1); },
    crit()    { beep(220, 0.1, 'triangle', 0.1); setTimeout(() => beep(440, 0.15, 'triangle', 0.1), 80); },
    door()    { beep(440, 0.1); setTimeout(() => beep(660, 0.2), 100); },
    step()    { beep(200, 0.03, 'sine', 0.02); },
    levelup() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'sine', 0.09), i * 120)); },
    win()     { [784, 988, 1175].forEach((f, i) => setTimeout(() => beep(f, 0.2, 'sine', 0.08), i * 100)); },
    down()    { [400, 300, 200].forEach((f, i) => setTimeout(() => beep(f, 0.3, 'sawtooth', 0.05), i * 200)); },
  };
})();
