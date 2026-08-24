export interface Continent {
  id: string;
  name: string;
  /** Kıtanın haritadaki taban rengi; ülkeler bu tonun hafif varyasyonlarıyla boyanır. */
  color: string;
}

// Kıta kimlikleri worldCountryPaths.ts içindeki `continent` alanıyla birebir aynı.
// (Üretici script iso.json'daki region/sub-region alanlarından bu kimlikleri türetir.)
export const WORLD_CONTINENTS: Continent[] = [
  { id: 'avrupa', name: 'Avrupa', color: '#6BA9D8' },
  { id: 'asya', name: 'Asya', color: '#E6C260' },
  { id: 'afrika', name: 'Afrika', color: '#F2A25A' },
  { id: 'kuzey-amerika', name: 'Kuzey Amerika', color: '#7CBC63' },
  { id: 'latin-amerika', name: 'Latin Amerika', color: '#5FC5A6' },
  { id: 'okyanusya', name: 'Okyanusya', color: '#AC8AD4' },
  { id: 'diger', name: 'Diğer', color: '#E4867A' },
];

const BY_ID: Record<string, Continent> = WORLD_CONTINENTS.reduce(
  (acc, continent) => {
    acc[continent.id] = continent;
    return acc;
  },
  {} as Record<string, Continent>
);

export function getContinent(id: string): Continent | undefined {
  return BY_ID[id];
}

export function getContinentColor(id: string): string {
  return BY_ID[id]?.color ?? BY_ID.diger.color;
}
