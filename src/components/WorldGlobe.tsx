import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  runOnUI,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { getContinentColor } from '../data/continents';
import { getMapLabel } from '../data/countryLabels';
import { COUNTRY_GEOMETRY } from '../data/worldGlobeGeometry';
import { getCountry } from '../data/worldCountryPaths';
import { colors } from '../theme/colors';
import { shadeColor } from '../utils/color';
import { pickCountry, unprojectGlobe } from '../utils/globePicking';

// PASİF: SVG tabanlı küre. Hesabı UI thread'ine taşımak yetmedi — asıl maliyet
// react-native-svg'nin her karede tüm vektör ağacını yeniden rasterleştirmesi.
// Yerini WorldGlobeView (WebView + canvas) aldı; bu dosya karşılaştırma ve
// olası geri dönüş için duruyor.

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

const DEG = Math.PI / 180;

// Küre ekranın kısa kenarının bu kadarını kaplar (zoom 1 iken).
const RADIUS_RATIO = 0.44;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.8;

// Ekranda 1 px sürükleme kaç radyan döndürür (küre yarıçapına bölünür):
// parmak, kürenin üstündeki noktayı takip ediyormuş gibi hissettirir.
const DRAG_GAIN = 1;
// Kuzey/güney kutbunun tam tepeye gelip görüntüyü ters çevirmesini engeller.
const MAX_PHI = 78 * DEG;
// Bırakınca dönüş sürtünmeyle söner (withDecay'in kare başına hız oranı).
const SPIN_DECELERATION = 0.9955;

// Açılışta Türkiye ekranın ortasında durur.
const INITIAL_LAMBDA = 35 * DEG;
const INITIAL_PHI = 39 * DEG;

// Etiket, ülkenin merkezi kenara bu kadar yaklaşınca gizlenir (0 = kenar, 1 = tam orta).
const LABEL_MIN_FACING = 0.32;
const LABEL_MIN_FONT = 7;
const LABEL_MAX_FONT = 13;
const LABEL_CHAR_RATIO = 0.53;

/** Enlem/boylamı birim küre üzerinde bir noktaya çevirir (y kuzey, z bakan yüz). */
function toUnitVector(lon: number, lat: number): [number, number, number] {
  const l = lon * DEG;
  const p = lat * DEG;
  const cp = Math.cos(p);
  return [cp * Math.sin(l), Math.sin(p), cp * Math.cos(l)];
}

function ringToVectors(flat: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    const v = toUnitVector(flat[i], flat[i + 1]);
    out.push(v[0], v[1], v[2]);
  }
  return out;
}

/**
 * Çizim için hazırlanmış geometri. Düz sayı dizileri: bu yapı olduğu gibi
 * UI thread'ine (worklet dünyasına) kopyalanabiliyor.
 */
interface ProjectionData {
  /** ülke → halka → [x, y, z, x, y, z, ...] */
  rings: number[][][];
  /** ülke → merkez [x, y, z] */
  centroids: number[][];
  /** merkezin bakan-yüz değeri bunun altındaysa ülke tamamen arkadadır */
  hideBelow: number[];
}

function buildProjectionData(pick: (index: number) => number[][]): ProjectionData {
  const rings: number[][][] = [];
  const centroids: number[][] = [];
  const hideBelow: number[] = [];

  COUNTRY_GEOMETRY.forEach((geometry, index) => {
    const countryRings = pick(index).map(ringToVectors);
    const centroid = toUnitVector(geometry.centroid[0], geometry.centroid[1]);

    // Ülkenin merkezden en uzak noktasının açısı: bu açı kadar taşan bir ülke,
    // merkezi ufkun ardına geçse bile hâlâ görünüyor olabilir.
    let minDot = 1;
    for (const ring of countryRings) {
      for (let i = 0; i < ring.length; i += 3) {
        const dot =
          centroid[0] * ring[i] + centroid[1] * ring[i + 1] + centroid[2] * ring[i + 2];
        if (dot < minDot) minDot = dot;
      }
    }
    const maxAngle = Math.acos(Math.max(-1, Math.min(1, minDot)));

    rings.push(countryRings);
    centroids.push([centroid[0], centroid[1], centroid[2]]);
    hideBelow.push(maxAngle >= Math.PI / 2 ? -1 : -Math.sin(maxAngle));
  });

  return { rings, centroids, hideBelow };
}

