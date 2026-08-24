// Dünya haritası verisi üreticisi.
//
// Kaynaklar (hepsi açık lisans):
//  - Ülke sınırları : https://github.com/johan/world.geo.json (public domain, Natural Earth türevi)
//  - ISO kodları    : https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes (MIT)
//  - TR ülke adları : https://github.com/umpirsky/country-list (MIT)
//  - Şehirler       : https://download.geonames.org/export/dump/cities15000.zip (CC BY 4.0)
//
// Çalıştırma:  node scripts/generate-world-data.mjs
// cities15000.txt zipten çıkarılıp önbellek klasörüne konmalı (script yolu yazdırır).
// Üretilen dosyalar: src/data/worldCountryPaths.ts, src/data/worldCities.ts

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CACHE = process.env.WORLD_DATA_CACHE ?? path.join(os.tmpdir(), 'fetih-world-data');
const OUT = path.join(process.cwd(), 'src', 'data');

// Harita çıktısının viewBox genişliği; yükseklik coğrafyaya göre hesaplanır.
const MAP_WIDTH = 1000;
// Douglas-Peucker sadeleştirme toleransı (viewBox birimi). Büyütmek dosyayı küçültür,
// kıyıları köşeli yapar. 0.45 ≈ telefonda gözle fark edilmeyen kayıp.
const SIMPLIFY_TOLERANCE = 0.45;
// Bu alandan küçük adacıklar atılır (viewBox birimi kare); ülkenin en büyük parçası daima kalır.
const MIN_RING_AREA = 1.2;
// Küre geometrisinin sadeleştirme toleransları (derece). Kaba olan, parmakla
// döndürürken her karede yeniden projekte edilen sürüm.
const GLOBE_TOLERANCE = 0.25;
const GLOBE_COARSE_TOLERANCE = 1.1;
// Antarktika oyun dışı: şehri yok, haritanın altında kocaman bir şerit kaplıyor.
const SKIP_COUNTRIES = new Set(['ATA']);
// Ülke başına kart sayısı.
const MAX_CITIES_PER_COUNTRY = 12;
// Aynı metropolün ilçeleri ayrı kart olmasın diye seçilen şehirler arası en az mesafe (km).
// (Brooklyn/Queens ayrı "şehir" olarak geliyor; New York seçilince elenirler.)
const MIN_CITY_DISTANCE_KM = 25;
// PPLX = bir şehrin mahallesi/ilçesi, PPLH/PPLQ/PPLW = tarihi/terk edilmiş yerleşim.
const SKIP_FEATURE_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW']);

// world.geo.json içinde ISO kodu olmayan / ISO listesinde bulunmayan bölgeler.
// Kod alanı benzersiz olmak zorunda: iki ayrı bölge de "-99" ile geliyor.
const OVERRIDES = {
  Kosovo: { code: 'XKX', alpha2: 'XK', name: 'Kosova', continent: 'avrupa' },
  'Northern Cyprus': { code: 'CYPN', alpha2: '', name: 'Kuzey Kıbrıs', continent: 'asya' },
  Somaliland: { code: 'SOL', alpha2: '', name: 'Somaliland', continent: 'afrika' },
  Taiwan: { code: 'TWN', alpha2: 'TW', name: 'Tayvan', continent: 'asya' },
  'West Bank': { code: 'PSE', alpha2: 'PS', name: 'Filistin', continent: 'asya' },
};

const SOURCES = {
  'countries.geo.json':
    'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json',
  'iso.json':
    'https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json',
  'tr-countries.json':
    'https://raw.githubusercontent.com/umpirsky/country-list/master/data/tr/country.json',
};

// ---------------------------------------------------------------- kaynaklar

async function loadJson(file) {
  const local = path.join(CACHE, file);
  if (!fs.existsSync(local)) {
    fs.mkdirSync(CACHE, { recursive: true });
    const res = await fetch(SOURCES[file]);
    if (!res.ok) throw new Error(file + ' indirilemedi: ' + res.status);
    fs.writeFileSync(local, await res.text());
  }
  return JSON.parse(fs.readFileSync(local, 'utf8'));
}

