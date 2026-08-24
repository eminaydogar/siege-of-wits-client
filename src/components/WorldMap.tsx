import { useMemo } from 'react';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import { getContinentColor } from '../data/continents';
import { getMapLabel } from '../data/countryLabels';
import { COUNTRY_PATHS, WORLD_MAP_VIEWBOX } from '../data/worldCountryPaths';
import { colors } from '../theme/colors';
import { shadeColor } from '../utils/color';

// Haritaya kalınlık hissi veren yan yüz katmanları: aynı ülkeler birer birim aşağı
// kaydırılıp koyu tonla çizilir, en üste asıl renkli katman gelir.
// (Türkiye haritasına göre daha az katman: dünyada 177 ülke var, her katman
// tüm ülkeleri yeniden çiziyor.)
const EXTRUSION_LAYERS = 5;
const EXTRUSION_STEP = 1.4;
const EXTRUSION_DEPTH = EXTRUSION_LAYERS * EXTRUSION_STEP;

// Yan yüz, üstten alta doğru koyulaşır — ışık yukarıdan geliyormuş hissi verir.
const SIDE_SHADE_TOP = -16;
const SIDE_SHADE_BOTTOM = -58;

// Aynı kıtadaki komşu ülkeler birbirinden ayrılsın diye hafif ton farkı.
const TONE_VARIANTS = [7, 0, -7];

// Etiket boyutu ülkenin alanıyla büyür ama bu aralığın dışına çıkmaz.
const LABEL_MIN_FONT = 2.2;
const LABEL_MAX_FONT = 5.5;
// Ortalama karakter genişliği / punto oranı — etiketin sığıp sığmadığını kestirmek için.
const LABEL_CHAR_RATIO = 0.53;

function sidesOf(top: string) {
  // i = 0 en alttaki (en koyu) katman.
  return Array.from({ length: EXTRUSION_LAYERS }, (_, i) => {
    const t = i / (EXTRUSION_LAYERS - 1);
    return shadeColor(top, SIDE_SHADE_BOTTOM + (SIDE_SHADE_TOP - SIDE_SHADE_BOTTOM) * t);
  });
}

function toneOf(code: string) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  return TONE_VARIANTS[hash % TONE_VARIANTS.length];
}

const RENDERED_COUNTRIES = COUNTRY_PATHS.map((country) => {
  const top = shadeColor(getContinentColor(country.continent), toneOf(country.code));
  const text = getMapLabel(country.code, country.name);
  const fontSize = Math.min(
    LABEL_MAX_FONT,
    Math.max(LABEL_MIN_FONT, Math.sqrt(country.area) * 0.19)
  );
  // Ana kara parçasına sığmayan etiketi hiç çizmiyoruz: küçük ülkelerin adı
  // komşularının üstüne taşıp haritayı okunmaz hale getiriyordu.
  const fits = text.length * fontSize * LABEL_CHAR_RATIO <= country.labelWidth * 0.9;

  return {
    ...country,
    top,
    sides: sidesOf(top),
    label: fits ? { text, fontSize } : null,
  };
});

interface Props {
  onSelectCountry: (code: string) => void;
  /** Ülke kodu → o ülkede en az bir şehri olan oyuncunun rengi. */
  ownerColors?: Record<string, string>;
  /**
   * Çizilecek alan. Varsayılan tam dünya; ZoomableMap net katman için o an
   * görünen pencereyi verir, o zaman pencere dışındaki ülkeler hiç çizilmez.
   */
  viewBox?: string;
}

export default function WorldMap({
  onSelectCountry,
  ownerColors,
  viewBox = WORLD_MAP_VIEWBOX,
}: Props) {
  // Fethedilen ülkeler kıta renginin yerine sahibinin rengiyle boyanır.
  const owned = useMemo(() => {
    if (!ownerColors || Object.keys(ownerColors).length === 0) return RENDERED_COUNTRIES;
    return RENDERED_COUNTRIES.map((country) => {
      const owner = ownerColors[country.code];
      if (!owner) return country;
      return { ...country, top: owner, sides: sidesOf(owner) };
    });
  }, [ownerColors]);

  // Pencerenin dışında kalan ülkeleri çizmemek, yakınlaşıldıkça çizilen düğüm
  // sayısını 177 ülkeden bir avuca indiriyor.
  const countries = useMemo(() => {
    if (viewBox === WORLD_MAP_VIEWBOX) return owned;
    const [x, y, w, h] = viewBox.split(' ').map(Number);
    if (!isFinite(x) || !isFinite(w)) return owned;
    return owned.filter(
      (country) =>
        country.bounds.maxX >= x &&
        country.bounds.minX <= x + w &&
        country.bounds.maxY >= y &&
        country.bounds.minY <= y + h
    );
  }, [owned, viewBox]);

  return (
    <Svg width="100%" height="100%" viewBox={viewBox}>
      {/* Zemine düşen gölge: haritayı yüzeyden koparıp havada durur gibi gösterir. */}
      <G transform={`translate(1.2, ${EXTRUSION_DEPTH + 3})`} opacity={0.16}>
        {countries.map((country) => (
          <Path key={country.code} d={country.path} fill="#000000" fillRule="evenodd" />
        ))}
      </G>

      {/* Yan yüzler: en alttaki (en koyu) katmandan üste doğru çizilir. */}
      {Array.from({ length: EXTRUSION_LAYERS }, (_, i) => (
        <G key={`side-${i}`} transform={`translate(0, ${(EXTRUSION_LAYERS - i) * EXTRUSION_STEP})`}>
          {countries.map((country) => (
            <Path
              key={country.code}
              d={country.path}
              fill={country.sides[i]}
              fillRule="evenodd"
            />
          ))}
        </G>
      ))}

      {/* Üst yüz: kıta/sahip rengi + ülke sınırı. */}
      {countries.map((country) => (
        <Path
          key={country.code}
          d={country.path}
          fill={country.top}
          fillRule="evenodd"
          stroke={colors.mapStroke}
          strokeWidth={0.55}
          strokeOpacity={0.5}
          onPress={() => onSelectCountry(country.code)}
        />
      ))}

      {/* Ülke adları en üstte; dokunmayı engellememesi için tıklanabilir değil. */}
      <G pointerEvents="none">
        {countries.map((country) =>
          country.label ? (
            <SvgText
              key={country.code}
              x={country.labelX}
              y={country.labelY}
              fontSize={country.label.fontSize}
              fontWeight="700"
              fill={colors.textInverse}
              stroke={colors.mapStroke}
              strokeWidth={country.label.fontSize * 0.09}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {country.label.text}
            </SvgText>
          ) : null
        )}
      </G>
    </Svg>
  );
}
