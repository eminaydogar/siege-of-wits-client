import { getCityById } from './worldCities';
import { getCountry } from './worldCountryPaths';

/**
 * Fetih hedefi: sınav kazanılınca el değiştiren birim. Şu anki kurguda bu bir
 * dünya şehri; Türkiye kurgusuna geri dönülürse (bkz. data/districts.ts) aynı
 * arayüz ilçeler için de doldurulabilir — Quiz/Result ekranları ve gameStore
 * hedefin ne olduğunu bilmez, sadece id + isim üzerinden çalışır.
 */
export interface ConquestTarget {
  id: string;
  /** Hedefin adı (şehir). */
  name: string;
  /** Bağlı olduğu üst birim (ülke). */
  parentName: string;
}

export function getTarget(id: string): ConquestTarget | undefined {
  const city = getCityById(id);
  if (city) {
    return {
      id: city.id,
      name: city.name,
      parentName: getCountry(city.country)?.name ?? '',
    };
  }

  // Türkiye kurgusuna dönülürse burası açılacak:
  // const district = getDistrictById(id);
  // if (district) return { id: district.id, name: district.name, parentName: district.city };

  return undefined;
}
