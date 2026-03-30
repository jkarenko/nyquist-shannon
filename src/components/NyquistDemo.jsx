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
  const canvasRef = useRef(null);
  const [signal, setSignal] = useState(() => generateSignal());
  const [sampleRate, setSampleRate] = useState(4);
  const [duration] = useState(3);
  const [lang, setLang] = useState("en");
  const [mode, setMode] = useState("dark");

  const loc = i18n[lang];
  const th = themes[mode];

  const nyquistRate = signal.maxFreq * 2;
  const isSufficient = sampleRate >= nyquistRate - 0.01;
  const status = isSufficient ? "converged" : "under";

  const waveColor = isSufficient ? th.accent : th.error;
  const focus = focusHandlers(th.accent);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

    const padL = 40, padR = 20, padT = 20, padB = 36;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const midY = padT + plotH / 2;

    const toX = (v) => padL + (v / duration) * plotW;
    const toY = (v) => midY - v * (plotH * 0.4);

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
    for (let tt = 0; tt <= duration; tt += 0.5) {
      ctx.beginPath();
      ctx.moveTo(toX(tt), padT);
      ctx.lineTo(toX(tt), H - padB);
      ctx.stroke();
    }

    ctx.fillStyle = th.textFaintest;
    ctx.font = `10px ${FONT_STACK}`;
    ctx.textAlign = "center";
    for (let tt = 0; tt <= duration; tt += 0.5) {
      ctx.fillText(tt.toFixed(1) + "s", toX(tt), H - padB + 14);
    }

    const step = duration / (plotW * 2);
    ctx.beginPath();
    ctx.strokeStyle = th.originalWave;
    ctx.lineWidth = 3;
    for (let tt = 0; tt <= duration; tt += step) {
      const x = toX(tt);
      const y = toY(evalSignal(tt, signal.components));
      tt === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    const samplePeriod = 1 / sampleRate;
    const padSamples = 500;
    const startSample = -padSamples;
    const endSample = Math.ceil(duration / samplePeriod) + padSamples;
    const allSamples = [];
    const allSampleTimes = [];
    for (let ii = startSample; ii <= endSample; ii++) {
      allSampleTimes.push(ii * samplePeriod);
      allSamples.push(evalSignal(ii * samplePeriod, signal.components));
    }

    const reconstructPadded = (tt) => {
      let val = 0;
      for (let ii = 0; ii < allSamples.length; ii++) {
        val += allSamples[ii] * sinc((tt - allSampleTimes[ii]) / samplePeriod);
      }
      return val;
    };

    const canvasWaveColor = isSufficient ? th.accent : th.error;
    ctx.beginPath();
    ctx.strokeStyle = canvasWaveColor;
    ctx.lineWidth = 2;
    for (let tt = 0; tt <= duration; tt += step) {
      const x = toX(tt);
      const y = toY(reconstructPadded(tt));
      tt === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    const numVisible = Math.floor(duration / samplePeriod) + 1;
    for (let ii = 0; ii < numVisible; ii++) {
      const tt = ii * samplePeriod;
      if (tt > duration) break;
      const x = toX(tt);
      const y = toY(evalSignal(tt, signal.components));
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
  }, [signal, sampleRate, duration, isSufficient, th, loc]);

  useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  const randomize = () => setSignal(generateSignal());

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
          marginBottom: 24,
          lineHeight: 1.6,
        }}>
          {loc.subtitle}
        </p>

        <canvas
          ref={canvasRef}
          role="img"
          aria-label={isSufficient
            ? "Waveform visualization. Perfect reconstruction achieved."
            : "Waveform visualization. Aliasing \u2014 signal cannot be reconstructed."}
          style={{
            width: "100%",
            height: 320,
            borderRadius: 8,
            border: `1px solid ${th.border}`,
          }}
        />

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
              {loc.sampleRate}: <span style={{ color: th.accent, fontWeight: 600 }}>{sampleRate.toFixed(1)} Hz</span>
            </label>
            <span style={{ fontSize: 11, color: th.textFaintest }}>
              f<sub>max</sub> = {signal.maxFreq.toFixed(1)} Hz &rarr; {loc.nyquistLabel} = {nyquistRate.toFixed(1)} Hz
            </span>
          </div>
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
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: th.textFaintest,
            marginTop: 4,
          }}>
            <span>1 Hz</span>
            <span style={{
              color: !isSufficient ? th.accent : `${th.success}44`,
              fontWeight: !isSufficient ? 600 : 400,
              transition: "all 0.3s",
            }}>
              <span aria-hidden="true">&#9650;</span> {nyquistRate.toFixed(1)} Hz (Nyquist)
            </span>
            <span>40 Hz</span>
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
            {" "}{loc.infoOriginal(signal.components.length, signal.maxFreq.toFixed(1))}
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
