# ADR 001: Vite + React + GitHub Pages Architecture

## Status
Accepted

## Context
We need a build setup for an interactive Nyquist-Shannon sampling theorem demo that:
- Runs as a standalone page on GitHub Pages
- Can later be embedded as a React component in other projects
- Will become part of a larger audio education toolkit

## Decision
- **Vite 8** as build tool (Rolldown-powered, fast, trivial static deploys)
- **React 19.2** as UI framework (already in use)
- **Plain JSX** — no TypeScript for now (single-component project)
- **Inline styles** — most portable for embedding, no CSS build dependencies
- **GitHub Actions** for automated deployment to GitHub Pages
- **Demo-first** — standard Vite SPA build now; library mode added later when npm publishing is needed
- **i18n kept internal** to the component

## Consequences
- No SSR, no routing overhead — minimal bundle
- Adding library mode later requires only a second Vite config file, no structural changes
- TypeScript can be adopted incrementally if the toolkit grows
- Inline styles mean no CSS-in-JS runtime or stylesheet conflicts with host apps
