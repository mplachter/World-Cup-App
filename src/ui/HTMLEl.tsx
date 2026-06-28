import { useEffect, useRef } from 'preact/hooks';

interface Props {
  factory: () => HTMLElement | null | undefined;
}

export function HTMLEl({ factory }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    const child = factory();
    if (child) el.appendChild(child);
  }, [factory]);
  return <div ref={ref} />;
}
