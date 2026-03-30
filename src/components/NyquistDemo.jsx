import { useState, useRef, useEffect, useCallback } from "react";

const sinc = (x) => {
  if (Math.abs(x) < 1e-10) return 1;
  const px = Math.PI * x;
  return Math.sin(px) / px;
};

const generateSignal = () => {
  const numComponents = 3 + Math.floor(Math.random() * 4);
  const components = [];
  for (let i = 0; i < numComponents; i++) {
    components.push({
      freq: 0.5 + Math.random() * 4.5,
      amp: 0.15 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
    });
  }
  const maxFreq = Math.max(...components.map((c) => c.freq));
  return { components, maxFreq };
};

const evalSignal = (t, components) => {
  let val = 0;
  for (const c of components) {
    val += c.amp * Math.sin(2 * Math.PI * c.freq * t + c.phase);
  }
  return val;
};

const makeEvaluator = ({ components }) => (t) => evalSignal(t, components);

const makeInterpolatedEvaluator = (samples, evalSampleRate, duration) => {
  const count = samples.length;
  return (t) => {
    const clamped = Math.max(0, Math.min(t, duration));
    const idx = clamped * evalSampleRate;
    const i0 = Math.floor(idx);
    if (i0 >= count - 1) return samples[count - 1];
    const frac = idx - i0;
    return samples[i0] * (1 - frac) + samples[i0 + 1] * frac;
  };
};

class WavError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const decodeWav = async (arrayBuffer) => {
  let audioCtx;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    throw new WavError("NO_AUDIO_CONTEXT", "Browser does not support AudioContext");
  }
  try {
    const buf = await audioCtx.decodeAudioData(arrayBuffer);
    return {
      samples: buf.getChannelData(0),
      originalSampleRate: buf.sampleRate,
      channelCount: buf.numberOfChannels,
      duration: buf.duration,
    };
  } catch {
    throw new WavError("CORRUPT", "Could not decode audio data");
  } finally {
    audioCtx.close();
  }
};

const validateLength = (decoded) => {
  const { samples, originalSampleRate } = decoded;
  const minSamples = Math.floor(originalSampleRate * 0.5);
  if (samples.length < minSamples) {
    throw new WavError("TOO_SHORT", "Audio file is too short");
  }
};

const normalizeAmplitude = (samples) => {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  if (peak < 1e-6) {
    throw new WavError("SILENCE", "Audio contains only silence");
  }
  const scale = 0.8 / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i] * scale;
  }
  return out;
};

const processWavFile = async (file) => {
  if (!file.name.toLowerCase().endsWith(".wav") && !file.type.match(/^audio\/(wav|x-wav|wave)$/)) {
    throw new WavError("WRONG_TYPE", "Not a WAV file");
  }
  const arrayBuffer = await file.arrayBuffer();
  const decoded = await decodeWav(arrayBuffer);
  validateLength(decoded);
  const normalized = normalizeAmplitude(decoded.samples.slice());
  const fullDuration = normalized.length / decoded.originalSampleRate;
  return {
    samples: normalized,
    sampleRate: decoded.originalSampleRate,
    maxFreq: decoded.originalSampleRate / 2,
    fullDuration,
    fileName: file.name,
  };
};

