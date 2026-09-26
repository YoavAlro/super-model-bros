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
