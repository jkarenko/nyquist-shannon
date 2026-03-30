# Implementation Plan: WAV File Upload for Custom Waveform Visualization

## Overview

Add WAV file upload support to `NyquistDemo.jsx` so users can visualize how the Nyquist-Shannon theorem applies to their own audio. The uploaded signal replaces the generated sinusoid signal and must integrate seamlessly with the existing canvas `draw()` pipeline, sample rate slider, and i18n system — all without introducing new dependencies.

## Prerequisites

- [ ] Understand the current signal evaluation contract: `evalSignal(t, components)` is called at arbitrary time `t` throughout `draw()` — any uploaded signal must satisfy the same interface
- [ ] Confirm `AudioContext` / `decodeAudioData` is available in all target browsers (Chromium, Firefox, Safari — all supported without polyfill)
- [ ] No new npm dependencies may be added

---

## Task Breakdown

### Phase 1: Signal Evaluation Abstraction

Make the evaluation layer polymorphic so `draw()` can call a single function regardless of signal source.

| ID | Task | Size | Depends On | Parallel? |
|----|------|------|------------|-----------|
| T1 | Extract `evalSignal` to a generic `makeEvaluator(signal)` factory that returns a `(t) => number` closure | S | — | No |
| T2 | Refactor all `evalSignal(tt, signal.components)` call sites in `draw()` to use the evaluator returned by `makeEvaluator` | S | T1 | No |
| T3 | Add `makeInterpolatedEvaluator(samples, sampleRate, duration)` that returns a linear-interpolating `(t) => number` closure over a `Float32Array` | M | T1 | Yes (with T2) |

**Implementation notes for T1/T2:**

`makeEvaluator` will initially just wrap the existing logic:
```js
const makeEvaluator = ({ components }) =>
  (t) => evalSignal(t, components);
```
After T3 exists, `draw()` only ever calls the returned closure — no other changes to draw logic are needed.

**Implementation notes for T3:**

Linear interpolation between adjacent samples in the Float32Array is sufficient for visual purposes. The evaluator clamps out-of-bounds `t` to the nearest edge sample.

**Size key**: XS (trivial), S (< 50 lines), M (< 200 lines), L (< 500 lines), XL (> 500 lines)

---

### Phase 2: WAV Decode and Processing Pipeline

Convert raw WAV bytes into a `Float32Array` that fits the demo's 3-second, normalized amplitude window.

| ID | Task | Size | Depends On | Parallel? |
|----|------|------|------------|-----------|
| T4 | Write `decodeWav(arrayBuffer)` async function using `AudioContext.decodeAudioData` — returns `{ samples: Float32Array, originalSampleRate: number, channelCount: number }` | S | — | Yes (with T3) |
| T5 | Write `extractSegment(decoded, targetDuration)` — takes first channel, slices to 3 s (or pads with zeros if shorter than 1 s), returns raw segment Float32Array | S | T4 | No |
| T6 | Write `normalizeAmplitude(samples)` — peak-normalizes to ±0.8 range; throws `SilenceError` if peak < 1e-6 | XS | T5 | No |
| T7 | Write `estimateMaxFreq(samples, originalSampleRate)` — uses zero-crossing rate as a lightweight proxy for dominant frequency content; maps result into 0.5–5 Hz visual range; returns `{ maxFreq, evalSampleRate }` where `evalSampleRate` is the sample rate for the interpolation evaluator (target: ~300 samples over 3 s, so 100 Hz) | M | T5 | No |
| T8 | Compose T4–T7 into `processWavFile(file)` async pipeline that returns `{ samples, evalSampleRate, maxFreq }` or throws a typed error | S | T4, T5, T6, T7 | No |

**Notes on T7 — frequency mapping:**

The zero-crossing rate gives an estimate of the dominant cycle rate in the raw audio. Map this non-linearly into the demo's 0.5–5 Hz range (e.g., log-scale mapping from ZCR → visual Hz) so the resulting waveform has visually interesting variation. The exact mapping can be tuned; what matters is that `maxFreq` is always in `[0.5, 5]`. `evalSampleRate` is fixed at 100 Hz (300 samples over 3 s) regardless of the original file's sample rate.

**Typed errors for T8:**

```js
class WavError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
// codes: WRONG_TYPE, TOO_SHORT, SILENCE, CORRUPT, NO_AUDIO_CONTEXT
```

---

### Phase 3: Upload State Management

Add the upload-related state to `NyquistDemo` and wire the processing pipeline.

