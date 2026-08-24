import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';

// Kamera açısı: 0° tam tepeden kuşbakışı, 65° neredeyse yan profilden bakış.
const TILT_MIN = 0;
const TILT_MAX = 65;
const TILT_STEP = 10;
// Varsayılan bakış: yatığa yakın.
const TILT_DEFAULT = 55;

// Kenara dayanınca hareketi tamamen kesmek yerine direnç uygular — lastik hissi.
const RUBBER_BAND_RESISTANCE = 0.3;

// Net katman, görünen alanın kaç katını çizer. Büyütmek hızlı kaydırmada
// bulanık kenar payını artırır ama aynı çözünürlük için daha çok bellek ister.
const WINDOW_MARGIN = 1.5;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function rubberBand(value: number, min: number, max: number) {
  'worklet';
  if (value < min) return min + (value - min) * RUBBER_BAND_RESISTANCE;
  if (value > max) return max + (value - max) * RUBBER_BAND_RESISTANCE;
  return value;
}

/** viewBox koordinatlarında, ilk açılışta ekranı dolduracak bölge. */
export interface MapFocus {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

/** Net katmanın o an çizdiği harita penceresi (viewBox koordinatlarında). */
interface MapWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  /** Tam haritanın viewBox'ı — "minX minY genişlik yükseklik". */
  viewBox: string;
  /** İlk açılışta odaklanılacak bölge; verilmezse harita sığdırılarak açılır. */
  initialFocus?: MapFocus;
  /**
   * En uzak zoomda ekranda görünebilecek en geniş alan (viewBox birimi).
   * Küçültmek "zoom out" sınırını yakınlaştırır — etiketlerin iç içe geçtiği
   * kadar uzaklaşılmasını engeller.
   */
  maxVisibleWidth?: number;
  /**
   * Haritayı verilen viewBox ile çizer. İki kez çağrılır: bir kez tam harita
   * (arka plan), bir kez de o an görünen pencere (net katman).
   */
  children: (viewBox: string) => ReactNode;
}

/**
 * Dokunmatik harita çerçevesi: pinch ile yakınlaştırma, sürükleme + momentum,
 * kademeli perspektif eğimi. İçine hangi SVG haritanın konduğunu bilmez.
 *
 * Netlik: SVG bir kez rasterleştirildiği için haritayı büyütüp transform'la
 * ölçeklemek yakınlaşınca bulanıklaştırıyordu. Bunun yerine üstteki katman
 * sadece görünen pencereyi çizer ve her zaman 1:1 ölçekte durur (yani ekran
 * pikseli = çizim pikseli). Altındaki tam harita katmanı ise hızlı kaydırma
 * sırasında pencere dışına taşan kenarları doldurur.
 */