const formatHz = (hz) => {
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)} kHz`;
  return `${hz.toFixed(1)} Hz`;
};

const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
    <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
    <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const i18n = {
  en: {
    title: "Nyquist\u2013Shannon Sampling Theorem",
    subtitle: "A band-limited signal sampled at \u22652\u00d7 its maximum frequency is perfectly reconstructable. Below that rate, the reconstruction fails \u2014 not approximately, but fundamentally.",
    legendOriginal: "Original (band-limited)",
    legendReconstructed: "Reconstructed from samples",
    converged: "PERFECT RECONSTRUCTION",
    under: "ALIASING \u2014 DATA LOST",
    randomize: "Randomize signal",
    sampleRate: "Sample rate",
    nyquistLabel: "Nyquist rate",
    infoGray: "The gray waveform",
    infoOriginal: (n, f) => `is the original band-limited signal (sum of ${n} sinusoids, highest frequency ${f} Hz).`,
    infoReconstructed: (color) => `The ${color} waveform`,
    infoRest: (nr) => `is reconstructed purely from the sample points using sinc interpolation. Once the sample rate reaches ${nr} Hz, the reconstruction is mathematically perfect \u2014 additional samples add nothing.`,
    underMsg: "Currently undersampled \u2014 the reconstruction is wrong and cannot be fixed without more samples.",
    note: "Note: right at the Nyquist threshold, the visual reconstruction may not look perfectly aligned. This is a computational artifact \u2014 the sinc interpolation formula sums infinitely many terms, but this demo uses a finite number. The theorem itself guarantees exact reconstruction at any rate \u22652\u00d7f",
    red: "red",
    orange: "orange",
    themeLight: "Switch to light theme",
    themeDark: "Switch to dark theme",
    langFi: "Switch to Finnish",
    langEn: "Switch to English",
    uploadPrompt: "Drop a WAV file here or click to browse",
    uploadDragActive: "Drop to upload",
    uploadProcessing: "Decoding WAV\u2026",
    uploadClear: "Clear uploaded file",
    uploadAriaLabel: "Upload a WAV file",
    uploadRetry: "Try another file.",
    err_WRONG_TYPE: "Only WAV files are supported. Choose a .wav file.",
    err_TOO_SHORT: "File is too short. Upload at least 1 second of audio.",
    err_SILENCE: "This file contains only silence. Try a different recording.",
    err_CORRUPT: "Could not read this file. It may be corrupted or use an unsupported format.",
    err_NO_AUDIO_CONTEXT: "Your browser does not support audio decoding. Try a current version of Firefox, Chrome, or Safari.",
    infoSourceUploaded: (sr, dur) => `is your uploaded WAV (${(sr / 1000).toFixed(1)} kHz, ${dur.toFixed(1)}s). Use the overview to navigate, then drag the middle view to zoom in. f_max = ${(sr / 2 / 1000).toFixed(1)} kHz, Nyquist rate = ${(sr / 1000).toFixed(1)} kHz.`,
  },
  fi: {
    title: "Nyquistin\u2013Shannonin n\u00e4ytteenottoteoreema",
    subtitle: "Kaistanrajoitettu signaali, joka n\u00e4ytteistet\u00e4\u00e4n \u22652\u00d7 sen maksimitaajuudella, voidaan rekonstruoida t\u00e4ydellisesti. T\u00e4t\u00e4 alhaisemmalla nopeudella rekonstruktio ep\u00e4onnistuu \u2014 ei liki\u00e4m\u00e4\u00e4r\u00e4isesti, vaan perustavanlaatuisesti.",
    legendOriginal: "Alkuper\u00e4inen (kaistanrajoitettu)",
    legendReconstructed: "Rekonstruoitu n\u00e4ytteist\u00e4",
    converged: "T\u00c4YDELLINEN REKONSTRUKTIO",
    under: "LASKOSTUMINEN \u2014 DATAA MENETETTY",
    randomize: "Satunnaista signaali",
    sampleRate: "N\u00e4ytteenottotaajuus",
    nyquistLabel: "Nyquist-taajuus",
    infoGray: "Harmaa aaltomuoto",
    infoOriginal: (n, f) => `on alkuper\u00e4inen kaistanrajoitettu signaali (${n} sinusoidin summa, korkein taajuus ${f} Hz).`,
    infoReconstructed: (color) => `${color[0].toUpperCase() + color.slice(1)} aaltomuoto`,
    infoRest: (nr) => `on rekonstruoitu pelk\u00e4st\u00e4\u00e4n n\u00e4ytepisteist\u00e4 sinc-interpolaatiolla. Kun n\u00e4ytteenottotaajuus saavuttaa ${nr} Hz, rekonstruktio on matemaattisesti t\u00e4ydellinen \u2014 lis\u00e4n\u00e4ytteet eiv\u00e4t tuo mit\u00e4\u00e4n uutta.`,
    underMsg: "Alin\u00e4ytteistetty \u2014 rekonstruktio on virheellinen eik\u00e4 sit\u00e4 voi korjata ilman lis\u00e4n\u00e4ytteit\u00e4.",
    note: "Huom: juuri Nyquist-rajalla visuaalinen rekonstruktio ei v\u00e4ltt\u00e4m\u00e4tt\u00e4 n\u00e4yt\u00e4 t\u00e4ydelliselt\u00e4. T\u00e4m\u00e4 on laskennallinen artefakti \u2014 sinc-interpolaatiokaava summaa \u00e4\u00e4rett\u00f6m\u00e4n m\u00e4\u00e4r\u00e4n termej\u00e4, mutta t\u00e4m\u00e4 demo k\u00e4ytt\u00e4\u00e4 \u00e4\u00e4rellist\u00e4 m\u00e4\u00e4r\u00e4\u00e4. Teoreema takaa tarkan rekonstruktion mill\u00e4 tahansa nopeudella \u22652\u00d7f",
    red: "punainen",
    orange: "oranssi",
    themeLight: "Vaihda vaaleaan teemaan",
    themeDark: "Vaihda tummaan teemaan",
    langFi: "Vaihda suomeksi",
    langEn: "Vaihda englanniksi",
    uploadPrompt: "Pudota WAV-tiedosto t\u00e4h\u00e4n tai napsauta selataksesi",
    uploadDragActive: "Pudota ladataksesi",
    uploadProcessing: "Puretaan WAV-tiedostoa\u2026",
    uploadClear: "Poista ladattu tiedosto",
    uploadAriaLabel: "Lataa WAV-tiedosto",
    uploadRetry: "Kokeile toista tiedostoa.",
    err_WRONG_TYPE: "Vain WAV-tiedostot ovat tuettuja. Valitse .wav-tiedosto.",
    err_TOO_SHORT: "Tiedosto on liian lyhyt. Lataa v\u00e4hint\u00e4\u00e4n 1 sekunti \u00e4\u00e4nt\u00e4.",
    err_SILENCE: "T\u00e4m\u00e4 tiedosto sis\u00e4lt\u00e4\u00e4 vain hiljaisuutta. Kokeile toista tallennetta.",
    err_CORRUPT: "Tiedostoa ei voitu lukea. Se voi olla vioittunut tai k\u00e4ytt\u00e4\u00e4 tukeamatonta muotoa.",
    err_NO_AUDIO_CONTEXT: "Selaimesi ei tue \u00e4\u00e4nen purkamista. Kokeile uusinta Firefox-, Chrome- tai Safari-versiota.",
    infoSourceUploaded: (sr, dur) => `on ladattu WAV-tiedostosi (${(sr / 1000).toFixed(1)} kHz, ${dur.toFixed(1)}s). K\u00e4yt\u00e4 yleiskuvaa navigointiin, vedä keskimmäistä näkymää lähentääksesi. f_max = ${(sr / 2 / 1000).toFixed(1)} kHz, Nyquist-taajuus = ${(sr / 1000).toFixed(1)} kHz.`,
  },
};

const themes = {
  dark: {
    bg: "#08080c",
    canvasBg: "#0a0a0f",
    text: "#e0e0e0",
    textMuted: "#888",
    textFaint: "#666",
    textFaintest: "#555",
    gridLine: "#16161e",
    border: "#16161e",
    infoBg: "#0e0e12",
    originalWave: "rgba(255,255,255,0.22)",
    legendText: "rgba(255,255,255,0.6)",
    stemColor: "rgba(255,255,255,0.08)",
    dotFill: "#111",
    btnBorder: "#333",
    noteColor: "#888",
    accent: "#f59e0b",
    accentMuted: "#f59e0b",
    success: "#22c55e",
    error: "#ef4444",
    errorText: "#ef4444",
  },
  light: {
    bg: "#f5f5f0",
    canvasBg: "#fafaf8",
    text: "#1a1a1a",
    textMuted: "#555",
    textFaint: "#777",
    textFaintest: "#6e6e6e",
    gridLine: "#e0e0e0",
    border: "#d0d0d0",
    infoBg: "#e4e4de",
    originalWave: "rgba(0,0,0,0.15)",
    legendText: "rgba(0,0,0,0.6)",
    stemColor: "rgba(0,0,0,0.06)",
    dotFill: "#fff",
    btnBorder: "#bbb",
    noteColor: "#6b7280",
    accent: "#b45309",
    accentMuted: "#92400e",
    success: "#16a34a",
    error: "#dc2626",
    errorText: "#dc2626",
  },
};

const FONT_STACK = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', 'Consolas', 'Menlo', monospace";

const focusHandlers = (accentColor) => ({
  onFocus: (e) => { e.target.style.outline = `2px solid ${accentColor}`; e.target.style.outlineOffset = "2px"; },
  onBlur: (e) => { e.target.style.outline = "none"; },
});

export default function NyquistDemo() {
  const mapCanvasRef = useRef(null);
  const canvasRef = useRef(null);
  const zoomCanvasRef = useRef(null);
  const evaluatorRef = useRef(null);
  const fileInputRef = useRef(null);
  const segDragRef = useRef({ dragging: false, startX: 0 });
  const mapDragRef = useRef({ dragging: false, startX: 0 });
  const [signal, setSignal] = useState(() => generateSignal());
  const [sampleRate, setSampleRate] = useState(4);
  const [duration, setDuration] = useState(3);
  const [lang, setLang] = useState("en");
  const [mode, setMode] = useState("dark");
  const [uploadState, setUploadState] = useState({ status: "idle", fileName: null, errorCode: null });
  const [uploadedMaxFreq, setUploadedMaxFreq] = useState(null);
  const [uploadedWavInfo, setUploadedWavInfo] = useState(null);
  const [segmentStart, setSegmentStart] = useState(0);
  const [fullDuration, setFullDuration] = useState(null);
  const [zoomRange, setZoomRange] = useState([0, 0.2]);

  const loc = i18n[lang];
  const th = themes[mode];

  const isWavMode = uploadState.status === "loaded" && uploadedMaxFreq !== null;
  const activeMaxFreq = uploadedMaxFreq ?? signal.maxFreq;
  const nyquistRate = activeMaxFreq * 2;
  const isSufficient = sampleRate >= nyquistRate - (isWavMode ? nyquistRate * 0.001 : 0.01);

  // Logarithmic slider for WAV (huge frequency range), linear for generated signals
  const wavSliderMin = Math.max(200, nyquistRate * 0.01);
  const wavSliderMax = nyquistRate * 1.25;
  const logToRate = (v) => wavSliderMin * Math.pow(wavSliderMax / wavSliderMin, v / 1000);
  const rateToLog = (r) => 1000 * Math.log(Math.max(r, wavSliderMin) / wavSliderMin) / Math.log(wavSliderMax / wavSliderMin);
  const status = isSufficient ? "converged" : "under";

  const waveColor = isSufficient ? th.accent : th.error;
  const focus = focusHandlers(th.accent);

  const drawCanvas = useCallback((canvas, tStart, tEnd, showLegend, highlightRange) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    const viewDuration = tEnd - tStart;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = th.canvasBg;
    ctx.fillRect(0, 0, W, H);

    const padL = 40, padR = 20, padT = 20, padB = 36;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const midY = padT + plotH / 2;

    const toX = (v) => padL + ((v - tStart) / viewDuration) * plotW;
    const toY = (v) => midY - v * (plotH * 0.4);

    // Grid
    ctx.strokeStyle = th.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, midY);
    ctx.lineTo(W - padR, midY);
    ctx.stroke();
    for (let v = -1; v <= 1; v += 0.5) {
      if (v === 0) continue;
      ctx.beginPath();
      ctx.moveTo(padL, toY(v));
      ctx.lineTo(W - padR, toY(v));
      ctx.stroke();
    }

    // Time grid — pick a nice step for the view duration
    const rawStep = viewDuration / 6;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const nice = [1, 2, 5, 10].find(n => n * mag >= rawStep) * mag;
    const gridStart = Math.ceil(tStart / nice) * nice;
    for (let tt = gridStart; tt <= tEnd + nice * 0.001; tt += nice) {
      ctx.beginPath();
      ctx.moveTo(toX(tt), padT);
      ctx.lineTo(toX(tt), H - padB);
      ctx.stroke();
    }

    // Time labels
    ctx.fillStyle = th.textFaintest;
    ctx.font = `10px ${FONT_STACK}`;
    ctx.textAlign = "center";
    const useMs = viewDuration < 0.5;
    for (let tt = gridStart; tt <= tEnd + nice * 0.001; tt += nice) {
      const label = useMs ? (tt * 1000).toFixed(1) + "ms" : tt.toFixed(2) + "s";
      ctx.fillText(label, toX(tt), H - padB + 14);
    }

    // Highlight zoom selection on overview canvas
    if (highlightRange) {
      const [hStart, hEnd] = highlightRange;
      const x0 = toX(hStart);
      const x1 = toX(hEnd);
      ctx.fillStyle = th.accent + "18";
      ctx.fillRect(x0, padT, x1 - x0, plotH);
      ctx.strokeStyle = th.accent + "66";
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, padT, x1 - x0, plotH);
    }

    const evaluate = evaluatorRef.current || makeEvaluator(signal);

    // Original waveform
    const step = viewDuration / (plotW * 2);
    ctx.beginPath();
    ctx.strokeStyle = th.originalWave;
    ctx.lineWidth = 3;
    for (let tt = tStart; tt <= tEnd; tt += step) {
      const x = toX(tt);
      const y = toY(evaluate(tt));
      tt === tStart ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Sampling and reconstruction
    const samplePeriod = 1 / sampleRate;
    const SINC_WINDOW = 64;
    const firstSample = Math.floor(tStart / samplePeriod);
    const lastSample = Math.ceil(tEnd / samplePeriod);
    const margin = SINC_WINDOW;
    const startSample = firstSample - margin;
    const endSample = lastSample + margin;
    const sampleValues = new Float32Array(endSample - startSample + 1);
    for (let ii = startSample; ii <= endSample; ii++) {
      sampleValues[ii - startSample] = evaluate(ii * samplePeriod);
    }

    const reconstruct = (tt) => {
      const center = tt / samplePeriod;
      const lo = Math.max(startSample, Math.floor(center) - SINC_WINDOW);
      const hi = Math.min(endSample, Math.ceil(center) + SINC_WINDOW);
      let val = 0;
      for (let ii = lo; ii <= hi; ii++) {
        val += sampleValues[ii - startSample] * sinc((tt - ii * samplePeriod) / samplePeriod);
      }
      return val;
    };

    const canvasWaveColor = isSufficient ? th.accent : th.error;
    ctx.beginPath();
    ctx.strokeStyle = canvasWaveColor;
    ctx.lineWidth = 2;
    for (let tt = tStart; tt <= tEnd; tt += step) {
      const x = toX(tt);
      const y = toY(reconstruct(tt));
      tt === tStart ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Sample dots — only when sparse enough to see
    const numInView = Math.floor(viewDuration / samplePeriod) + 1;
    if (numInView <= Math.floor(plotW / 4)) {
      const visStart = Math.max(0, firstSample);
      const visEnd = lastSample;
      for (let ii = visStart; ii <= visEnd; ii++) {
        const tt = ii * samplePeriod;
        if (tt < tStart || tt > tEnd) continue;
        const x = toX(tt);
        const y = toY(evaluate(tt));
        ctx.beginPath();
        ctx.strokeStyle = th.stemColor;
        ctx.lineWidth = 1;
        ctx.moveTo(x, midY);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = th.dotFill;
        ctx.strokeStyle = canvasWaveColor;
        ctx.lineWidth = 2;
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Legend
    if (showLegend) {
      ctx.font = `12px ${FONT_STACK}`;
      ctx.textAlign = "left";
      const legX = padL + 12;
      const legY = padT + 16;
      ctx.fillStyle = th.originalWave;
      ctx.fillRect(legX - 16, legY - 4, 10, 3);
      ctx.fillStyle = th.legendText;
      ctx.fillText(loc.legendOriginal, legX, legY);
      ctx.fillStyle = canvasWaveColor;
      ctx.fillRect(legX - 16, legY + 16, 10, 3);
      ctx.fillStyle = th.legendText;
      ctx.fillText(loc.legendReconstructed, legX, legY + 20);
    }
  }, [signal, sampleRate, isSufficient, th, loc]);

  const drawMap = useCallback((canvas) => {
    if (!canvas || !fullDuration) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = th.canvasBg;
    ctx.fillRect(0, 0, W, H);

    const padL = 40, padR = 20, padT = 12, padB = 24;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const midY = padT + plotH / 2;

    const toX = (v) => padL + (v / fullDuration) * plotW;
    const toY = (v) => midY - v * (plotH * 0.4);

    // Zero line
    ctx.strokeStyle = th.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, midY);
    ctx.lineTo(W - padR, midY);
    ctx.stroke();

    // Time labels
    ctx.fillStyle = th.textFaintest;
    ctx.font = `10px ${FONT_STACK}`;
    ctx.textAlign = "center";
    const rawStep = fullDuration / 6;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const nice = [1, 2, 5, 10].find(n => n * mag >= rawStep) * mag;
    for (let tt = 0; tt <= fullDuration + nice * 0.001; tt += nice) {
      ctx.fillText(tt.toFixed(1) + "s", toX(tt), H - padB + 14);
    }

    // Highlight 3s segment region
    const x0 = toX(segmentStart);
    const x1 = toX(Math.min(segmentStart + duration, fullDuration));
    ctx.fillStyle = th.accent + "18";
    ctx.fillRect(x0, padT, x1 - x0, plotH);
    ctx.strokeStyle = th.accent + "66";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, padT, x1 - x0, plotH);

    // Waveform
    const evaluate = evaluatorRef.current;
    if (!evaluate) return;
    const step = fullDuration / (plotW * 2);
    ctx.beginPath();
    ctx.strokeStyle = th.originalWave;
    ctx.lineWidth = 1.5;
    let first = true;
    for (let tt = 0; tt <= fullDuration; tt += step) {
      const x = toX(tt);
      const y = toY(evaluate(tt));
      first ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      first = false;
    }
    ctx.stroke();
  }, [fullDuration, segmentStart, duration, th]);

  const draw = useCallback(() => {
    if (isWavMode) {
      drawMap(mapCanvasRef.current);
      drawCanvas(canvasRef.current, segmentStart, segmentStart + duration, true, zoomRange);
      drawCanvas(zoomCanvasRef.current, zoomRange[0], zoomRange[1], false, null);
    } else {
      drawCanvas(canvasRef.current, 0, duration, true, null);
    }
  }, [drawCanvas, drawMap, duration, isWavMode, segmentStart, zoomRange]);

  useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  // Convert canvas pixel X to a time value within a given range
  const canvasToTime = (canvas, clientX, tStart, tEnd) => {
    const rect = canvas.getBoundingClientRect();
    const padL = 40, padR = 20;
    const plotW = rect.width - padL - padR;
    const relX = clientX - rect.left - padL;
    return Math.max(tStart, Math.min(tEnd, tStart + (relX / plotW) * (tEnd - tStart)));
  };

  // Drag on segment canvas → select zoom range
  const segEnd = segmentStart + duration;
  const onSegMouseDown = (e) => {
    if (!isWavMode) return;
    const t = canvasToTime(canvasRef.current, e.clientX, segmentStart, segEnd);
    segDragRef.current = { dragging: true, startX: t };
  };
  const onSegMouseMove = (e) => {
    if (!segDragRef.current.dragging) return;
    const t = canvasToTime(canvasRef.current, e.clientX, segmentStart, segEnd);
    const s = segDragRef.current.startX;
    const lo = Math.min(s, t);
    const hi = Math.max(s, t);
    if (hi - lo > 0.0001) setZoomRange([lo, hi]);
  };
  const onSegMouseUp = () => { segDragRef.current.dragging = false; };

  // Drag on map canvas → position the 3s segment window
  const onMapMouseDown = (e) => {
    if (!fullDuration) return;
    mapDragRef.current = { dragging: true };
    const t = canvasToTime(mapCanvasRef.current, e.clientX, 0, fullDuration);
    const maxStart = Math.max(0, fullDuration - duration);
    const newStart = Math.max(0, Math.min(maxStart, t - duration / 2));
    setSegmentStart(newStart);
    setZoomRange([newStart, newStart + Math.min(0.2, duration)]);
  };
  const onMapMouseMove = (e) => {
    if (!mapDragRef.current.dragging || !fullDuration) return;
    const t = canvasToTime(mapCanvasRef.current, e.clientX, 0, fullDuration);
    const maxStart = Math.max(0, fullDuration - duration);
    const newStart = Math.max(0, Math.min(maxStart, t - duration / 2));
    setSegmentStart(newStart);
    setZoomRange([newStart, newStart + Math.min(0.2, duration)]);
  };
  const onMapMouseUp = () => { mapDragRef.current.dragging = false; };

  const handleFile = async (file) => {
    if (!file) return;
    setUploadState({ status: "processing", fileName: file.name, errorCode: null });
    try {
      const result = await processWavFile(file);
      evaluatorRef.current = makeInterpolatedEvaluator(result.samples, result.sampleRate, result.fullDuration);
      const segDur = Math.min(3, result.fullDuration);
      setFullDuration(result.fullDuration);
      setDuration(segDur);
      setSegmentStart(0);
      setZoomRange([0, Math.min(0.2, segDur)]);
      setUploadedMaxFreq(result.maxFreq);
      setUploadedWavInfo({
        originalSampleRate: result.sampleRate,
        originalDuration: result.fullDuration,
      });
      setSampleRate(result.maxFreq * 0.3);
      setUploadState({ status: "loaded", fileName: result.fileName, errorCode: null });
    } catch (err) {
      evaluatorRef.current = null;
      setUploadedMaxFreq(null);
      setUploadedWavInfo(null);
      const code = err instanceof WavError ? err.code : "CORRUPT";
      setUploadState({ status: "error", fileName: file.name, errorCode: code });
    }
  };

  const clearUpload = () => {
    evaluatorRef.current = null;
    setUploadedMaxFreq(null);
    setUploadedWavInfo(null);
    setUploadState({ status: "idle", fileName: null, errorCode: null });
    setFullDuration(null);
    setSegmentStart(0);
    setDuration(3);
    setSampleRate(4);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const randomize = () => {
    clearUpload();
    setSignal(generateSignal());
  };

  const statusColor = isSufficient ? th.success : th.error;
  const statusBg = isSufficient ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)";
  const statusBorder = isSufficient ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)";

  const smallBtn = {
    padding: "4px 10px",
    background: "transparent",
    border: `1px solid ${th.btnBorder}`,
    borderRadius: 4,
    color: th.textFaint,
    fontSize: 11,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.2s",
    lineHeight: "1.4",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div style={{
      background: th.bg,
      minHeight: "100vh",
      color: th.text,
      fontFamily: FONT_STACK,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "24px 16px",
      transition: "background 0.3s, color 0.3s",
    }}>
      <div style={{ maxWidth: 800, width: "100%" }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        }}>
          <h1 style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "0.05em",
            color: th.accent,
            margin: 0,
          }}>
            {loc.title}
          </h1>
          <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12 }}>
            <button
              onClick={() => setLang(lang === "en" ? "fi" : "en")}
              aria-label={lang === "en" ? loc.langFi : loc.langEn}
              style={smallBtn}
              {...focus}
            >
              {lang === "en" ? "FI" : "EN"}
            </button>
            <button
              onClick={() => setMode(mode === "dark" ? "light" : "dark")}
              aria-label={mode === "dark" ? loc.themeLight : loc.themeDark}
              style={smallBtn}
              {...focus}
            >
              {mode === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
        <p style={{
          fontSize: 13,
          color: th.textFaint,
          marginBottom: 16,
          lineHeight: 1.6,
        }}>
          {loc.subtitle}
        </p>

        {/* Upload zone */}
        {uploadState.status === "loaded" ? (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            marginBottom: 16,
            border: `1px solid ${th.border}`,
            borderRadius: 6,
            fontSize: 12,
            color: th.textMuted,
            fontFamily: "inherit",
          }}>
            <span style={{ color: th.accent, fontWeight: 500 }}>{uploadState.fileName}</span>
            {uploadedWavInfo && (
              <span style={{ color: th.textFaintest, fontSize: 11, marginLeft: 8 }}>
                {(uploadedWavInfo.originalSampleRate / 1000).toFixed(1)} kHz &middot; {uploadedWavInfo.originalDuration.toFixed(1)}s
              </span>
            )}
            <span style={{ flex: 1 }} />
            <button
              onClick={clearUpload}
              aria-label={loc.uploadClear || "Clear uploaded file"}
              style={{
                background: "transparent",
                border: "none",
                color: th.textFaint,
                cursor: "pointer",
                fontSize: 14,
                padding: "2px 6px",
                borderRadius: 4,
                fontFamily: "inherit",
                lineHeight: 1,
              }}
              {...focus}
            >
              &times;
            </button>
          </div>
        ) : (
          <label
            htmlFor="wav-upload"
            onDragEnter={(e) => { e.preventDefault(); setUploadState((s) => ({ ...s, status: "drag-active" })); }}
            onDragOver={(e) => { e.preventDefault(); }}
            onDragLeave={(e) => { e.preventDefault(); setUploadState((s) => s.status === "drag-active" ? { ...s, status: "idle" } : s); }}
            onDrop={(e) => { e.preventDefault(); setUploadState((s) => ({ ...s, status: "idle" })); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 44,
              padding: "12px 16px",
              marginBottom: 16,
              border: `2px dashed ${uploadState.status === "drag-active" ? th.accent : uploadState.status === "error" ? th.error : th.border}`,
              borderRadius: 8,
              background: uploadState.status === "drag-active" ? (mode === "dark" ? "rgba(245,158,11,0.06)" : "rgba(180,83,9,0.06)") : "transparent",
              cursor: uploadState.status === "processing" ? "default" : "pointer",
              transition: "border-color 0.2s, background 0.2s",
              fontFamily: "inherit",
            }}
          >
            <input
              ref={fileInputRef}
              id="wav-upload"
              type="file"
              accept=".wav,audio/wav,audio/x-wav,audio/wave"
              onChange={(e) => { const f = e.target.files[0]; if (f) handleFile(f); }}
              disabled={uploadState.status === "processing"}
              aria-label={loc.uploadAriaLabel || "Upload a WAV file"}
              style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
            />
            {uploadState.status === "processing" ? (
              <span style={{ fontSize: 12, color: th.textMuted }}>{loc.uploadProcessing || "Decoding WAV\u2026"}</span>
            ) : uploadState.status === "error" ? (
              <span style={{ fontSize: 12, color: th.errorText }}>
                {loc[`err_${uploadState.errorCode}`] || loc.errCorrupt || "Could not read this file."}
                {" "}
                <span style={{ color: th.textFaint }}>{loc.uploadRetry || "Try another file."}</span>
              </span>
            ) : (
              <span style={{ fontSize: 12, color: th.textFaint }}>{loc.uploadPrompt || "Drop a WAV file here or click to browse"}</span>
            )}
          </label>
        )}

        {isWavMode && (
          <canvas
            ref={mapCanvasRef}
            role="img"
            aria-label={`Full audio overview. ${fullDuration?.toFixed(1)}s total.`}
            onMouseDown={onMapMouseDown}
            onMouseMove={onMapMouseMove}
            onMouseUp={onMapMouseUp}
            onMouseLeave={onMapMouseUp}
            style={{
              width: "100%",
              height: 120,
              borderRadius: 8,
              border: `1px solid ${th.border}`,
              marginBottom: 12,
              cursor: "pointer",
            }}
          />
        )}

        <canvas
          ref={canvasRef}
          role="img"
          aria-label={
            (uploadState.status === "loaded" ? `Showing uploaded file ${uploadState.fileName}. ` : "") +
            (isSufficient
              ? "Waveform visualization. Perfect reconstruction achieved."
              : "Waveform visualization. Aliasing \u2014 signal cannot be reconstructed.")
          }
          onMouseDown={onSegMouseDown}
          onMouseMove={onSegMouseMove}
          onMouseUp={onSegMouseUp}
          onMouseLeave={onSegMouseUp}
          style={{
            width: "100%",
            height: 320,
            borderRadius: 8,
            border: `1px solid ${th.border}`,
            cursor: isWavMode ? "crosshair" : "default",
          }}
        />

        {isWavMode && (
          <canvas
            ref={zoomCanvasRef}
            role="img"
            aria-label={`Zoomed view from ${(zoomRange[0] * 1000).toFixed(1)}ms to ${(zoomRange[1] * 1000).toFixed(1)}ms`}
            style={{
              width: "100%",
              height: 320,
              borderRadius: 8,
              border: `1px solid ${th.border}`,
              marginTop: 12,
            }}
          />
        )}

        <div style={{
          marginTop: 24,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}>
          <div
            aria-live="polite"
            aria-atomic="true"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              background: statusBg,
              border: `1px solid ${statusBorder}`,
              borderRadius: 6,
              transition: "all 0.3s ease",
            }}
          >
            <div aria-hidden="true" style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: statusColor,
              boxShadow: `0 0 8px ${statusColor}99`,
              transition: "all 0.3s ease",
            }} />
            <span style={{ fontSize: 11, color: statusColor, fontWeight: 500 }}>
              {loc[status]}
            </span>
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={randomize}
            aria-label={loc.randomize}
            style={{
              padding: "8px 16px",
              background: "transparent",
              border: `1px solid ${th.btnBorder}`,
              borderRadius: 6,
              color: th.textMuted,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = th.accent;
              e.target.style.color = th.accent;
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = th.btnBorder;
              e.target.style.color = th.textMuted;
            }}
            {...focus}
          >
            {loc.randomize}
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
          }}>
            <label htmlFor="sample-rate-slider" style={{ fontSize: 12, color: th.textMuted }}>
              {loc.sampleRate}: <span style={{ color: th.accent, fontWeight: 600 }}>{formatHz(sampleRate)}</span>
            </label>
            <span style={{ fontSize: 11, color: th.textFaintest }}>
              f<sub>max</sub> = {formatHz(activeMaxFreq)} &rarr; {loc.nyquistLabel} = {formatHz(nyquistRate)}
            </span>
          </div>
          {isWavMode ? (
            <input
              id="sample-rate-slider"
              type="range"
              min={0}
              max={1000}
              step={1}
              value={rateToLog(sampleRate)}
              onChange={(e) => setSampleRate(logToRate(parseFloat(e.target.value)))}
              aria-valuetext={formatHz(sampleRate)}
              style={{ width: "100%", accentColor: th.accent, cursor: "pointer" }}
              {...focus}
            />
          ) : (
            <input
              id="sample-rate-slider"
              type="range"
              min={1}
              max={40}
              step={0.2}
              value={sampleRate}
              onChange={(e) => setSampleRate(parseFloat(e.target.value))}
              aria-valuetext={`${sampleRate.toFixed(1)} Hz`}
              style={{ width: "100%", accentColor: th.accent, cursor: "pointer" }}
              {...focus}
            />
          )}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: th.textFaintest,
            marginTop: 4,
          }}>
            <span>{isWavMode ? formatHz(wavSliderMin) : "1 Hz"}</span>
            <span style={{
              color: !isSufficient ? th.accent : `${th.success}44`,
              fontWeight: !isSufficient ? 600 : 400,
              transition: "all 0.3s",
            }}>
              <span aria-hidden="true">&#9650;</span> {formatHz(nyquistRate)} (Nyquist)
            </span>
            <span>{isWavMode ? formatHz(wavSliderMax) : "40 Hz"}</span>
          </div>
        </div>

        <div style={{
          marginTop: 24,
          padding: 16,
          background: th.infoBg,
          border: `1px solid ${th.border}`,
          borderRadius: 8,
          fontSize: 13,
          color: th.textFaint,
          lineHeight: 1.75,
          transition: "background 0.3s",
        }}>
          <div>
            <span style={{ color: th.textMuted }}>{loc.infoGray}</span>
            {" "}{uploadState.status === "loaded" && uploadedWavInfo
              ? loc.infoSourceUploaded(uploadedWavInfo.originalSampleRate, uploadedWavInfo.originalDuration)
              : loc.infoOriginal(signal.components.length, signal.maxFreq.toFixed(1))}
            {" "}<span style={{ color: th.textMuted }}>{loc.infoReconstructed(!isSufficient ? loc.red : loc.orange)}</span>
            {" "}{loc.infoRest(nyquistRate.toFixed(1))}
            {!isSufficient && (
              <span style={{ color: th.errorText }}> {loc.underMsg}</span>
            )}
          </div>
          <div style={{ marginTop: 12, color: th.noteColor, fontSize: 11 }}>
            {loc.note}<sub>max</sub>.
          </div>
        </div>
      </div>
    </div>
  );
}
