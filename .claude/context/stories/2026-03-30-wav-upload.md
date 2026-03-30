# WAV File Upload for Custom Waveform Visualization

**Session**: pof-w8b3
**Date**: 2026-03-30
**Status**: Completed

## Story
- **Who**: User (audio professional)
- **What**: Upload a WAV file to visualize how Nyquist-Shannon sampling theorems apply to their own waveform
- **Why**: To see the theorems demonstrated on real-world audio, not just generated signals

## Acceptance Criteria
- [x] User can upload a WAV file via the UI
- [x] Uploaded waveform is decoded and displayed
- [x] Sampling/reconstruction visualizations apply to the uploaded waveform
- [x] Invalid files are handled gracefully with clear feedback

## Implementation
- Signal evaluation abstracted into factory pattern (makeEvaluator + makeInterpolatedEvaluator)
- WAV decode pipeline: AudioContext.decodeAudioData → extractSegment → normalizeAmplitude → estimateMaxFreq → downsampleForEval
- Inline upload zone with drag-and-drop, 5 visual states
- Typed error handling (WavError) with specific messages per failure mode
- Full EN/FI i18n for all upload strings
- Dynamic slider range, accessible UI with aria-live announcements
