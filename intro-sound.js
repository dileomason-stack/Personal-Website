// Sound for the 3D intro, all synthesized (no audio files): room tone, the switch click,
// a fluorescent buzz that follows the bulb's flicker, and a whoosh for the camera flight.
// Off until the visitor turns it on; the choice is remembered.
const KEY = 'mdl-intro-sound';

export function createSound(button) {
  let ctx = null, master, tone, buzz, buzzGain;
  let on = false;
  try { on = localStorage.getItem(KEY) === 'on'; } catch (e) {}

  function noiseBuffer(seconds, brown) {
    const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const white = Math.random() * 2 - 1;
      d[i] = brown ? (last = (last + 0.02 * white) / 1.02) * 3.5 : white;
    }
    return b;
  }

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // Room tone: a quiet, low rumble
    tone = ctx.createBufferSource();
    tone.buffer = noiseBuffer(4, true);
    tone.loop = true;
    const toneGain = ctx.createGain();
    toneGain.gain.value = 0.05;
    tone.connect(toneGain).connect(master);
    tone.start();
    // Fluorescent buzz: a 100 Hz sawtooth through a band-pass, gated by the bulb
    buzz = ctx.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.value = 100;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 2;
    buzzGain = ctx.createGain();
    buzzGain.gain.value = 0;
    buzz.connect(band).connect(buzzGain).connect(master);
    buzz.start();
  }

  function render() {
    button.setAttribute('aria-pressed', String(on));
    button.textContent = on ? 'Sound on' : 'Sound off';
  }

  function set(value) {
    on = value;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {}
    if (on) init();
    if (ctx) {
      ctx.resume();
      master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.08);
    }
    render();
  }

  // Browsers only allow audio after a gesture, so a remembered "on" waits for the first one
  if (on) addEventListener('pointerdown', () => set(true), { once: true });
  if (on) addEventListener('keydown', () => set(true), { once: true });
  button.addEventListener('click', e => { e.stopPropagation(); set(!on); });
  render();

  function burst(at, length, freq, gain) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(length, false);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(f).connect(g).connect(master);
    src.start(at);
  }

  return {
    // The toggle's snap, then the lever seating
    click() {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      burst(t, 0.03, 3200, 0.5);
      burst(t + 0.035, 0.07, 700, 0.35);
    },
    // 0..1, follows the bulb while it flickers
    hum(level) {
      if (!ctx) return;
      buzzGain.gain.setTargetAtTime(on ? level * 0.06 : 0, ctx.currentTime, 0.015);
    },
    whoosh(seconds) {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(seconds, false);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(250, t);
      f.frequency.exponentialRampToValueAtTime(2800, t + seconds * 0.85);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + seconds * 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
      src.connect(f).connect(g).connect(master);
      src.start(t);
    },
    stop() {
      if (!ctx) return;
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      setTimeout(() => ctx.close(), 1500);
    },
  };
}
