import type { ComponentChildren } from 'preact';
import { sectionLabel } from '../mixins';

interface SectionLabelProps {
  children: ComponentChildren;
  mb?: string;
}

export function SectionLabel({ children, mb }: SectionLabelProps) {
  return (
    <div style={{ ...sectionLabel, marginBottom: mb ?? sectionLabel.marginBottom }}>
      {children}
    </div>
  );
}
