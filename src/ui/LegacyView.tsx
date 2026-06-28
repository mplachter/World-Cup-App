import { useEffect, useRef } from 'preact/hooks';

interface Props {
  build: () => HTMLElement;
  deps?: unknown[];
  key?: string;
}

export function LegacyView({ build, deps = [] }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    el.appendChild(build());
  }, deps);
  return <div ref={ref} />;
}
