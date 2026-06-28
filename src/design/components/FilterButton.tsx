import type { ComponentChildren } from 'preact';
import { filterButtonStyle } from '../mixins';

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: ComponentChildren;
  style?: Record<string, string | number | undefined>;
}

export function FilterButton({ active, onClick, children, style }: FilterButtonProps) {
  return (
    <button style={{ ...filterButtonStyle(active), ...style }} onClick={onClick}>
      {children}
    </button>
  );
}
