# WC2026 Design Conventions

Dark-first sports tracker. Every design must work on a near-black `#0a0f1e` background.

## Setup — no provider needed
This is a plain HTML/CSS system. No React/Preact provider, no theme wrapper. Drop components directly into a dark `body { background: #0a0f1e; color: #e2e8f0; font-family: system-ui, sans-serif; }`.

## Styling idiom — CSS custom properties
Style via `var(--token)` from `styles.css`. Never hardcode hex values.

Key tokens:
| Token | Use |
|---|---|
| `var(--c-bg)` | Page / panel background (`#0a0f1e`) |
| `var(--c-primary)` | Body text, team names (`#e2e8f0`) |
| `var(--c-muted)` | Timestamps, secondary labels (`#6b7280`) |
| `var(--c-dim)` | Column headers, disabled text (`#4b5563`) |
| `var(--c-accent)` | Active state, advancing highlight (`#3b82f6`) |
| `var(--c-live)` | Live match, error state (`#f87171`) |
| `var(--c-today)` | Today / HT badge (`#fbbf24`) |
| `var(--c-success)` | Final / locked / wins (`#4ade80`) |
| `var(--gap-sm/md/lg/xl)` | 8 / 12 / 16 / 24px spacing |
| `var(--r-sm/md/lg)` | 4 / 8 / 10px border radius |
| `var(--fs-sm/base/md/body/lg)` | 10–14px type scale |

## Surface idiom — transparency, not solid grey
All UI surfaces layer rgba tints on the dark background:
- Panel: `background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);`
- Card: `background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08);`
- Divider: `border-top: 1px solid rgba(255,255,255,0.05);`
- Accent row: `background: rgba(59,130,246,0.06);`
- Live card: `background: rgba(248,113,113,0.04); border-color: rgba(248,113,113,0.35);`

## Animations
Two keyframes in `styles.css`:
- `.pulse` — opacity breathe for live dots
- `.spin` — 360° rotation for loading spinners

## Idiomatic example — a match card
```html
<div style="border-radius:10px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;max-width:400px;">
  <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(255,255,255,0.02);">
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">
      <span style="font-size:26px;">🇧🇷</span>
      <span style="font-size:11px;color:var(--c-primary);font-weight:500;">Brazil</span>
    </div>
    <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:4px;">
      <span style="font-size:13px;color:var(--c-dim);">vs</span>
      <span style="font-size:10px;color:var(--c-muted);">19:00</span>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">
      <span style="font-size:26px;">🇩🇪</span>
      <span style="font-size:11px;color:var(--c-primary);font-weight:500;">Germany</span>
    </div>
  </div>
  <div style="padding:5px 12px;background:rgba(255,255,255,0.02);border-top:1px solid rgba(255,255,255,0.05);font-size:10px;color:var(--c-dim);">
    Group E · MetLife Stadium
  </div>
</div>
```
