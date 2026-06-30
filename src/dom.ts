import type { Children } from './types';

export type Attrs = Record<string, unknown> | null | undefined;

export const ce = (tag: string, attrs?: Attrs, ...children: Children[]): HTMLElement => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function')
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'className') el.className = v as string;
    else if (k === 'id') el.id = v as string;
    else if (k === 'value') (el as HTMLInputElement).value = v as string;
    else if (k !== 'key') el.setAttribute(k, String(v));
  }
  for (const ch of (children as unknown[]).flat(Infinity)) {
    if (ch == null || ch === false) continue;
    el.appendChild(
      typeof ch === 'string' || typeof ch === 'number'
        ? document.createTextNode(String(ch))
        : (ch as Node),
    );
  }
  return el;
};

export const div = (a: Attrs, ...c: Children[]) => ce('div', a, ...c);
export const span = (a: Attrs, ...c: Children[]) => ce('span', a, ...c);
export const btn = (a: Attrs, ...c: Children[]) => ce('button', a, ...c);
export const inp = (a: Attrs) => ce('input', a) as HTMLInputElement;

export const svg = (attrs: Attrs, ...c: Children[]) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
  (c as unknown[]).flat().forEach((ch) => {
    if (ch) el.appendChild(ch as Node);
  });
  return el;
};

export const path = (attrs: Attrs) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
  return el;
};