| ID | Task | Size | Depends On | Parallel? |
|----|------|------|------------|-----------|
| T9 | Add `uploadState` state variable with shape `{ status: 'idle' \| 'drag-active' \| 'processing' \| 'loaded' \| 'error', fileName: string \| null, errorCode: string \| null }` | XS | — | No |
| T10 | Add `uploadedEvaluator` ref (`useRef(null)`) and `uploadedMaxFreq` state to hold the decoded signal's evaluator closure and detected max frequency | XS | T3 | No |
| T11 | Write `handleFile(file)` async handler: validates MIME/extension, calls `processWavFile`, on success sets `uploadedEvaluator`, adjusts `signal.maxFreq`, resets `sampleRate` to 1 Hz, sets `uploadState.status = 'loaded'`; on error sets `uploadState.status = 'error'` with appropriate `errorCode` | M | T8, T9, T10 | No |
| T12 | Modify `randomize` handler to also clear `uploadedEvaluator`, reset `uploadState` to idle, and restore slider range to default | XS | T11 | No |
| T13 | Modify `draw()` / evaluator selection: when `uploadedEvaluator.current` is set, pass it directly; otherwise use `makeEvaluator(signal)` — this is the single branch that gates all draw behavior | S | T2, T10 | No |
| T14 | Modify slider: when `uploadedMaxFreq` is set, use it as `maxFreq` for Nyquist calculation and for the slider's displayed range cap (max stays at `Math.max(40, uploadedMaxFreq * 2 + 2)` to keep the scale meaningful) | S | T10 | No |

---

### Phase 4: Upload Zone UI

Inline upload zone between the subtitle paragraph and the canvas, inside the existing `maxWidth: 800` container div.

| ID | Task | Size | Depends On | Parallel? |
|----|------|------|------------|-----------|
| T15 | Build idle/drag-active state UI: hidden `<input type="file" accept=".wav">` with `id="wav-upload"`, styled `<label>` acting as drop target, 44 px min tap height, dashed border, inner text with keyboard hint | M | T9 | No |
| T16 | Add drag-and-drop handlers (`onDragEnter`, `onDragOver`, `onDragLeave`, `onDrop`) to the label element; update `uploadState.status` to `'drag-active'` on enter/over, `'idle'` on leave, call `handleFile` on drop | S | T11, T15 | No |
| T17 | Build processing state UI: spinner (CSS animation, `prefers-reduced-motion` aware — falls back to static dots) inside the zone | S | T15 | No |
| T18 | Build loaded state UI: compact strip showing file name and a small "clear" (x) button; clicking clear calls the reset path from T12 | S | T12, T15 | No |
| T19 | Build error state UI: inline error message inside the zone using `th.errorText` color, with specific message per `errorCode` | S | T15 | No |
| T20 | Add `aria-live="polite"` region (can reuse the existing one already in the component) to announce state transitions; add `aria-label` to the file input; ensure tab order flows naturally (subtitle → upload zone → canvas → controls) | S | T15, T19 | No |

**Note on T15 sizing:** The label doubles as the drag target. Its visual appearance switches based on `uploadState.status` — inline style objects keyed by status avoid any CSS file.

---

### Phase 5: i18n Additions

Extend both `en` and `fi` translation objects with all new strings simultaneously so neither language is ever in a broken state mid-commit.

| ID | Task | Size | Depends On | Parallel? |
|----|------|------|------------|-----------|
| T21 | Add upload-related strings to `i18n.en`: `uploadPrompt`, `uploadDragActive`, `uploadProcessing`, `uploadLoaded`, `uploadClear`, `uploadAriaLabel`, error messages for each `errorCode` (`errWrongType`, `errTooShort`, `errSilence`, `errCorrupt`, `errNoAudioContext`), `infoSourceUploaded` (replaces `infoOriginal` when loaded) | S | — | No |
| T22 | Add Finnish equivalents for all T21 keys to `i18n.fi` | S | T21 | No |
| T23 | Replace hardcoded canvas `aria-label` string with a `loc`-keyed version that also covers the uploaded-signal case | XS | T21, T22 | No |

**Finnish strings note:** The `infoSourceUploaded` key needs a template function like `infoOriginal` — e.g., `(f) => \`on ladattu WAV-signaali (arvioitu korkein taajuus ${f} Hz).\``

---

### Phase 6: Integration Polish and Accessibility

| ID | Task | Size | Depends On | Parallel? |
|----|------|------|------------|-----------|
| T24 | Update info panel: when `uploadedEvaluator` is set, replace the `infoOriginal(n, f)` sentence with `infoSourceUploaded(f)` using the detected max frequency | S | T10, T21 | No |
| T25 | Add `prefers-reduced-motion` check for the spinner animation — use a `window.matchMedia` query at render time and pass a `reduceMotion` boolean down to the spinner | XS | T17 | No |
| T26 | Verify and fix tab order: upload label must come before canvas in DOM order; add `tabIndex={0}` + `onKeyDown` (Enter/Space triggers file picker) to the label | XS | T15, T20 | No |
| T27 | Manual accessibility audit pass: check aria-live fires correctly on status transitions, screen-reader label on file input, contrast of error/loaded strip against both dark and light `th` palettes | S | T19, T20, T24 | No |

