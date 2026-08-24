// Haritaya/küreye sığmayacak kadar uzun resmi adların kısa karşılıkları.
const SHORT_NAMES: Record<string, string> = {
  USA: 'ABD',
  GBR: 'B. Krallık',
  ARE: 'BAE',
  COD: 'DR Kongo',
  CAF: 'Orta Afrika',
  DOM: 'Dominik C.',
  PNG: 'Papua Y. Gine',
  BIH: 'Bosna-Hersek',
  MKD: 'K. Makedonya',
  ZAF: 'G. Afrika',
  PRK: 'K. Kore',
  KOR: 'G. Kore',
  SSD: 'G. Sudan',
  NZL: 'Y. Zelanda',
  TTO: 'Trinidad',
};

/** Harita üstünde yazılacak ad — uzun adlarda kısaltma, yoksa resmi ad. */
export function getMapLabel(code: string, name: string): string {
  return SHORT_NAMES[code] ?? name;
}
