# AntiProcra

Chrome extension that adds friction and time awareness to procrastination sites (Facebook, YouTube).

## What it does

- **5-second blur overlay** on every visit, showing how many times you've been here today
- **10-minute session timer** in a top bar that shifts green → yellow → red → pulsing
- **Bypass button** when time's up (+5 min) so you don't lose in-progress content
- Day resets at 5 AM

## Setup

```bash
pnpm install
pnpm build
```

Load `dist/` as an unpacked extension in `chrome://extensions` (Developer mode).

For development with HMR:

```bash
pnpm dev
```

## Config

Edit `src/shared/config.ts` to change tracked sites, session length, day start hour, etc.
