import { COUNTRY_GEOMETRY } from '../data/worldGlobeGeometry';

const DEG = Math.PI / 180;

// Poligonun içine düşmeyen dokunuşlarda, bu açıdan daha yakın bir kıyısı olan
// ülke seçilir — küçük ülkelere ve kıyı şehirlerine dokunmayı bağışlayıcı yapar.
const NEAR_MISS_DEGREES = 2.2;

interface PickRing {
  /** [lon, lat, lon, lat, ...] */
  points: number[];
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  /** Halka 180. meridyeni geçiyorsa boylamlar 0..360 aralığına kaydırılmıştır. */
  shifted: boolean;
}

interface PickCountry {
  code: string;
  rings: PickRing[];
  /** Kaba çözünürlüklü noktalar — "en yakın ülke" araması için. */
  coarse: number[][];
}

function buildRing(points: number[]): PickRing {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    if (points[i] < minLon) minLon = points[i];
    if (points[i] > maxLon) maxLon = points[i];
    if (points[i + 1] < minLat) minLat = points[i + 1];
    if (points[i + 1] > maxLat) maxLat = points[i + 1];
  }

  // 180. meridyeni geçen halkalar (Rusya'nın Çukotka parçası gibi) düz boylam
  // uzayında dünyanın bir ucundan öbürüne uzanıyormuş gibi görünür; onları
  // 0..360 aralığına kaydırıp öyle test ediyoruz.
  if (maxLon - minLon > 180) {
    const shiftedPoints = points.slice();
    minLon = Infinity;
    maxLon = -Infinity;
    for (let i = 0; i < shiftedPoints.length; i += 2) {
      if (shiftedPoints[i] < 0) shiftedPoints[i] += 360;
      if (shiftedPoints[i] < minLon) minLon = shiftedPoints[i];
      if (shiftedPoints[i] > maxLon) maxLon = shiftedPoints[i];
    }
    return { points: shiftedPoints, minLon, maxLon, minLat, maxLat, shifted: true };
  }

  return { points, minLon, maxLon, minLat, maxLat, shifted: false };
}

const PICK_COUNTRIES: PickCountry[] = COUNTRY_GEOMETRY.map((geometry) => ({
  code: geometry.code,
  rings: geometry.rings.map(buildRing),
  coarse: geometry.coarseRings,
}));

/** Işın atma: nokta halkanın içinde mi? */
function ringContains(ring: PickRing, lon: number, lat: number): boolean {
  const x = ring.shifted && lon < 0 ? lon + 360 : lon;
  if (x < ring.minLon || x > ring.maxLon || lat < ring.minLat || lat > ring.maxLat) {
    return false;
  }

  const p = ring.points;
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i];
    const yi = p[i + 1];
    const xj = p[j];
    const yj = p[j + 1];
    if (yi > lat !== yj > lat && x < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Ekrandaki bir dokunuşu kürenin üzerindeki enlem/boylama çevirir.
 * Küre diskinin dışına düşen dokunuşlarda null döner.
 */
export function unprojectGlobe(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number,
  lambda: number,
  phi: number
): { lon: number; lat: number } | null {
  if (radius <= 0) return null;
  const x = (px - cx) / radius;
  const y = -(py - cy) / radius;
  const r2 = x * x + y * y;
  if (r2 > 1) return null;
  const z = Math.sqrt(1 - r2);

  // Çizimin tersi: önce eğimi (phi), sonra dönüşü (lambda) geri al.
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  const y1 = y * cosP + z * sinP;
  const z1 = -y * sinP + z * cosP;

  const cosL = Math.cos(lambda);
  const sinL = Math.sin(lambda);
  const x0 = x * cosL + z1 * sinL;
  const z0 = -x * sinL + z1 * cosL;

  return {
    lon: Math.atan2(x0, z0) / DEG,
    lat: Math.asin(Math.max(-1, Math.min(1, y1))) / DEG,
  };
}

/**
 * Enlem/boylamın düştüğü ülkeyi bulur. Hiçbir ülkenin içine düşmüyorsa
 * (kıyı payı, küçük adalar) NEAR_MISS_DEGREES kadar yakındaki ülkeyi döndürür.
 */
export function pickCountry(lon: number, lat: number): string | null {
  for (const country of PICK_COUNTRIES) {
    // Halkalar tek tek değil, tek/çift sayılarak değerlendirilir: Güney Afrika'nın
    // içindeki Lesotho deliği hem dış halkanın hem deliğin içinde kaldığı için
    // çift sayılır ve Güney Afrika'ya değil, Lesotho'ya gider.
    let crossings = 0;
    for (const ring of country.rings) {
      if (ringContains(ring, lon, lat)) crossings++;
    }
    if (crossings % 2 === 1) return country.code;
  }

  // Yakın ıska: enlem farkı doğrudan, boylam farkı enlem kosinüsüyle daralır.
  const cosLat = Math.cos(lat * DEG);
  let bestCode: string | null = null;
  let bestDistance = NEAR_MISS_DEGREES;

  for (const country of PICK_COUNTRIES) {
    for (const ring of country.coarse) {
      for (let i = 0; i < ring.length; i += 2) {
        let dLon = ring[i] - lon;
        if (dLon > 180) dLon -= 360;
        else if (dLon < -180) dLon += 360;
        const dx = dLon * cosLat;
        const dy = ring[i + 1] - lat;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCode = country.code;
        }
      }
    }
  }

  return bestCode;
}
