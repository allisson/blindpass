const palette = [
  '#7c3aed',
  '#2563eb',
  '#059669',
  '#dc2626',
  '#d97706',
  '#0891b2',
  '#c026d3',
  '#4f46e5',
];

export function vaultColor(vaultId: string): string {
  let h = 0;
  for (let i = 0; i < vaultId.length; i++) h = (h * 31 + vaultId.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
