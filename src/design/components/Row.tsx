import type { ComponentChildren, JSX } from 'preact';
import { space } from '../tokens';

type SpaceKey = keyof typeof space;

interface RowProps {
  gap?: SpaceKey;
  align?: JSX.CSSProperties['alignItems'];
  justify?: JSX.CSSProperties['justifyContent'];
  wrap?: boolean;
  children: ComponentChildren;
  style?: JSX.CSSProperties;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  onClick?: () => void;
}

export function Row({
  gap = 'sm',
  align = 'center',
  justify,
  wrap,
  children,
  style,
  as: Tag = 'div',
  className,
  onClick,
}: RowProps) {
  return (
    <Tag
      class={className}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : undefined,
        gap: space[gap],
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
