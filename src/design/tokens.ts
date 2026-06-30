// ─── COLOR PALETTE ────────────────────────────────────────────────────────────

export const color = {
  // App background
  bg:      '#0a0f1e',
  bgGrad:  'linear-gradient(160deg,#0a0f1e 0%,#0f172a 60%,#0a1628 100%)',

  // Surface layers (translucent white on dark bg)
  surface0: 'rgba(255,255,255,0.02)',
  surface1: 'rgba(255,255,255,0.03)',
  surface2: 'rgba(255,255,255,0.04)',
  surface3: 'rgba(255,255,255,0.05)',
  surface4: 'rgba(255,255,255,0.07)',

  // Borders
  border0: 'rgba(255,255,255,0.04)',
  border1: 'rgba(255,255,255,0.05)',
  border2: 'rgba(255,255,255,0.07)',
  border3: 'rgba(255,255,255,0.08)',
  border4: 'rgba(255,255,255,0.10)',

  // Text hierarchy
  textWhite:     '#ffffff',
  textPrimary:   '#e2e8f0',
  textSecondary: '#9ca3af',
  textMuted:     '#6b7280',
  textDim:       '#4b5563',
  textFaint:     '#374151',

  // Accent — blue
  accent:          '#3b82f6',
  accentSurface:   'rgba(59,130,246,0.06)',
  accentSurfaceMd: 'rgba(59,130,246,0.20)',
  accentSurfaceLg: 'rgba(59,130,246,0.30)',
  accentBorder:    'rgba(59,130,246,0.15)',
  accentBorderMd:  'rgba(59,130,246,0.30)',
  accentBorderLg:  'rgba(59,130,246,0.50)',
  accentBorderXl:  'rgba(59,130,246,0.60)',
  accentText:      '#93c5fd',

  // Live — red
  live:          '#f87171',
  liveSurface:   'rgba(239,68,68,0.12)',
  liveSurfaceMd: 'rgba(239,68,68,0.15)',
  liveSurfaceLg: 'rgba(239,68,68,0.18)',
  liveBorder:    'rgba(239,68,68,0.35)',
  liveBorderMd:  'rgba(239,68,68,0.40)',
  liveBorderLg:  'rgba(239,68,68,0.60)',
  liveText:      '#fca5a5',

  // Today — amber
  today:          '#fbbf24',
  todaySurface:   'rgba(217,119,6,0.15)',
  todaySurfaceMd: 'rgba(217,119,6,0.20)',
  todayBorder:    'rgba(217,119,6,0.35)',
  todayBorderMd:  'rgba(217,119,6,0.40)',
  todayBorderLg:  'rgba(217,119,6,0.55)',
  todayText:      '#fbbf24',

  // Success — green
  success:        '#4ade80',
  successSurface: 'rgba(74,222,128,0.07)',
  successBorder:  'rgba(74,222,128,0.25)',
  successText:    '#4ade80',

  // Predicted — stone/gray
  pred:        '#a8a29e',
  predSurface: 'rgba(168,162,158,0.06)',
  predBorder:  'rgba(168,162,158,0.22)',
  predText:    '#a8a29e',

  // Warning — yellow cards
  warning:     '#fcd34d',
  warningText: '#fbbf24',

  // Overlays
  overlay:  'rgba(0,0,0,0.20)',
  overlay2: 'rgba(0,0,0,0.35)',
} as const;

// ─── SPACING ──────────────────────────────────────────────────────────────────

export const space = {
  px1: '1px',
  px2: '2px',
  px3: '3px',
  xs:  '4px',
  sm:  '8px',
  md:  '12px',
  lg:  '16px',
  xl:  '24px',
  xxl: '32px',
  // Named aliases for common hardcoded values
  5:   '5px',
  6:   '6px',
  7:   '7px',
  10:  '10px',
  14:  '14px',
  18:  '18px',
} as const;

// ─── BORDER RADIUS ────────────────────────────────────────────────────────────

export const radius = {
  xs:   '3px',
  sm:   '4px',
  md:   '6px',
  lg:   '8px',
  xl:   '10px',
  full: '50%',
} as const;

// ─── TYPOGRAPHY ───────────────────────────────────────────────────────────────

export const fontSize = {
  xxs:  '8px',
  xs:   '9px',
  sm:   '10px',
  base: '11px',
  md:   '12px',
  body: '13px',
  lg:   '14px',
  xl:   '15px',
  '2xl':'18px',
  '3xl':'20px',
  '4xl':'28px',
} as const;

export const fontWeight = {
  normal:    '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
} as const;

export const lineHeight = {
  tight:  '1.2',
  normal: '1.4',
  loose:  '1.7',
} as const;

// ─── Z-INDEX ──────────────────────────────────────────────────────────────────

export const zIndex = {
  base:    0,
  above:   1,
  sticky:  5,
  overlay: 10,
  modal:   20,
} as const;

// ─── ANIMATION ────────────────────────────────────────────────────────────────

export const animation = {
  pulse: 'pulse 1s ease-in-out infinite',
  spin:  'spin 1s linear infinite',
} as const;

// ─── BREAKPOINTS ──────────────────────────────────────────────────────────────

export const breakpoint = {
  content: '768px',
  wide:    '1400px',
} as const;
