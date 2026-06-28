import { color, radius, space, fontSize, fontWeight } from './tokens';

type CSSProps = Record<string, string | number | undefined>;

// ─── PANEL VARIANTS ───────────────────────────────────────────────────────────

export const panel: Record<string, CSSProps> = {
  base: {
    background: color.surface1,
    border: `1px solid ${color.border2}`,
    borderRadius: radius.lg,
  },
  accent: {
    background: color.accentSurface,
    border: `1px solid ${color.accentBorder}`,
    borderRadius: radius.lg,
  },
  live: {
    background: color.liveSurface,
    border: `1px solid ${color.liveBorder}`,
    borderRadius: radius.lg,
  },
  today: {
    background: color.todaySurface,
    border: `1px solid ${color.todayBorder}`,
    borderRadius: radius.lg,
  },
  success: {
    background: color.successSurface,
    border: `1px solid ${color.successBorder}`,
    borderRadius: radius.lg,
  },
  pred: {
    background: color.predSurface,
    border: `1px solid ${color.predBorder}`,
    borderRadius: radius.lg,
  },
};

// ─── FILTER BUTTON ────────────────────────────────────────────────────────────

export function filterButtonStyle(active: boolean): CSSProps {
  return {
    padding: `${space.xs} ${space.sm}`,
    borderRadius: radius.sm,
    fontSize: fontSize.md,
    background: active ? color.accentSurfaceLg : color.surface3,
    border: `1px solid ${active ? color.accentBorderLg : color.border4}`,
    color: active ? color.accentText : '#94a3b8',
    fontWeight: active ? fontWeight.semibold : fontWeight.normal,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  };
}

// ─── BADGE PILLS ──────────────────────────────────────────────────────────────

export const badgeStyle: Record<string, CSSProps> = {
  pred: {
    fontSize: fontSize.xxs,
    color: color.predText,
    fontFamily: 'monospace',
    background: color.predSurface,
    border: `1px solid ${color.predBorder}`,
    padding: `1px ${space.xs}`,
    borderRadius: radius.xs,
    letterSpacing: '0.3px',
    flexShrink: 0,
    display: 'inline-block',
    lineHeight: '1.4',
  },
  locked: {
    fontSize: fontSize.xxs,
    color: color.successText,
    fontFamily: 'monospace',
    background: color.successSurface,
    border: `1px solid ${color.successBorder}`,
    padding: `1px ${space.xs}`,
    borderRadius: radius.xs,
    letterSpacing: '0.3px',
    flexShrink: 0,
    display: 'inline-block',
    lineHeight: '1.4',
  },
  projected: {
    fontSize: fontSize.xxs,
    color: color.accentText,
    fontFamily: 'monospace',
    background: 'rgba(147,197,253,0.12)',
    border: '1px solid rgba(147,197,253,0.30)',
    padding: `1px ${space.xs}`,
    borderRadius: radius.xs,
    letterSpacing: '0.3px',
    flexShrink: 0,
    display: 'inline-block',
    lineHeight: '1.4',
  },
};

// ─── SECTION LABEL ────────────────────────────────────────────────────────────

export const sectionLabel: CSSProps = {
  fontSize: fontSize.sm,
  fontWeight: fontWeight.semibold,
  color: color.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: space.xs,
};
