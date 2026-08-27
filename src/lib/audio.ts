// Audio engine — đàn tranh simulation using Web Audio API
// Pentatonic scale (C D E G A) for authentic ancient Vietnamese/Chinese feel

const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];
const PENTATONIC_LOW = [130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66, 329.63];

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientGain: GainNode | null = null;
let ambientTimer: number | null = null;
let ambientPlaying = false;
let fireworkLoopTimer: number | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0;
    ambientGain.connect(masterGain);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// Pluck a single đàn tranh string — plucked string simulation
export function pluckString(freq: number, duration = 1.8, volume = 0.12, detune = 0) {
  const c = getCtx();
  const now = c.currentTime;

  // Fundamental + harmonics for rich string tone
  const harmonics = [1, 2, 3, 4, 0.5];
  const harmGains = [0.6, 0.25, 0.12, 0.06, 0.15];

  harmonics.forEach((h, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = i === 0 ? 'triangle' : 'sine';
    osc.frequency.value = freq * h;
    osc.detune.value = detune + (Math.random() - 0.5) * 3;

    const attack = 0.008;
    const decay = duration * 0.15;
    const sustain = duration * 0.3;
    const release = duration * 0.55;

    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(volume * harmGains[i], now + attack);
    g.gain.exponentialRampToValueAtTime(volume * harmGains[i] * 0.4, now + attack + decay);
    g.gain.exponentialRampToValueAtTime(volume * harmGains[i] * 0.15, now + attack + decay + sustain);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(g);
    g.connect(masterGain!);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  });
}

// Play a short melody phrase on đàn tranh
export function playMelodyPhrase(phrase?: number[]) {
  const notes = phrase ?? generatePhrase();
  const c = getCtx();
  const noteSpacing = 0.35;
  notes.forEach((noteIdx, i) => {
    const freq = PENTATONIC[noteIdx % PENTATONIC.length];
    const time = c.currentTime + i * noteSpacing;
    setTimeout(() => pluckString(freq, 1.5 + Math.random() * 0.5, 0.1, (Math.random() - 0.5) * 5), i * noteSpacing * 1000);
  });
}

function generatePhrase(): number[] {
  const len = 4 + Math.floor(Math.random() * 4);
  const phrase: number[] = [];
  let prev = Math.floor(Math.random() * 5);
  for (let i = 0; i < len; i++) {
    const step = Math.floor(Math.random() * 3) - 1;
    prev = Math.max(0, Math.min(7, prev + step));
    phrase.push(prev);
  }
  return phrase;
}

// Ambient background music — gentle đàn tranh with bass drone
export function startAmbientMusic() {
  if (ambientPlaying) return;
  ambientPlaying = true;
  const c = getCtx();

  // Fade in
  ambientGain!.gain.cancelScheduledValues(c.currentTime);
  ambientGain!.gain.setValueAtTime(ambientGain!.gain.value, c.currentTime);
  ambientGain!.gain.linearRampToValueAtTime(0.35, c.currentTime + 2);

  // Bass drone — low continuous tone for atmosphere
  const droneOsc = c.createOscillator();
  const droneGain = c.createGain();
  droneOsc.type = 'sine';
  droneOsc.frequency.value = 65.41; // C2
  droneGain.gain.value = 0.04;
  droneOsc.connect(droneGain);
  droneGain.connect(ambientGain!);
  droneOsc.start();

  // Secondary drone — perfect fifth
  const droneOsc2 = c.createOscillator();
  const droneGain2 = c.createGain();
  droneOsc2.type = 'sine';
  droneOsc2.frequency.value = 98.00; // G2
  droneGain2.gain.value = 0.025;
  droneOsc2.connect(droneGain2);
  droneGain2.connect(ambientGain!);
  droneOsc2.start();

  // Melody loop — plays phrases every 6-10 seconds
  const playPhrase = () => {
    if (!ambientPlaying) return;
    const phrase = generatePhrase();
    const noteSpacing = 0.4;
    phrase.forEach((noteIdx, i) => {
      const freq = PENTATONIC[noteIdx % PENTATONIC.length];
      setTimeout(() => {
        if (ambientPlaying) pluckString(freq, 1.8, 0.07, (Math.random() - 0.5) * 4);
      }, i * noteSpacing * 1000);
    });
    // Occasional low note for depth
    if (Math.random() > 0.5) {
      setTimeout(() => {
        if (ambientPlaying) pluckString(PENTATONIC_LOW[Math.floor(Math.random() * 4)], 2.5, 0.05);
      }, 200);
    }
    const nextDelay = 5000 + Math.random() * 4000;
    ambientTimer = window.setTimeout(playPhrase, nextDelay);
  };

  playPhrase();

  // Store drone oscillators for cleanup
  (ambientGain as any)._drones = [droneOsc, droneOsc2];
}

