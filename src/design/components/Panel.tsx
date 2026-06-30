import type { ComponentChildren } from 'preact';
import { panel } from '../mixins';
import { space } from '../tokens';

export type PanelVariant = 'base' | 'accent' | 'live' | 'today' | 'success' | 'pred';

interface PanelProps {
  variant?: PanelVariant;
  padding?: string;
  children: ComponentChildren;
  style?: Record<string, string | number | undefined>;
}

export function Panel({ variant = 'base', padding = space.md, children, style }: PanelProps) {
  return <div style={{ ...panel[variant], padding, overflow: 'hidden', ...style }}>{children}</div>;
}