// Durgunken çizilen ayrıntılı sürüm (sadece JS tarafında kullanılır) ve
// döndürürken çizilen kaba sürüm (UI thread'ine kopyalanır).
const FINE_DATA = buildProjectionData((i) => COUNTRY_GEOMETRY[i].rings);
const COARSE_DATA = buildProjectionData((i) => COUNTRY_GEOMETRY[i].coarseRings);

const COUNTRY_META = COUNTRY_GEOMETRY.map((geometry) => {
  const country = getCountry(geometry.code);
  return {
    code: geometry.code,
    label: country ? getMapLabel(geometry.code, country.name) : geometry.code,
    color: country ? getContinentColor(country.continent) : colors.mapUnconquered,
    centroidLon: geometry.centroid[0],
    centroidLat: geometry.centroid[1],
    labelSpan: geometry.labelSpan,
  };
});

/** Küre telleri: 45°'de bir meridyen, 30°'de bir paralel. */
const GRATICULE: number[][] = (() => {
  const lines: number[][] = [];
  for (let lon = -180; lon < 180; lon += 45) {
    const flat: number[] = [];
    for (let lat = -80; lat <= 80; lat += 10) flat.push(lon, lat);
    lines.push(ringToVectors(flat));
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const flat: number[] = [];
    for (let lon = -180; lon <= 180; lon += 10) flat.push(lon, lat);
    lines.push(ringToVectors(flat));
  }
  return lines;
})();

/**
 * Tüm ülkeleri döndürüp renk grubu başına tek bir SVG path üretir.
 *
 * 'worklet' işareti sayesinde aynı fonksiyon iki yerde çalışabiliyor:
 * döndürürken UI thread'inde (JS thread'ine hiç uğramadan), durgunken de
 * normal JS tarafında ayrıntılı geometriyle.
 */
function projectToPaths(
  data: ProjectionData,
  slotOf: number[],
  slotCount: number,
  lambda: number,
  phi: number,
  radius: number,
  cx: number,
  cy: number,
  precision: number
): string[] {
  'worklet';
  const out: string[] = [];
  for (let i = 0; i < slotCount; i++) out.push('');
  if (radius <= 0) return out;

  const cosL = Math.cos(lambda);
  const sinL = Math.sin(lambda);
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);

  for (let c = 0; c < data.rings.length; c++) {
    // Önce merkez: ülke tamamen arkadaysa hiç uğraşma.
    const centroid = data.centroids[c];
    const cz1 = centroid[0] * sinL + centroid[2] * cosL;
    const cz2 = centroid[1] * sinP + cz1 * cosP;
    if (cz2 < data.hideBelow[c]) continue;

    const countryRings = data.rings[c];
    let countryPath = '';

    for (let r = 0; r < countryRings.length; r++) {
      const ring = countryRings[r];
      let visibleCount = 0;
      let prevX = NaN;
      let prevY = NaN;
      let d = '';

      for (let i = 0; i < ring.length; i += 3) {
        const x1 = ring[i] * cosL - ring[i + 2] * sinL;
        const z1 = ring[i] * sinL + ring[i + 2] * cosL;
        const y2 = ring[i + 1] * cosP - z1 * sinP;
        const z2 = ring[i + 1] * sinP + z1 * cosP;

        let px: number;
        let py: number;
        if (z2 > 0) {
          visibleCount++;
          px = cx + radius * x1;
          py = cy - radius * y2;
        } else {
          // Arka yüzdeki noktalar kürenin kenarına yapıştırılır; böylece ufku
          // aşan ülkeler kesilmeden, kenarı takip ederek çizilir.
          const m = Math.sqrt(x1 * x1 + y2 * y2) || 1;
          px = cx + (radius * x1) / m;
          py = cy - (radius * y2) / m;
        }

        const rx = Math.round(px * precision) / precision;
        const ry = Math.round(py * precision) / precision;
        if (rx === prevX && ry === prevY) continue;
        d += (d === '' ? 'M' : 'L') + rx + ' ' + ry;
        prevX = rx;
        prevY = ry;
      }

      // Tek noktası görünen halkalar kenarda saç teli gibi bir parçaya dönüşüyor.
      if (visibleCount >= 2 && d !== '') countryPath += d + 'Z';
    }

    if (countryPath !== '') out[slotOf[c]] += countryPath;
  }

  return out;
}