export function stopAmbientMusic() {
  if (!ambientPlaying) return;
  ambientPlaying = false;
  const c = getCtx();

  // Fade out
  ambientGain!.gain.cancelScheduledValues(c.currentTime);
  ambientGain!.gain.setValueAtTime(ambientGain!.gain.value, c.currentTime);
  ambientGain!.gain.linearRampToValueAtTime(0, c.currentTime + 1.5);

  // Stop drones after fade
  const drones = (ambientGain as any)._drones as OscillatorNode[];
  if (drones) {
    setTimeout(() => drones.forEach((d) => { try { d.stop(); } catch { /* already stopped */ } }), 1600);
  }

  if (ambientTimer) { clearTimeout(ambientTimer); ambientTimer = null; }
}

export function isAmbientPlaying() {
  return ambientPlaying;
}

// Firework explosion sound — layered crackle + boom
export function playFireworkExplosion(volume = 0.15) {
  const c = getCtx();
  const now = c.currentTime;

  // Boom — low frequency burst
  const boom = c.createOscillator();
  const boomGain = c.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(120 + Math.random() * 60, now);
  boom.frequency.exponentialRampToValueAtTime(40, now + 0.3);
  boomGain.gain.setValueAtTime(volume * 0.7, now);
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  boom.connect(boomGain);
  boomGain.connect(masterGain!);
  boom.start(now);
  boom.stop(now + 0.55);

  // Crackle — noise burst for sparkles
  const bufferSize = c.sampleRate * 0.4;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 2000 + Math.random() * 2000;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.3, now + 0.05);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain!);
  noise.start(now + 0.05);

  // Sparkle — high frequency tinkle
  const sparkleCount = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < sparkleCount; i++) {
    const sparkle = c.createOscillator();
    const sparkleGain = c.createGain();
    sparkle.type = 'sine';
    sparkle.frequency.value = 2000 + Math.random() * 4000;
    const delay = 0.1 + Math.random() * 0.2;
    sparkleGain.gain.setValueAtTime(0, now + delay);
    sparkleGain.gain.linearRampToValueAtTime(volume * 0.08, now + delay + 0.01);
    sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
    sparkle.connect(sparkleGain);
    sparkleGain.connect(masterGain!);
    sparkle.start(now + delay);
    sparkle.stop(now + delay + 0.2);
  }
}

// Start continuous firework sounds — for release animation & greeting view
export function startFireworkLoop(intervalMs = 1200) {
  stopFireworkLoop();
  const play = () => {
    playFireworkExplosion(0.12 + Math.random() * 0.06);
    // Sometimes double burst
    if (Math.random() > 0.4) {
      setTimeout(() => playFireworkExplosion(0.08 + Math.random() * 0.04), 300 + Math.random() * 200);
    }
  };
  play();
  fireworkLoopTimer = window.setInterval(play, intervalMs);
}

export function stopFireworkLoop() {
  if (fireworkLoopTimer) { clearInterval(fireworkLoopTimer); fireworkLoopTimer = null; }
}

// Single chime — for UI interactions
export function playChime(freq = 523.25, volume = 0.08) {
  const c = getCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(volume, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc.connect(g);
  g.connect(masterGain!);
  osc.start(now);
  osc.stop(now + 0.65);
}

// Crescendo — for greeting card unlock
export function playCrescendo() {
  const c = getCtx();
  const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
  notes.forEach((freq, i) => {
    setTimeout(() => pluckString(freq, 2.5, 0.1, (Math.random() - 0.5) * 3), i * 200);
  });
  // Final shimmer
  setTimeout(() => {
    [523.25, 659.25, 783.99, 880.00].forEach((f, i) => {
      setTimeout(() => playChime(f, 0.06), i * 80);
    });
  }, 1200);
}

export function getAudioContext() {
  return getCtx();
}
