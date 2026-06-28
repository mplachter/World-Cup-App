import { color, animation } from '../tokens';

type DotSize = 'sm' | 'md';

const SIZE: Record<DotSize, string> = { sm: '5px', md: '7px' };

interface StatusDotProps {
  live?: boolean;
  size?: DotSize;
}

export function StatusDot({ live = true, size = 'md' }: StatusDotProps) {
  const px = SIZE[size];
  return (
    <div
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        background: live ? color.live : color.textMuted,
        flexShrink: 0,
        animation: live ? animation.pulse : undefined,
        display: 'inline-block',
      }}
    />
  );
}
