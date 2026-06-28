import type { ComponentChildren, JSX } from 'preact';
import { space } from '../tokens';

type SpaceKey = keyof typeof space;

interface StackProps {
  gap?: SpaceKey;
  children: ComponentChildren;
  style?: JSX.CSSProperties;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
}

export function Stack({ gap = 'sm', children, style, as: Tag = 'div', className }: StackProps) {
  return (
    <Tag
      class={className}
      style={{ display: 'flex', flexDirection: 'column', gap: space[gap], ...style }}
    >
      {children}
    </Tag>
  );
}