export default function ZoomableMap({
  viewBox,
  initialFocus,
  maxVisibleWidth,
  children,
}: Props) {
  const [vbMinX, vbMinY, vbWidth, vbHeight] = useMemo(
    () => viewBox.split(' ').map(Number),
    [viewBox]
  );
  const aspectRatio = vbWidth / vbHeight;

  const [container, setContainer] = useState({ width: 0, height: 0 });
  const [mapWindow, setMapWindow] = useState<MapWindow | null>(null);
  const hasInitialized = useRef(false);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const tilt = useSharedValue(TILT_DEFAULT);

  function onContainerLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setContainer({ width, height });
  }

  // k0: ölçek 1'de bir viewBox biriminin kaç dp ettiği.
  const k0 = container.width > 0 ? container.width / vbWidth : 0;

  const { baseWidth, baseHeight, minScale, maxScale } = useMemo(() => {
    const w = container.width || 1;
    const h = container.height || 1;
    const bw = w;
    const bh = w / aspectRatio;
    // Tam sığdırma: haritanın tamamı kartın içinde görünür.
    const contain = Math.min(1, h / bh);
    // Kartı tamamen kaplayan ölçek.
    const cover = Math.max(1, h / bh);
    // En uzak zoom: ya istenen genişlik sınırı, ya da haritanın sığdığı ölçek.
    const min = maxVisibleWidth ? vbWidth / maxVisibleWidth : contain;
    return {
      baseWidth: bw,
      baseHeight: bh,
      minScale: min,
      maxScale: Math.max(cover * 10, min * 5),
    };
  }, [container.width, container.height, aspectRatio, maxVisibleWidth, vbWidth]);

  // Net katmanın boyutu sabit: görünen alanın WINDOW_MARGIN katı.
  const crispWidth = container.width * WINDOW_MARGIN;
  const crispHeight = container.height * WINDOW_MARGIN;

  /** O an görünen bölgeyi net katmanın penceresi olarak sabitler. */
  const commitWindow = useCallback(() => {
    if (container.width === 0 || k0 === 0) return;
    const s = scale.value;
    const unitsPerDp = 1 / (s * k0);
    const viewportW = container.width * unitsPerDp;
    const viewportH = container.height * unitsPerDp;
    const width = viewportW * WINDOW_MARGIN;
    const height = viewportH * WINDOW_MARGIN;
    setMapWindow({
      x: vbMinX - translateX.value * unitsPerDp - (width - viewportW) / 2,
      y: vbMinY - translateY.value * unitsPerDp - (height - viewportH) / 2,
      width,
      height,
    });
  }, [container.width, container.height, k0, vbMinX, vbMinY]);

  // Bir eksende içerik kart alanından küçükse ortalar, büyükse kenarlar arasında sınırlar.
  function panBounds(nextScale: number) {
    'worklet';
    const scaledWidth = baseWidth * nextScale;
    const scaledHeight = baseHeight * nextScale;
    const centeredX = (container.width - scaledWidth) / 2;
    const centeredY = (container.height - scaledHeight) / 2;
    const fitsX = scaledWidth <= container.width;
    const fitsY = scaledHeight <= container.height;

    return {
      minX: fitsX ? centeredX : container.width - scaledWidth,
      maxX: fitsX ? centeredX : 0,
      minY: fitsY ? centeredY : container.height - scaledHeight,
      maxY: fitsY ? centeredY : 0,
    };
  }

  function clampTranslate(nextScale: number, tx: number, ty: number) {
    'worklet';
    const b = panBounds(nextScale);
    return { x: clamp(tx, b.minX, b.maxX), y: clamp(ty, b.minY, b.maxY) };
  }

  // İlk açılışta haritayı istenen bölgeye odaklayıp yakınlaştırır.
  useEffect(() => {
    if (hasInitialized.current || container.width === 0) return;
    hasInitialized.current = true;

    let initialScale = minScale;
    let rawTx = 0;
    let rawTy = 0;

    if (initialFocus) {
      initialScale = clamp(
        Math.min(
          (container.width * 0.94) / (initialFocus.width * k0),
          (container.height * 0.94) / (initialFocus.height * k0)
        ),
        minScale,
        maxScale
      );
      rawTx = container.width / 2 - (initialFocus.centerX - vbMinX) * k0 * initialScale;
      rawTy = container.height / 2 - (initialFocus.centerY - vbMinY) * k0 * initialScale;
    } else {
      rawTx = (container.width - baseWidth * initialScale) / 2;
      rawTy = (container.height - baseHeight * initialScale) / 2;
    }

    const clamped = clampTranslate(initialScale, rawTx, rawTy);
    scale.value = initialScale;
    translateX.value = clamped.x;
    translateY.value = clamped.y;
    commitWindow();
  }, [container.width, container.height, baseWidth, baseHeight, minScale, maxScale, k0]);

  // Ekran döndüğünde/kart yeniden ölçüldüğünde pencere de yeniden sabitlenmeli.
  useEffect(() => {
    if (hasInitialized.current) commitWindow();
  }, [container.width, container.height, commitWindow]);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          savedScale.value = scale.value;
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        })
        .onUpdate((e) => {
          // GestureDetector sabit dış kart üzerinde olduğu için e.focalX/Y kartın
          // kendi (taşınmayan) koordinat uzayındadır — büyütme parmakların altındaki
          // noktaya odaklanır, haritanın sabit bir köşesine değil.
          const next = clamp(savedScale.value * e.scale, minScale, maxScale);
          const ratio = next / savedScale.value;
          translateX.value = e.focalX - (e.focalX - savedTranslateX.value) * ratio;
          translateY.value = e.focalY - (e.focalY - savedTranslateY.value) * ratio;
          scale.value = next;
        })
        .onEnd(() => {
          const clamped = clampTranslate(scale.value, translateX.value, translateY.value);
          translateX.value = withTiming(clamped.x, { duration: 150 });
          translateY.value = withTiming(clamped.y, { duration: 150 }, () => {
            // Parmaklar kalkınca harita yeni zoom seviyesinde yeniden, net çizilir.
            runOnJS(commitWindow)();
          });
        }),
    [minScale, maxScale, baseWidth, baseHeight, container.width, container.height, commitWindow]
  );

  // maxPointers(1): 2 parmakla pan da tetiklenirse pinch'in odak noktasına göre
  // hesapladığı translate'i aynı anda eziyor. İki parmakla kaydırma zaten pinch'in
  // odak takibiyle sağlanıyor.
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .onStart(() => {
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        })
        .onUpdate((e) => {
          // Sınırda sert durmak yerine esneyerek gider; bırakınca yerine oturur.
          const b = panBounds(scale.value);
          translateX.value = rubberBand(savedTranslateX.value + e.translationX, b.minX, b.maxX);
          translateY.value = rubberBand(savedTranslateY.value + e.translationY, b.minY, b.maxY);
        })
        .onEnd((e) => {
          // Parmak kalkınca hareket sürtünmeyle sönerek devam eder (momentum).
          // Hem X hem Y durduğunda pencere yeniden sabitlenir: iki eksen farklı
          // zamanlarda dinginleşebiliyor, sadece birine bağlansa harita yarı yolda
          // bulanık kalırdı.
          const b = panBounds(scale.value);
          if (translateX.value < b.minX || translateX.value > b.maxX) {
            translateX.value = withTiming(
              clamp(translateX.value, b.minX, b.maxX),
              { duration: 200 },
              () => runOnJS(commitWindow)()
            );
          } else {
            translateX.value = withDecay(
              {
                velocity: e.velocityX,
                deceleration: 0.994,
                clamp: [b.minX, b.maxX],
              },
              () => runOnJS(commitWindow)()
            );
          }

          if (translateY.value < b.minY || translateY.value > b.maxY) {
            translateY.value = withTiming(
              clamp(translateY.value, b.minY, b.maxY),
              { duration: 200 },
              () => runOnJS(commitWindow)()
            );
          } else {
            translateY.value = withDecay(
              {
                velocity: e.velocityY,
                deceleration: 0.994,
                clamp: [b.minY, b.maxY],
              },
              () => runOnJS(commitWindow)()
            );
          }
        }),
    [baseWidth, baseHeight, container.width, container.height, commitWindow]
  );

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // Alt katman: tam harita, ölçek 1'de çizilip transform ile büyütülür (bulanık
  // ama her yeri kapsar). Sadece ekran net katmanın penceresinden taştığında —
  // yani hızlı kaydırma/fırlatma sırasında — görünür olur; aksi halde aynı
  // geometriyi iki kez çizmemek için gizlenir.
  const win = mapWindow;
  const baseLayerStyle = useAnimatedStyle(() => {
    let covered = false;
    if (win && k0 > 0) {
      const unitsPerDp = 1 / (scale.value * k0);
      const left = vbMinX - translateX.value * unitsPerDp;
      const top = vbMinY - translateY.value * unitsPerDp;
      covered =
        left >= win.x &&
        top >= win.y &&
        left + container.width * unitsPerDp <= win.x + win.width &&
        top + container.height * unitsPerDp <= win.y + win.height;
    }
    return {
      opacity: covered ? 0 : 1,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  }, [win, k0, vbMinX, vbMinY, container.width, container.height]);

  // Üst katman: sabitlenen pencere. Pencere hangi ölçekte sabitlendiyse o ölçekte
  // 1:1 durur; parmak haritayı oynatırken aradaki fark kadar ölçeklenir, parmak
  // kalkınca pencere yeniden sabitlenip tekrar 1:1 olur.
  const crispLayerStyle = useAnimatedStyle(() => {
    if (!win || crispWidth === 0) {
      return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
    }
    return {
      opacity: 1,
      transform: [
        { translateX: translateX.value + scale.value * k0 * (win.x - vbMinX) },
        { translateY: translateY.value + scale.value * k0 * (win.y - vbMinY) },
        { scale: (scale.value * k0 * win.width) / crispWidth },
      ],
    };
  }, [win, crispWidth, k0, vbMinX, vbMinY]);

  // Perspektif eğimi: 0°'de harita tepeden, açı büyüdükçe daha yatık görünür.
  const tiltStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateX: `${tilt.value}deg` }],
  }));

  function handleTilt(delta: number) {
    tilt.value = withTiming(clamp(tilt.value + delta, TILT_MIN, TILT_MAX), { duration: 220 });
  }

  const windowViewBox = win ? `${win.x} ${win.y} ${win.width} ${win.height}` : null;

  // Pencere her sabitlendiğinde alt katmanın da yeniden kurulmaması için ayrı
  // ayrı hafızada tutuluyor — alt katman hiç değişmiyor.
  const baseLayer = useMemo(() => children(viewBox), [children, viewBox]);
  const crispLayer = useMemo(
    () => (windowViewBox ? children(windowViewBox) : null),
    [children, windowViewBox]
  );

  return (
    <View style={styles.wrapper}>
      <GestureDetector gesture={composedGesture}>
        <View style={styles.viewport} onLayout={onContainerLayout}>
          <Animated.View style={[styles.tiltLayer, tiltStyle]}>
            {container.width > 0 && (
              <>
                <Animated.View
                  style={[
                    styles.layer,
                    { width: baseWidth, height: baseHeight },
                    baseLayerStyle,
                  ]}
                >
                  {baseLayer}
                </Animated.View>

                {crispLayer && (
                  <Animated.View
                    style={[
                      styles.layer,
                      { width: crispWidth, height: crispHeight },
                      crispLayerStyle,
                    ]}
                  >
                    {crispLayer}
                  </Animated.View>
                )}
              </>
            )}
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.tiltControls}>
        <TiltButton icon="chevron-up" onPress={() => handleTilt(-TILT_STEP)} />
        <TiltButton icon="chevron-down" onPress={() => handleTilt(TILT_STEP)} />
      </View>
    </View>
  );
}

