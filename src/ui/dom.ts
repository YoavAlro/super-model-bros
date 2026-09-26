export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
export const pct = (v: number) => `${Math.round(v * 100)}%`;

/** History stars out of 3 ('★★☆'), or a dash for a level with no result. */
export const stars = (n: number) => (n ? '★'.repeat(n) + '☆'.repeat(3 - n) : '—');
