let ctx: AudioContext | null = null;

async function getCtx(): Promise<AudioContext> {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  return ctx;
}

const STORAGE_KEY = 'rackup-sound-enabled';

export function isSoundEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== 'false';
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export async function playWinSound(): Promise<void> {
  if (!isSoundEnabled()) return;
  const ac = await getCtx();
  const now = ac.currentTime;

  // Two sine oscillators — bright rising tone
  for (const freq of [520, 780]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.3, now + 0.15);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }
}

export async function playStreakSound(streak: number): Promise<void> {
  if (!isSoundEnabled()) return;
  const ac = await getCtx();
  const now = ac.currentTime;

  if (streak < 4) {
    // Rising tones — one per streak count
    const baseFreq = 440 + streak * 80;
    for (let i = 0; i < streak; i++) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq + i * 120, now + i * 0.08);
      gain.gain.setValueAtTime(0.15, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.15);
      osc.connect(gain).connect(ac.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.17);
    }
  } else {
    // Rapid arpeggio for big streaks
    const notes = [523, 659, 784, 1047, 1319];
    const step = 0.06;
    for (let i = 0; i < notes.length; i++) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = i < 3 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(notes[i], now + i * step);
      gain.gain.setValueAtTime(0.14, now + i * step);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * step + 0.2);
      osc.connect(gain).connect(ac.destination);
      osc.start(now + i * step);
      osc.stop(now + i * step + 0.22);
    }
  }
}

export async function playLastOrdersSound(): Promise<void> {
  if (!isSoundEnabled()) return;
  const ac = await getCtx();
  const now = ac.currentTime;

  // Attention chime — three descending bell tones, repeated twice
  const pattern = [880, 784, 660];
  for (let r = 0; r < 2; r++) {
    const offset = r * 0.8;
    for (let i = 0; i < pattern.length; i++) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pattern[i], now + offset + i * 0.2);
      gain.gain.setValueAtTime(0.25, now + offset + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + i * 0.2 + 0.4);
      osc.connect(gain).connect(ac.destination);
      osc.start(now + offset + i * 0.2);
      osc.stop(now + offset + i * 0.2 + 0.45);
    }
  }
}

let vsSplashAudio: HTMLAudioElement | null = null;

export function playVsSplashSound(): void {
  if (!isSoundEnabled()) return;
  if (!vsSplashAudio) {
    vsSplashAudio = new Audio(import.meta.env.BASE_URL + 'vs-splash.mp3');
  }
  vsSplashAudio.currentTime = 0;
  vsSplashAudio.play().catch(() => {});
}

export async function playSessionEndFanfare(): Promise<void> {
  if (!isSoundEnabled()) return;
  const ac = await getCtx();
  const now = ac.currentTime;

  // Descending major chord arpeggio
  const notes = [1047, 880, 784, 659, 523];
  const step = 0.12;
  for (let i = 0; i < notes.length; i++) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(notes[i], now + i * step);
    gain.gain.setValueAtTime(0.15, now + i * step);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * step + 0.3);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + i * step);
    osc.stop(now + i * step + 0.35);
  }
}
