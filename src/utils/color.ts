export function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0x00ff) + amt);
  const b = clamp((num & 0x0000ff) + amt);
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

/**
 * İki rengi oranla karıştırır: ratio=0 → a, ratio=1 → b.
 *
 * shadeColor kanallara sabit değer eklediği için koyulaştırırken doygunluğu
 * bozuyor (kırmızı bir renk kararırken yeşil/mavi 0'a çakılıyor). Bir rengin
 * tonunu koruyarak koyu bir zemine çekmek gerektiğinde bu kullanılır.
 */
export function mixColor(a: string, b: string, ratio: number): string {
  const parse = (hex: string) => parseInt(hex.replace('#', ''), 16);
  const na = parse(a);
  const nb = parse(b);
  const t = Math.max(0, Math.min(1, ratio));
  const ch = (shift: number) => {
    const va = (na >> shift) & 0xff;
    const vb = (nb >> shift) & 0xff;
    return Math.round(va + (vb - va) * t);
  };
  return (
    '#' + (0x1000000 + ch(16) * 0x10000 + ch(8) * 0x100 + ch(0)).toString(16).slice(1)
  );
}
