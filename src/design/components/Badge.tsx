import type { ComponentChildren } from 'preact';
import { color, fontSize, space, radius } from '../tokens';

export type BadgeVariant =
  | 'live'
  | 'today'
  | 'played'
  | 'upcoming'
  | 'locked'
  | 'projected'
  | 'pred'
  | 'stage'
  | 'neutral';

const VARIANT: Record<BadgeVariant, { bg: string; border: string; text: string }> = {
  live:      { bg: color.liveSurfaceMd,   border: color.liveBorderMd,   text: color.liveText },
  today:     { bg: color.todaySurface,    border: color.todayBorderMd,  text: color.todayText },
  played:    { bg: color.surface1,        border: color.border2,        text: color.textMuted },
  upcoming:  { bg: color.accentSurfaceMd, border: color.accentBorderLg, text: color.accentText },
  locked:    { bg: color.successSurface,  border: color.successBorder,  text: color.successText },
  projected: { bg: 'rgba(147,197,253,0.12)', border: 'rgba(147,197,253,0.30)', text: color.accentText },
  pred:      { bg: color.predSurface,     border: color.predBorder,     text: color.predText },
  stage:     { bg: color.surface2,        border: color.border3,        text: color.textMuted },
  neutral:   { bg: color.surface1,        border: color.border2,        text: color.textSecondary },
};

interface BadgeProps {
  variant: BadgeVariant;
  mono?: boolean;
  children: ComponentChildren;
}

export function Badge({ variant, mono, children }: BadgeProps) {
  const v = VARIANT[variant];
  return (
    <span
      style={{
        fontSize: fontSize.xxs,
        fontFamily: mono ? 'monospace' : 'inherit',
        background: v.bg,
        border: `1px solid ${v.border}`,
        color: v.text,
        padding: `1px ${space.xs}`,
        borderRadius: radius.xs,
        flexShrink: 0,
        letterSpacing: '0.3px',
        display: 'inline-block',
        lineHeight: '1.4',
      }}
    >
      {children}
    </span>
  );
}
