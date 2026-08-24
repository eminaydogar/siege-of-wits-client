import { District } from '../types';

// PASİF: Kurgu dünya haritasına geçtiği için fetih hedefleri artık dünya
// şehirleri (bkz. data/worldCities.ts + data/targets.ts). Türkiye kurgusuna
// dönülürse bu veri ve DistrictList/DistrictDetail ekranları tekrar bağlanacak.
//
// İlk sürüm için sınırlı sayıda gerçek ilçe verisi.
export const DISTRICTS: District[] = [
  { id: 'ist-kadikoy', name: 'Kadıköy', city: 'İstanbul' },
  { id: 'ist-besiktas', name: 'Beşiktaş', city: 'İstanbul' },
  { id: 'ist-uskudar', name: 'Üsküdar', city: 'İstanbul' },
  { id: 'ist-fatih', name: 'Fatih', city: 'İstanbul' },
  { id: 'ist-sisli', name: 'Şişli', city: 'İstanbul' },
  { id: 'ank-cankaya', name: 'Çankaya', city: 'Ankara' },
  { id: 'ank-kecioren', name: 'Keçiören', city: 'Ankara' },
  { id: 'ank-yenimahalle', name: 'Yenimahalle', city: 'Ankara' },
  { id: 'izm-konak', name: 'Konak', city: 'İzmir' },
  { id: 'izm-karsiyaka', name: 'Karşıyaka', city: 'İzmir' },
  { id: 'izm-bornova', name: 'Bornova', city: 'İzmir' },
  { id: 'brs-nilufer', name: 'Nilüfer', city: 'Bursa' },
  { id: 'brs-osmangazi', name: 'Osmangazi', city: 'Bursa' },
  { id: 'ant-muratpasa', name: 'Muratpaşa', city: 'Antalya' },
  { id: 'ant-konyaalti', name: 'Konyaaltı', city: 'Antalya' },
  { id: 'trz-ortahisar', name: 'Ortahisar', city: 'Trabzon' },
];

export function getDistrictById(id: string): District | undefined {
  return DISTRICTS.find((d) => d.id === id);
}