---

## Dependency Graph

```
T1 ──── T2 ──────────────────────────────────────── T13
         \                                           /
T3 ──────────────────────────────── T10 ────────────
                                     \
T4 ──── T5 ──┬── T6 ──┬── T8 ──── T11 ── T12 ── T18
              \        \              \
               T7 ──────┘             T9 ──┬── T15 ──┬── T16
                                            |          \── T17 ── T25
T21 ── T22 ── T23                           |          \── T19
                                            T14        \── T20 ── T26 ── T27
                                    T24 (T10 + T21)
```

---

## Parallel Execution Groups

After each gate task completes, the following can proceed concurrently:

1. **Group 1** (independent start): T1, T4, T9, T21
2. **Group 2** (after T1): T2 and T3 in parallel
3. **Group 3** (after T4): T5 (then T6 and T7 in parallel from T5)
4. **Group 4** (after T2, T3, T9): T10 and T13 setup; after T8: T11
5. **Group 5** (after T11, T15): T16, T17, T18, T19 all in parallel
6. **Group 6** (after T21): T22 immediately; T23 after T22; T24 after T22 + T10
7. **Group 7** (after T15, T20): T26; after T17: T25; after T19+T20+T24: T27

---

## Risk Areas

| Task | Risk | Mitigation |
|------|------|------------|
| T7 | Zero-crossing rate is a noisy frequency estimator; very percussive or broadband signals may produce unstable `maxFreq` values | Clamp result hard to `[0.5, 5]`; add smoothing (median over rolling windows). Accept that "maxFreq" is an approximation for a visual demo, not a precise measurement |
| T3 | Linear interpolation of a very short `Float32Array` (300 samples) sampled at many points may produce visually blocky original waveform | Use cubic Hermite spline interpolation as fallback if linear looks bad. Or upsample to 3000 points at decode time |
| T8 | `AudioContext` creation may fail in sandboxed iframes or older browsers | Catch and surface `NO_AUDIO_CONTEXT` error with a clear message; do not crash the rest of the demo |
| T11 | Resetting `sampleRate` to 1 Hz on every new upload may be disorienting if the user has set a deliberate rate | Reset to a value just below `uploadedMaxFreq` (e.g., `uploadedMaxFreq * 1.5`) so they land in the "aliasing" region intentionally — the pedagogically interesting zone |
| T13 | `draw()` is a `useCallback` with a dependency array; adding the evaluator must not cause stale-closure bugs | Include `uploadedEvaluator.current` in the callback's deps, or use a stable ref pattern and call `draw()` imperatively after state settles |

---

## Testing Strategy

This codebase has no test runner currently. Tests should be added alongside implementation using Vitest (already implied by Vite) with zero additional config beyond `vitest` as a dev dependency — but the constraint says no new dependencies. Therefore: write tests as plain functions in a `__tests__/` directory that can be run manually, OR defer to manual browser testing for visual/interaction tasks and focus automated tests only on pure functions.

**Pure functions (can be unit tested without a DOM):**
- `makeInterpolatedEvaluator` (T3): given a known Float32Array, assert interpolated values at exact sample indices equal the source values; assert midpoint interpolation is average of neighbors
- `extractSegment` (T5): test 3-second exact clip, sub-1-second rejection, padding behavior
- `normalizeAmplitude` (T6): test ±0.8 peak normalization, silence detection
- `estimateMaxFreq` (T7): test with a known sine wave's zero-crossing rate maps to expected range
- `processWavFile` error paths (T8): mock `decodeAudioData` to throw; assert correct `WavError` code surfaces

**Integration/manual testing (browser):**
- Upload a real 44.1 kHz WAV, verify waveform appears and slider Nyquist marker moves
- Upload a non-WAV file, verify `errWrongType` message in Finnish and English
- Drag-and-drop a WAV onto the zone, verify drag-active highlight
- Click Randomize after upload, verify zone resets to idle
- Verify canvas aria-label updates on upload
- Verify `prefers-reduced-motion` spinner fallback (DevTools media query emulation)

---

## Commit Points

Logical commits aligned to phases:

1. **After T1, T2, T3**: `refactor(signal): abstract evalSignal into evaluator factory and add interpolated evaluator`
2. **After T4–T8**: `feat(wav): add WAV decode and processing pipeline with typed errors`
3. **After T9–T14**: `feat(wav): wire upload state management and evaluator selection into draw loop`
4. **After T15–T20**: `feat(upload-ui): add inline upload zone with 5 visual states and drag-and-drop`
5. **After T21–T23**: `feat(i18n): add WAV upload strings for English and Finnish`
6. **After T24–T27**: `feat(a11y): integrate upload info panel copy and accessibility polish`