// ---------------------------------------------------------------- projeksiyon

// Robinson projeksiyonu: dünya haritalarının klasik görünümü — kutuplarda Mercator
// kadar şişirmez, düz dikdörtgen (equirectangular) kadar da yassı durmaz.
const ROBINSON_X = [
  1.0, 0.9986, 0.9954, 0.99, 0.9822, 0.973, 0.96, 0.9427, 0.9216, 0.8962, 0.8679, 0.835,
  0.7986, 0.7597, 0.7186, 0.6732, 0.6213, 0.5722, 0.5322,
];
const ROBINSON_Y = [
  0.0, 0.062, 0.124, 0.186, 0.248, 0.31, 0.372, 0.434, 0.4958, 0.5571, 0.6176, 0.6769,
  0.7346, 0.7903, 0.8435, 0.8936, 0.9394, 0.9761, 1.0,
];

function project(lon, lat) {
  const abs = Math.min(Math.abs(lat), 90);
  const i = Math.min(Math.floor(abs / 5), 17);
  const t = (abs - i * 5) / 5;
  const kx = ROBINSON_X[i] + (ROBINSON_X[i + 1] - ROBINSON_X[i]) * t;
  const ky = ROBINSON_Y[i] + (ROBINSON_Y[i + 1] - ROBINSON_Y[i]) * t;
  const x = (0.8487 * kx * (lon * Math.PI)) / 180;
  const y = 1.3523 * ky * (lat < 0 ? -1 : 1);
  // SVGde y aşağı doğru büyür.
  return [x, -y];
}

// ---------------------------------------------------------------- geometri

function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum / 2;
}

function ringCentroid(ring) {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
    a += f;
  }
  if (a === 0) return ring[0];
  return [cx / (3 * a), cy / (3 * a)];
}

function perpDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = perpDistance(points[i], points[first], points[last]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > tolerance && index > 0) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

