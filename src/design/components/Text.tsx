import type { ComponentChildren, JSX } from 'preact';
import { color, fontSize, fontWeight } from '../tokens';

export type TextVariant = 'body' | 'sm' | 'xs' | 'label' | 'heading' | 'mono';

const VARIANT_STYLE: Record<TextVariant, JSX.CSSProperties> = {
  body: { fontSize: fontSize.body, color: color.textPrimary },
  sm: { fontSize: fontSize.base, color: color.textSecondary },
  xs: { fontSize: fontSize.sm, color: color.textMuted },
  label: {
    fontSize: fontSize.sm,
    color: color.textMuted,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  heading: { fontSize: fontSize.lg, color: color.textWhite, fontWeight: fontWeight.bold },
  mono: { fontSize: fontSize.base, color: color.textSecondary, fontFamily: 'monospace' },
};

interface TextProps {
  variant?: TextVariant;
  as?: keyof JSX.IntrinsicElements;
  children: ComponentChildren;
  style?: JSX.CSSProperties;
}

export function Text({ variant = 'body', as: Tag = 'span', children, style }: TextProps) {
  return <Tag style={{ ...VARIANT_STYLE[variant], ...style }}>{children}</Tag>;
}