interface Label {
  code: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

interface Props {
  onSelectCountry: (code: string) => void;
  /** Ülke kodu → o ülkede en az bir şehri olan oyuncunun rengi. */
  ownerColors?: Record<string, string>;
}

export default function WorldGlobe({ onSelectCountry, ownerColors }: Props) {
  const [container, setContainer] = useState({ width: 0, height: 0 });
  // Durgun görüntünün açıları. Sürükleme sırasında güncellenmez: o sırada
  // ekranı UI thread'indeki kaba katman çiziyor.
  const [idle, setIdle] = useState({
    lambda: INITIAL_LAMBDA,
    phi: INITIAL_PHI,
    zoom: 1,
  });

  const lambda = useSharedValue(INITIAL_LAMBDA);
  const phi = useSharedValue(INITIAL_PHI);
  const zoom = useSharedValue(1);
  const baseRadius = useSharedValue(0);
  const centerX = useSharedValue(0);
  const centerY = useSharedValue(0);
  // 1 = küre hareket hâlinde (kaba katman görünür), 0 = durgun (ayrıntılı katman).
  const moving = useSharedValue(0);
  const gestureActive = useSharedValue(0);
  const pendingDecays = useSharedValue(0);
  // Dönen küreye dokunmak onu durdurur; o dokunuş ülke seçimi sayılmamalı.
  const stoppedSpin = useSharedValue(0);

  const dragLambda = useSharedValue(INITIAL_LAMBDA);
  const dragPhi = useSharedValue(INITIAL_PHI);
  const pinchZoom = useSharedValue(1);

  const size = Math.min(container.width, container.height);
  const radius = size * RADIUS_RATIO * idle.zoom;
  const cx = container.width / 2;
  const cy = container.height / 2;

  useEffect(() => {
    baseRadius.value = size * RADIUS_RATIO;
    centerX.value = container.width / 2;
    centerY.value = container.height / 2;
  }, [size, container.width, container.height]);

  // Ülke → renk yuvası. Sahiplik değişmedikçe sabit kalır; hem kaba hem
  // ayrıntılı katman aynı yuvaları kullanır.
  const { slotColors, slotOf } = useMemo(() => {
    const list: string[] = [];
    const index: Record<string, number> = {};
    const map: number[] = [];
    for (const country of COUNTRY_META) {
      const fill = ownerColors?.[country.code] ?? country.color;
      if (index[fill] === undefined) {
        index[fill] = list.length;
        list.push(fill);
      }
      map.push(index[fill]);
    }
    return { slotColors: list, slotOf: map };
  }, [ownerColors]);

  const slotCount = slotColors.length;

  // --- UI thread: döndürme sırasında çizilen kaba katman -------------------
  // Bu türev değer yalnızca paylaşılan değerleri okur, dolayısıyla parmak
  // hareket ettikçe JS thread'ine hiç dokunmadan UI thread'inde yeniden hesaplanır.
  const coarsePaths = useDerivedValue(
    () =>
      projectToPaths(
        COARSE_DATA,
        slotOf,
        slotCount,
        lambda.value,
        phi.value,
        baseRadius.value * zoom.value,
        centerX.value,
        centerY.value,
        // Hareket hâlinde tam piksel yeterli: hem kısa metin hem daha çok
        // ardışık tekrar elenmesi demek.
        1
      ),
    [slotOf, slotCount]
  );

  const coarseLayerProps = useAnimatedProps(() => ({ opacity: moving.value }));
  const fineLayerProps = useAnimatedProps(() => ({ opacity: 1 - moving.value }));

  // --- JS thread: durgunken çizilen ayrıntılı katman -----------------------
  const { finePaths, labels, graticule } = useMemo(() => {
    const paths = projectToPaths(
      FINE_DATA,
      slotOf,
      slotCount,
      idle.lambda,
      idle.phi,
      radius,
      cx,
      cy,
      10
    );

    const labelList: Label[] = [];
    const lines: string[] = [];
    if (radius <= 0) return { finePaths: paths, labels: labelList, graticule: lines };

    const cosL = Math.cos(idle.lambda);
    const sinL = Math.sin(idle.lambda);
    const cosP = Math.cos(idle.phi);
    const sinP = Math.sin(idle.phi);

    for (const country of COUNTRY_META) {
      const v = toUnitVector(country.centroidLon, country.centroidLat);
      const x1 = v[0] * cosL - v[2] * sinL;
      const z1 = v[0] * sinL + v[2] * cosL;
      const y2 = v[1] * cosP - z1 * sinP;
      const z2 = v[1] * sinP + z1 * cosP;
      if (z2 <= LABEL_MIN_FACING) continue;

      const fontSize = Math.max(
        LABEL_MIN_FONT,
        Math.min(LABEL_MAX_FONT, radius * 0.055 * z2)
      );
      // Ülkenin ekrandaki genişliği: kutuplara ve kenara doğru daralır.
      const screenSpan = country.labelSpan * DEG * radius * z2;
      if (country.label.length * fontSize * LABEL_CHAR_RATIO > screenSpan * 0.95) continue;

      labelList.push({
        code: country.code,
        text: country.label,
        x: cx + radius * x1,
        y: cy - radius * y2,
        fontSize,
      });
    }

    for (const line of GRATICULE) {
      let d = '';
      let drawing = false;
      for (let i = 0; i < line.length; i += 3) {
        const x1 = line[i] * cosL - line[i + 2] * sinL;
        const z1 = line[i] * sinL + line[i + 2] * cosL;
        const y2 = line[i + 1] * cosP - z1 * sinP;
        const z2 = line[i + 1] * sinP + z1 * cosP;
        if (z2 <= 0) {
          drawing = false;
          continue;
        }
        d +=
          (drawing ? 'L' : 'M') +
          Math.round((cx + radius * x1) * 10) / 10 +
          ' ' +
          Math.round((cy - radius * y2) * 10) / 10;
        drawing = true;
      }
      if (d !== '') lines.push(d);
    }

    return { finePaths: paths, labels: labelList, graticule: lines };
  }, [idle, radius, cx, cy, slotOf, slotCount]);

  // Ayrıntılı katman yeni açıyla çizildikten sonra kaba katmanı kapat; yeni bir
  // jest başlamışsa dokunma (aksi hâlde eski kare bir an görünürdü).
  useEffect(() => {
    runOnUI(() => {
      'worklet';
      if (gestureActive.value === 0 && pendingDecays.value === 0) moving.value = 0;
    })();
  }, [finePaths]);

  const commitIdle = useCallback((nextLambda: number, nextPhi: number, nextZoom: number) => {
    setIdle({ lambda: nextLambda, phi: nextPhi, zoom: nextZoom });
  }, []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .onBegin(() => {
          cancelAnimation(lambda);
          cancelAnimation(phi);
          stoppedSpin.value = pendingDecays.value > 0 ? 1 : 0;
          pendingDecays.value = 0;
          gestureActive.value = 1;
          dragLambda.value = lambda.value;
          dragPhi.value = phi.value;
        })
        .onStart(() => {
          moving.value = 1;
        })
        .onUpdate((e) => {
          const radiusNow = baseRadius.value * zoom.value;
          if (radiusNow <= 0) return;
          const gain = DRAG_GAIN / radiusNow;
          // Parmak sağa giderse küre sağa döner: bakılan boylam batıya kayar.
          lambda.value = dragLambda.value - e.translationX * gain;
          phi.value = Math.max(
            -MAX_PHI,
            Math.min(MAX_PHI, dragPhi.value + e.translationY * gain)
          );
        })
        .onEnd((e) => {
          const radiusNow = baseRadius.value * zoom.value;
          const gain = radiusNow > 0 ? DRAG_GAIN / radiusNow : 0;
          pendingDecays.value = 2;

          // İki eksen ayrı ayrı sönüyor; ayrıntılı katmana ancak ikisi de
          // durunca geçiliyor.
          const finish = () => {
            pendingDecays.value = Math.max(0, pendingDecays.value - 1);
            if (pendingDecays.value === 0) {
              runOnJS(commitIdle)(lambda.value, phi.value, zoom.value);
            }
          };

          lambda.value = withDecay(
            { velocity: -e.velocityX * gain, deceleration: SPIN_DECELERATION },
            finish
          );
          phi.value = withDecay(
            {
              velocity: e.velocityY * gain,
              deceleration: SPIN_DECELERATION,
              clamp: [-MAX_PHI, MAX_PHI],
            },
            finish
          );
        })
        .onFinalize(() => {
          gestureActive.value = 0;
          // Jest iptal olduysa (onEnd hiç çalışmadıysa) sönme de başlamamıştır;
          // ayrıntılı katmana dönüşü burada tetikliyoruz.
          if (pendingDecays.value === 0) {
            runOnJS(commitIdle)(lambda.value, phi.value, zoom.value);
          }
        }),
    [commitIdle]
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          cancelAnimation(lambda);
          cancelAnimation(phi);
          pendingDecays.value = 0;
          gestureActive.value = 1;
          pinchZoom.value = zoom.value;
        })
        .onStart(() => {
          moving.value = 1;
        })
        .onUpdate((e) => {
          zoom.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchZoom.value * e.scale));
        })
        .onEnd(() => {
          runOnJS(commitIdle)(lambda.value, phi.value, zoom.value);
        })
        .onFinalize(() => {
          gestureActive.value = 0;
        }),
    [commitIdle]
  );

  /**
   * Ülke seçimi: dokunulan noktayı küre yüzeyindeki enlem/boylama çevirip
   * hangi ülkenin sınırlarına düştüğüne bakar. SVG'nin kendi onPress'i parmak
   * birkaç piksel kaydığında Pan jestine kapılıp kayboluyordu.
   */
  const handleTap = useCallback(
    (px: number, py: number, tapLambda: number, tapPhi: number, tapZoom: number) => {
      const point = unprojectGlobe(
        px,
        py,
        container.width / 2,
        container.height / 2,
        size * RADIUS_RATIO * tapZoom,
        tapLambda,
        tapPhi
      );
      if (!point) return;
      const code = pickCountry(point.lon, point.lat);
      if (code) onSelectCountry(code);
    },
    [container.width, container.height, size, onSelectCountry]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        // Parmak biraz kaysa da dokunuş sayılsın; daha fazlası döndürmedir.
        .maxDistance(14)
        .onEnd((e, success) => {
          if (!success) return;
          if (stoppedSpin.value === 1) {
            // Dönen küreyi durduran dokunuş: ülkeye girme.
            stoppedSpin.value = 0;
            runOnJS(commitIdle)(lambda.value, phi.value, zoom.value);
            return;
          }
          runOnJS(handleTap)(e.x, e.y, lambda.value, phi.value, zoom.value);
        }),
    [handleTap, commitIdle]
  );

  // Pan öncelikli: parmak kayarsa küre döner, kaymazsa dokunuş ülke seçer.
  const gesture = Gesture.Simultaneous(
    Gesture.Exclusive(panGesture, tapGesture),
    pinchGesture
  );

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setContainer({ width, height });
  }

  const strokeColors = useMemo(
    () => slotColors.map((fill) => shadeColor(fill, -35)),
    [slotColors]
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.container} onLayout={onLayout}>
        {radius > 0 && (
          <Svg width={container.width} height={container.height}>
            <Defs>
              <RadialGradient id="ocean" cx="35%" cy="28%" r="78%">
                <Stop offset="0" stopColor="#63C7EC" />
                <Stop offset="0.65" stopColor="#2E86B8" />
                <Stop offset="1" stopColor="#14456B" />
              </RadialGradient>
              <RadialGradient id="globeShade" cx="35%" cy="28%" r="80%">
                <Stop offset="0.5" stopColor="#000000" stopOpacity="0" />
                <Stop offset="1" stopColor="#08203A" stopOpacity="0.55" />
              </RadialGradient>
              <RadialGradient id="atmosphere" cx="50%" cy="50%" r="50%">
                <Stop offset="0.86" stopColor="#BFE9FF" stopOpacity="0" />
                <Stop offset="1" stopColor="#BFE9FF" stopOpacity="0.45" />
              </RadialGradient>
            </Defs>

            {/* Atmosfer halesi: kürenin dışına taşan yumuşak parlaklık. */}
            <Circle cx={cx} cy={cy} r={radius * 1.13} fill="url(#atmosphere)" />

            {/* Okyanus. */}
            <Circle cx={cx} cy={cy} r={radius} fill="url(#ocean)" />

            {/* Ayrıntılı katman: durgunken görünür. Renk başına tek path —
                her ülkeyi ayrı düğüm yapmak döndürürken kasmaya yol açıyordu.
                Alt yollar ayrı ayrı konturlandığı için sınırlar yine görünür. */}
            <AnimatedG animatedProps={fineLayerProps} pointerEvents="none">
              {graticule.map((d, i) => (
                <Path
                  key={`grat-${i}`}
                  d={d}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeOpacity={0.16}
                  strokeWidth={0.7}
                />
              ))}
              {finePaths.map((d, i) =>
                d === '' ? null : (
                  <Path
                    key={slotColors[i]}
                    d={d}
                    fill={slotColors[i]}
                    // nonzero: aynı renge düşen komşu ülkeler (ör. Güney Afrika
                    // içindeki Lesotho) birbirini delik gibi oymasın.
                    fillRule="nonzero"
                    stroke={strokeColors[i]}
                    strokeWidth={0.6}
                    strokeOpacity={0.7}
                  />
                )
              )}
            </AnimatedG>

            {/* Kaba katman: parmak küreyi çevirirken görünür, tamamen UI
                thread'inde güncellenir. */}
            <AnimatedG animatedProps={coarseLayerProps} pointerEvents="none">
              {slotColors.map((fill, index) => (
                <CoarseLayer
                  key={fill}
                  index={index}
                  fill={fill}
                  stroke={strokeColors[index]}
                  paths={coarsePaths}
                />
              ))}
            </AnimatedG>

            {/* Küreye hacim veren kenar gölgesi — dokunmayı engellemez. */}
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="url(#globeShade)"
              pointerEvents="none"
            />

            {/* Ülke adları en üstte, sadece durgunken. */}
            <AnimatedG animatedProps={fineLayerProps} pointerEvents="none">
              {labels.map((label) => (
                <SvgText
                  key={label.code}
                  x={label.x}
                  y={label.y}
                  fontSize={label.fontSize}
                  fontWeight="700"
                  fill={colors.textInverse}
                  stroke="#0B1B2E"
                  strokeWidth={label.fontSize * 0.1}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {label.text}
                </SvgText>
              ))}
            </AnimatedG>
          </Svg>
        )}
      </View>
    </GestureDetector>
  );
}

/**
 * Tek bir renk yuvasının path'i. Kendi animatedProps'u olduğu için `d` değeri
 * React'e uğramadan doğrudan UI thread'inden güncellenir.
 */
function CoarseLayer({
  index,
  fill,
  stroke,
  paths,
}: {
  index: number;
  fill: string;
  stroke: string;
  paths: { value: string[] };
}) {
  const animatedProps = useAnimatedProps(() => ({ d: paths.value[index] ?? '' }));
  return (
    <AnimatedPath
      animatedProps={animatedProps}
      fill={fill}
      fillRule="nonzero"
      stroke={stroke}
      strokeWidth={0.6}
      strokeOpacity={0.7}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
});