function ringsOf(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

function bboxOf(ring) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;

/** Küre verisi için halkayı [lon, lat, lon, lat, ...] düz dizisine indirger. */
function flattenRing(ring) {
  const flat = [];
  let prevLon = null;
  let prevLat = null;
  for (const [lon, lat] of ring) {
    const rl = r2(lon);
    const rt = r2(lat);
    if (rl === prevLon && rt === prevLat) continue;
    flat.push(rl, rt);
    prevLon = rl;
    prevLat = rt;
  }
  return flat;
}

function toPath(rings) {
  return rings
    .map((ring) => {
      let d = '';
      let prevX = null;
      let prevY = null;
      for (const [x, y] of ring) {
        const rx = r1(x);
        const ry = r1(y);
        if (rx === prevX && ry === prevY) continue;
        d += (d === '' ? 'M' : 'L') + rx + ' ' + ry;
        prevX = rx;
        prevY = ry;
      }
      return d + 'Z';
    })
    .join('');
}

// ---------------------------------------------------------------- kıtalar

// iso.json içindeki region/sub-region alanlarını oyunun kıta gruplarına indirger.
function continentOf(iso) {
  if (!iso) return 'diger';
  if (iso.region === 'Europe') return 'avrupa';
  if (iso.region === 'Africa') return 'afrika';
  if (iso.region === 'Asia') return 'asya';
  if (iso.region === 'Oceania') return 'okyanusya';
  if (iso.region === 'Americas') {
    return iso['sub-region'] === 'Northern America' ? 'kuzey-amerika' : 'latin-amerika';
  }
  return 'diger';
}

// ---------------------------------------------------------------- üretim

const geo = await loadJson('countries.geo.json');
const isoList = await loadJson('iso.json');
const trNames = await loadJson('tr-countries.json');

const isoByAlpha3 = new Map(isoList.map((c) => [c['alpha-3'], c]));
const alpha3ByAlpha2 = new Map(isoList.map((c) => [c['alpha-2'], c['alpha-3']]));

// 1) Tüm ülkeleri projekte et, dünya sınırlarını bul.
const projected = [];
for (const feature of geo.features) {
  const enName = feature.properties?.name ?? feature.id;
  const override = OVERRIDES[enName];
  const code = override?.code ?? feature.id;
  // "-99": ISO kodu atanmamış tanınmayan bölgeler; OVERRIDES ile isim almadıysa atlanır.
  if (!code || code === '-99' || SKIP_COUNTRIES.has(code)) continue;
  const lonLatRings = ringsOf(feature.geometry);
  if (lonLatRings.length === 0) continue;
  const rings = lonLatRings.map((ring) => ring.map(([lon, lat]) => project(lon, lat)));
  projected.push({ code, enName, override, rings, lonLatRings });
}

let worldMinX = Infinity;
let worldMinY = Infinity;
let worldMaxX = -Infinity;
let worldMaxY = -Infinity;
for (const country of projected) {
  for (const ring of country.rings) {
    const b = bboxOf(ring);
    worldMinX = Math.min(worldMinX, b.minX);
    worldMinY = Math.min(worldMinY, b.minY);
    worldMaxX = Math.max(worldMaxX, b.maxX);
    worldMaxY = Math.max(worldMaxY, b.maxY);
  }
}

const scale = MAP_WIDTH / (worldMaxX - worldMinX);
const mapHeight = Math.ceil((worldMaxY - worldMinY) * scale);
const toMap = ([x, y]) => [(x - worldMinX) * scale, (y - worldMinY) * scale];

// Bir enlem/boylamı doğrudan harita koordinatına çevirir (şehir noktaları için).
const lonLatToMap = (lon, lat) => toMap(project(lon, lat));

// 2) Ölçekle, sadeleştir, adacıkları ele, path üret.
const countries = [];
const globeGeometry = [];
let keptPoints = 0;
let globePoints = 0;
let globeCoarsePoints = 0;

for (const country of projected) {
  const scaledRings = country.rings.map((ring) => ring.map(toMap));
  const withArea = scaledRings.map((ring, index) => ({
    ring,
    index,
    area: Math.abs(ringArea(ring)),
  }));
  const largest = withArea.reduce((a, b) => (b.area > a.area ? b : a));

  const kept = withArea
    .filter((r) => r === largest || r.area >= MIN_RING_AREA)
    .map((r) => ({ ...r, ring: simplify(r.ring, SIMPLIFY_TOLERANCE) }))
    .filter((r) => r.ring.length >= 4);

  if (kept.length === 0) continue;
  keptPoints += kept.reduce((sum, r) => sum + r.ring.length, 0);

  const iso = isoByAlpha3.get(country.code);
  const alpha2 = country.override?.alpha2 ?? iso?.['alpha-2'] ?? '';
  const largestKept = kept.reduce((a, b) => (b.area > a.area ? b : a));
  const [labelX, labelY] = ringCentroid(largestKept.ring);
  const labelBox = bboxOf(largestKept.ring);
  const totalBox = kept.reduce(
    (acc, r) => {
      const b = bboxOf(r.ring);
      return {
        minX: Math.min(acc.minX, b.minX),
        minY: Math.min(acc.minY, b.minY),
        maxX: Math.max(acc.maxX, b.maxX),
        maxY: Math.max(acc.maxY, b.maxY),
      };
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  countries.push({
    code: country.code,
    alpha2,
    name: country.override?.name ?? ((alpha2 && trNames[alpha2]) || country.enName),
    enName: country.enName,
    continent: country.override?.continent ?? continentOf(iso),
    path: toPath(kept.map((r) => r.ring)),
    labelX: r1(labelX),
    labelY: r1(labelY),
    // Etiketin sığıp sığmadığına karar vermek için ana parçanın genişliği.
    labelWidth: r1(labelBox.maxX - labelBox.minX),
    area: Math.round(kept.reduce((sum, r) => sum + r.area, 0)),
    bounds: {
      minX: r1(totalBox.minX),
      minY: r1(totalBox.minY),
      maxX: r1(totalBox.maxX),
      maxY: r1(totalBox.maxY),
    },
  });

  // Küre için: aynı kara parçaları, ama projekte edilmemiş ham enlem/boylam.
  // Küre her karede kendi projeksiyonunu yaptığı için ölçekli path işe yaramaz.
  // İki ayrıntı seviyesi: parmakla döndürürken kaba, durunca ince olan çizilir.
  const globeRings = [];
  const globeCoarseRings = [];
  for (const r of kept) {
    const raw = country.lonLatRings[r.index];
    const fine = simplify(raw, GLOBE_TOLERANCE);
    const coarse = simplify(raw, GLOBE_COARSE_TOLERANCE);
    if (fine.length >= 4) globeRings.push(flattenRing(fine));
    if (coarse.length >= 4) globeCoarseRings.push(flattenRing(coarse));
  }
  if (globeRings.length === 0) continue;
  globePoints += globeRings.reduce((sum, r) => sum + r.length / 2, 0);
  globeCoarsePoints += globeCoarseRings.reduce((sum, r) => sum + r.length / 2, 0);

  const largestLonLat = country.lonLatRings[largestKept.index];
  const [centroidLon, centroidLat] = ringCentroid(largestLonLat);
  const lonLatBox = bboxOf(largestLonLat);
  // Ana kara parçasının doğu-batı genişliği (derece). Küredeki etiketin sığıp
  // sığmayacağını hesaplamak için kullanılır; meridyenler kutuplara doğru
  // yaklaştığı için enlem kosinüsüyle daraltılır.
  const labelSpanDeg =
    Math.min(180, lonLatBox.maxX - lonLatBox.minX) *
    Math.cos((centroidLat * Math.PI) / 180);

  globeGeometry.push({
    code: country.code,
    rings: globeRings,
    coarseRings: globeCoarseRings.length > 0 ? globeCoarseRings : globeRings,
    centroid: [r2(centroidLon), r2(centroidLat)],
    labelSpan: r2(Math.max(0, labelSpanDeg)),
  });
}

const duplicateCodes = countries
  .map((c) => c.code)
  .filter((code, i, all) => all.indexOf(code) !== i);
if (duplicateCodes.length > 0) {
  throw new Error('Yinelenen ülke kodu: ' + duplicateCodes.join(', '));
}

countries.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

// 3) Şehirler.
const citiesFile = path.join(CACHE, 'cities15000.txt');
if (!fs.existsSync(citiesFile)) {
  console.error(
    'cities15000.txt bulunamadı.\n' +
      '  https://download.geonames.org/export/dump/cities15000.zip indirip\n' +
      '  içindeki cities15000.txt dosyasını şuraya çıkar: ' +
      CACHE
  );
  process.exit(1);
}

// Şehirlerin Türkçe adları (Londra, Moskova, Atina...). İsteğe bağlı: dosya yoksa
// GeoNames'in yerel adı kullanılır. Üretmek için (yaklaşık 200MB indirme):
//   curl -LO https://download.geonames.org/export/dump/alternateNamesV2.zip
//   unzip -p alternateNamesV2.zip alternateNamesV2.txt \
//     | awk -F'\t' '$3=="tr"' > tr-alt-names.tsv
const trCityNames = new Map();
const trNamesFile = path.join(CACHE, 'tr-alt-names.tsv');
if (fs.existsSync(trNamesFile)) {
  for (const line of fs.readFileSync(trNamesFile, 'utf8').split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    if (f.length < 4 || !f[3]) continue;
    const [, geonameId, , name, preferred, short, colloquial, historic] = f;
    if (colloquial === '1' || historic === '1') continue;
    // Öncelik: resmi tercih edilen ad > kısa ad > en kısa alternatif.
    const rank = preferred === '1' ? 0 : short === '1' ? 1 : 2;
    const current = trCityNames.get(geonameId);
    if (
      !current ||
      rank < current.rank ||
      (rank === current.rank && name.length < current.name.length)
    ) {
      trCityNames.set(geonameId, { name, rank });
    }
  }
}

function distanceKm(a, b) {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const validAlpha3 = new Set(countries.map((c) => c.code));
const cityByCountry = new Map();

for (const line of fs.readFileSync(citiesFile, 'utf8').split('\n')) {
  if (!line) continue;
  const f = line.split('\t');
  const alpha2 = f[8];
  const alpha3 = alpha3ByAlpha2.get(alpha2);
  if (!alpha3 || !validAlpha3.has(alpha3)) continue;
  if (SKIP_FEATURE_CODES.has(f[7])) continue;
  const population = Number(f[14]) || 0;
  if (population <= 0) continue;
  const list = cityByCountry.get(alpha3) ?? [];
  list.push({
    id: alpha2.toLowerCase() + '-' + f[0],
    name: trCityNames.get(f[0])?.name ?? f[1],
    lat: Number(f[4]),
    lon: Number(f[5]),
    population,
    isCapital: f[7] === 'PPLC',
  });
  cityByCountry.set(alpha3, list);
}

const cities = [];
for (const country of countries) {
  const list = cityByCountry.get(country.code) ?? [];
  list.sort((a, b) => {
    if (a.isCapital !== b.isCapital) return a.isCapital ? -1 : 1;
    return b.population - a.population;
  });

  const picked = [];
  for (const city of list) {
    if (picked.length >= MAX_CITIES_PER_COUNTRY) break;
    if (picked.some((other) => distanceKm(other, city) < MIN_CITY_DISTANCE_KM)) continue;
    picked.push(city);
  }

  for (const city of picked) {
    const [x, y] = lonLatToMap(city.lon, city.lat);
    // Sadeleştirmede elenen adalardaki şehirler (Kanarya, Madeira, Rodos...) ülkenin
    // çizilen sınırlarının çok dışında kalıyor; kartlarında gösterecek kara parçası
    // olmadığı için listeye alınmıyorlar.
    const b = country.bounds;
    const margin = 8;
    if (x < b.minX - margin || x > b.maxX + margin || y < b.minY - margin || y > b.maxY + margin) {
      continue;
    }
    cities.push({
      id: city.id,
      name: city.name,
      country: country.code,
      x: r1(x),
      y: r1(y),
      population: city.population,
      isCapital: city.isCapital,
    });
  }
}

// ---------------------------------------------------------------- yazım

function header(title) {
  return (
    '// ' +
    title +
    '\n' +
    '// OTOMATİK ÜRETİLDİ — elle düzenleme. Yeniden üretmek için:\n' +
    '//   node scripts/generate-world-data.mjs\n' +
    '// Kaynaklar: johan/world.geo.json (public domain), lukes/ISO-3166 (MIT),\n' +
    '// umpirsky/country-list (MIT), GeoNames cities15000 (CC BY 4.0).\n'
  );
}

function asRows(items) {
  return (
    '[\n  ' +
    items.map((item) => JSON.stringify(item)).join(',\n  ') +
    ',\n]'
  );
}

const countriesTs =
  header('Dünya ülkelerinin Robinson projeksiyonuyla SVG path verisi.') +
  `
export interface CountryPath {
  /** ISO 3166-1 alpha-3 kodu (ör. TUR). */
  code: string;
  /** ISO 3166-1 alpha-2 kodu (ör. TR). */
  alpha2: string;
  /** Türkçe ülke adı. */
  name: string;
  /** İngilizce ülke adı (arama/yedek). */
  enName: string;
  /** Kıta grubu kimliği — WORLD_CONTINENTS ile eşleşir. */
  continent: string;
  /** Tüm parçaları içeren SVG path (fillRule="evenodd" ile çizilmeli). */
  path: string;
  /** Ülke adının yazılacağı nokta (en büyük kara parçasının ağırlık merkezi). */
  labelX: number;
  labelY: number;
  /** Ana kara parçasının genişliği — etiket sığmıyorsa gizlemek için. */
  labelWidth: number;
  /** Yaklaşık alan (viewBox birimi kare) — etiket boyutu ve sıralama için. */
  area: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export const WORLD_MAP_VIEWBOX = '0 0 ${MAP_WIDTH} ${mapHeight}';

export const COUNTRY_PATHS: CountryPath[] = ${asRows(countries)};

const BY_CODE: Record<string, CountryPath> = COUNTRY_PATHS.reduce(
  (acc, country) => {
    acc[country.code] = country;
    return acc;
  },
  {} as Record<string, CountryPath>
);

export function getCountry(code: string): CountryPath | undefined {
  return BY_CODE[code];
}
`;

const citiesTs =
  header('Ülke başına en kalabalık şehirler (harita koordinatlarına projekte edilmiş).') +
  `
export interface WorldCity {
  id: string;
  name: string;
  /** Şehrin bağlı olduğu ülkenin ISO alpha-3 kodu. */
  country: string;
  /** WORLD_MAP_VIEWBOX koordinat uzayındaki konumu. */
  x: number;
  y: number;
  population: number;
  isCapital: boolean;
}

export const WORLD_CITIES: WorldCity[] = ${asRows(cities)};

const BY_ID: Record<string, WorldCity> = WORLD_CITIES.reduce(
  (acc, city) => {
    acc[city.id] = city;
    return acc;
  },
  {} as Record<string, WorldCity>
);

const BY_COUNTRY: Record<string, WorldCity[]> = WORLD_CITIES.reduce(
  (acc, city) => {
    (acc[city.country] ??= []).push(city);
    return acc;
  },
  {} as Record<string, WorldCity[]>
);

export function getCityById(id: string): WorldCity | undefined {
  return BY_ID[id];
}

export function getCitiesOfCountry(code: string): WorldCity[] {
  return BY_COUNTRY[code] ?? [];
}

export function getCityCount(code: string): number {
  return BY_COUNTRY[code]?.length ?? 0;
}
`;

const geometryByCode = new Map(globeGeometry.map((g) => [g.code, g]));
const globeTs =
  header('3D küre için ülke sınırları — ham enlem/boylam.') +
  `
export interface CountryGeometry {
  /** ISO alpha-3 kodu; isim/renk için worldCountryPaths.ts ile eşleşir. */
  code: string;
  /** Kara parçaları: her biri [lon, lat, lon, lat, ...] düz dizisi. */
  rings: number[][];
  /** Parmakla döndürürken kullanılan kaba sürüm. */
  coarseRings: number[][];
  /** Ana kara parçasının ağırlık merkezi [lon, lat]. */
  centroid: [number, number];
  /** Ana kara parçasının doğu-batı genişliği (derece) — etiket sığdırma için. */
  labelSpan: number;
}

export const COUNTRY_GEOMETRY: CountryGeometry[] = ${asRows(
    countries.map((c) => geometryByCode.get(c.code)).filter(Boolean)
  )};
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'worldCountryPaths.ts'), countriesTs);
fs.writeFileSync(path.join(OUT, 'worldCities.ts'), citiesTs);
fs.writeFileSync(path.join(OUT, 'worldGlobeGeometry.ts'), globeTs);
console.log(
  'küre: ' +
    globeGeometry.length +
    ' ülke, ince ' +
    globePoints +
    ' nokta, kaba ' +
    globeCoarsePoints +
    ' nokta, worldGlobeGeometry.ts ' +
    (globeTs.length / 1024).toFixed(0) +
    'KB'
);

console.log(
  'ülke: ' + countries.length + ', nokta: ' + keptPoints + ', viewBox: 0 0 ' + MAP_WIDTH + ' ' + mapHeight
);
console.log(
  'şehir: ' + cities.length + ', şehri olan ülke: ' + new Set(cities.map((c) => c.country)).size
);
console.log(
  'worldCountryPaths.ts ' +
    (countriesTs.length / 1024).toFixed(0) +
    'KB, worldCities.ts ' +
    (citiesTs.length / 1024).toFixed(0) +
    'KB'
);
