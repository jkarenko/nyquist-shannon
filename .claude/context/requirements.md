# Requirements: Nyquist-Shannon Interactive Demo

## Overview
Interactive educational demo visualizing the Nyquist-Shannon Sampling Theorem. Part of a broader toolkit for audio education and debunking audio myths (e.g., "analog is superior to digital").

## Target Audience
Audio professionals who are at risk of or already believe pseudoscientific claims about analog vs. digital audio.

## Functional Requirements
- Interactive canvas visualization of bandlimited signals and sinc-interpolated reconstruction
- Adjustable sample rate slider showing aliasing vs. perfect reconstruction
- Randomize signal button
- Status indicator (perfect reconstruction vs. aliasing)
- Dark/light theme toggle
- English/Finnish language toggle
- Educational info panel explaining what's happening

## Non-Functional Requirements
- **Embeddable**: Component must be droppable into any React project
- **Style-agnostic**: Respect host application styling where possible
- **Standalone deployable**: Ships as its own page for GitHub Pages
- **Future-proof**: Will become part of a larger audio education toolkit

## Tech Stack
- React (already chosen)
- Framework: TBD (Vite recommended over Next.js for this use case)
- Deployment: GitHub Pages

## Constraints
- Single component file exists already (nyquist-shannon.jsx)
- Must remain lightweight and self-contained