const TILT_BUTTON_DEPTH = 3;
const TILT_BUTTON_SIZE = 30;

/** Bakış açısını kademe kademe değiştiren buton: yukarı = tepeden, aşağı = yatık. */
function TiltButton({
  icon,
  onPress,
}: {
  icon: 'chevron-up' | 'chevron-down';
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const burst = useSharedValue(1);

  function handlePress() {
    burst.value = 0;
    burst.value = withTiming(1, { duration: 380 });
    onPress();
  }

  const burstStyle = useAnimatedStyle(() => ({
    opacity: 1 - burst.value,
    transform: [{ scale: 0.4 + burst.value * 1.5 }],
  }));

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={handlePress}
      style={styles.tiltButtonWrap}
    >
      <View
        style={[
          styles.tiltButtonFace,
          {
            marginBottom: pressed ? 0 : TILT_BUTTON_DEPTH,
            transform: [{ translateY: pressed ? TILT_BUTTON_DEPTH : 0 }],
          },
        ]}
      >
        <Ionicons name={icon} size={15} color={colors.surfaceDark} />
      </View>
      <Animated.View pointerEvents="none" style={[styles.tiltBurst, burstStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  viewport: {
    flex: 1,
    overflow: 'hidden',
  },
  tiltLayer: {
    flex: 1,
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: '0 0',
  },
  // Zeminsiz, haritanın üstünde yüzen kontrol şeridi — arkadaki gökyüzü kesintisiz görünür.
  tiltControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  tiltButtonWrap: {
    width: TILT_BUTTON_SIZE,
    alignItems: 'center',
    backgroundColor: 'rgba(126,74,163,0.45)',
    borderRadius: TILT_BUTTON_SIZE / 2,
  },
  tiltButtonFace: {
    width: TILT_BUTTON_SIZE,
    height: TILT_BUTTON_SIZE,
    borderRadius: TILT_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(217,153,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiltBurst: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 26,
    backgroundColor: '#FFE566',
  },
});
