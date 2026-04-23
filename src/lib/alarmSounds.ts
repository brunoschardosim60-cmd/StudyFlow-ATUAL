// Alarm sound presets for the Pomodoro timer.
// Each preset returns a WAV data URL that an HTMLAudioElement can play
// even when the tab is in background (Web Audio is throttled then).

export type AlarmSoundId = "clock" | "bell" | "chime" | "digital" | "custom";

export interface AlarmPreset {
  id: AlarmSoundId;
  label: string;
  description: string;
}

export const ALARM_PRESETS: AlarmPreset[] = [
  { id: "clock", label: "Tique-taque", description: "Suave, relógio de madeira" },
  { id: "bell", label: "Sino", description: "Toque de sino quente" },
  { id: "chime", label: "Carrilhão", description: "Notas suaves" },
  { id: "digital", label: "Digital", description: "Bipe clássico" },
];

const SAMPLE_RATE = 44100;

function encodeWav(samples: Float32Array): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s * 32767, true);
    offset += 2;
  }
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(binary);
}

function buildClock(repeat: number): string {
  const tickDur = 0.05;
  const gap = 0.55;
  const tickN = Math.floor(tickDur * SAMPLE_RATE);
  const gapN = Math.floor(gap * SAMPLE_RATE);
  const total = tickN * repeat + gapN * Math.max(0, repeat - 1);
  const out = new Float32Array(total);
  let off = 0;
  for (let r = 0; r < repeat; r++) {
    const pitch = r % 2 === 0 ? 1500 : 1100;
    for (let i = 0; i < tickN; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.exp(-55 * t);
      const noise = (Math.random() * 2 - 1) * 0.15;
      const wave = Math.sin(2 * Math.PI * pitch * t) * 0.85 + noise;
      out[off++] = Math.tanh(wave * env * 0.5);
    }
    if (r < repeat - 1) off += gapN;
  }
  return encodeWav(out);
}

function buildBell(repeat: number): string {
  const dur = 1.4;
  const gap = 0.25;
  const dN = Math.floor(dur * SAMPLE_RATE);
  const gN = Math.floor(gap * SAMPLE_RATE);
  const total = dN * repeat + gN * Math.max(0, repeat - 1);
  const out = new Float32Array(total);
  let off = 0;
  const harmonics = [
    { f: 523.25, a: 0.6 }, // C5
    { f: 1046.5, a: 0.3 },
    { f: 1568, a: 0.15 },
    { f: 2093, a: 0.08 },
  ];
  for (let r = 0; r < repeat; r++) {
    for (let i = 0; i < dN; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.exp(-2.5 * t);
      let v = 0;
      for (const h of harmonics) v += Math.sin(2 * Math.PI * h.f * t) * h.a;
      out[off++] = Math.tanh(v * env * 0.7);
    }
    if (r < repeat - 1) off += gN;
  }
  return encodeWav(out);
}

function buildChime(repeat: number): string {
  // Three-note ascending chime per repeat.
  const notes = [659.25, 783.99, 987.77]; // E5, G5, B5
  const noteDur = 0.35;
  const gap = 0.4;
  const nN = Math.floor(noteDur * SAMPLE_RATE);
  const gN = Math.floor(gap * SAMPLE_RATE);
  const seqN = nN * notes.length;
  const total = seqN * repeat + gN * Math.max(0, repeat - 1);
  const out = new Float32Array(total);
  let off = 0;
  for (let r = 0; r < repeat; r++) {
    for (const f of notes) {
      for (let i = 0; i < nN; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.exp(-3.5 * t) * Math.min(1, t * 50);
        const wave = Math.sin(2 * Math.PI * f * t) * 0.6 + Math.sin(2 * Math.PI * f * 2 * t) * 0.2;
        out[off++] = Math.tanh(wave * env * 0.7);
      }
    }
    if (r < repeat - 1) off += gN;
  }
  return encodeWav(out);
}

function buildDigital(repeat: number): string {
  const beepDur = 0.15;
  const gap = 0.12;
  const bN = Math.floor(beepDur * SAMPLE_RATE);
  const gN = Math.floor(gap * SAMPLE_RATE);
  const total = bN * repeat + gN * Math.max(0, repeat - 1);
  const out = new Float32Array(total);
  let off = 0;
  for (let r = 0; r < repeat; r++) {
    for (let i = 0; i < bN; i++) {
      const t = i / SAMPLE_RATE;
      const env = t < 0.005 ? t / 0.005 : t > beepDur - 0.01 ? (beepDur - t) / 0.01 : 1;
      out[off++] = Math.sin(2 * Math.PI * 880 * t) * env * 0.7;
    }
    if (r < repeat - 1) off += gN;
  }
  return encodeWav(out);
}

export function getAlarmDataUrl(id: AlarmSoundId, repeat = 3): string {
  switch (id) {
    case "bell": return buildBell(repeat);
    case "chime": return buildChime(repeat);
    case "digital": return buildDigital(Math.max(repeat, 4));
    case "clock":
    default: return buildClock(Math.max(repeat, 5));
  }
}
