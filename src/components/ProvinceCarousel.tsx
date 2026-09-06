import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { DISTRICTS } from '../data/districts';
import { getRegion } from '../data/regions';
import { PROVINCE_PATHS } from '../data/turkeyProvincePaths';
import { colors } from '../theme/colors';
import { shadeColor } from '../utils/color';
import { getPathBounds } from '../utils/svgPathBounds';

const CARD_GAP = 14;
const CARD_WIDTH_RATIO = 0.76;
const FOOTER_HEIGHT = 30;
const TOP_INSET = 54;

const DISTRICT_COUNT_BY_CITY = DISTRICTS.reduce<Record<string, number>>((acc, d) => {
  acc[d.city] = (acc[d.city] ?? 0) + 1;
  return acc;
}, {});

const PROVINCE_CARDS = [...PROVINCE_PATHS]
  .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  .map((p) => ({ ...p, bounds: getPathBounds(p.path) }));

interface Props {
  onSelectProvince: (provinceName: string) => void;
}

export default function ProvinceCarousel({ onSelectProvince }: Props) {
  const [container, setContainer] = useState({ width: 0, height: 0 });
  const [activeIndex, setActiveIndex] = useState(0);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setContainer({ width, height });
  }

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const interval = cardWidth + CARD_GAP;
    if (interval <= 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / interval);
    setActiveIndex(Math.min(Math.max(idx, 0), PROVINCE_CARDS.length - 1));
  }

  const cardWidth = Math.round(container.width * CARD_WIDTH_RATIO);
  const cardHeight = Math.max(0, container.height - FOOTER_HEIGHT - TOP_INSET);
  const sidePadding = Math.max(0, (container.width - cardWidth) / 2);

  return (
    <View style={styles.wrapper} onLayout={onLayout}>
      {container.width > 0 && (
        <FlatList
          data={PROVINCE_CARDS}
          keyExtractor={(item) => item.plate}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + CARD_GAP}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: sidePadding }}
          onMomentumScrollEnd={handleScrollEnd}
          style={{ height: cardHeight, marginTop: TOP_INSET }}
          renderItem={({ item }) => (
            <ProvinceCard
              name={item.name}
              path={item.path}
              bounds={item.bounds}
              width={cardWidth}
              height={cardHeight}
              districtCount={DISTRICT_COUNT_BY_CITY[item.name] ?? 0}
              onPress={() => onSelectProvince(item.name)}
            />
          )}
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.counter}>
          {activeIndex + 1} / {PROVINCE_CARDS.length}
        </Text>
      </View>
    </View>
  );
}

function ProvinceCard({
  name,
  path,
  bounds,
  width,
  height,
  districtCount,
  onPress,
}: {
  name: string;
  path: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  width: number;
  height: number;
  districtCount: number;
  onPress: () => void;
}) {
  const region = getRegion(name);
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const padX = w * 0.15 || 10;
  const padY = h * 0.15 || 10;
  const boxW = w + padX * 2;
  const boxH = h + padY * 2;
  const centerX = bounds.minX + w / 2;
  const centerY = bounds.minY + h / 2;
  const hasData = districtCount > 0;

  // İlin sınırlarını karta ortalayıp yakınlaştırmak için: haritanın zaten
  // çalıştığı doğrulanmış tek viewBox'ı (TURKEY_MAP_VIEWBOX) hiç değiştirmeden,
  // içeriği bu ilin bölgesine odaklayan bir scale/translate uyguluyoruz —
  // ile özel bir viewBox kırpması bazı illerde şekli görünmez kılıyordu.
  const scale = width && height ? Math.max(width / boxW, height / boxH) : 0;
  const translateX = width / 2 - centerX * scale;
  const translateY = height / 2 - centerY * scale;

  // Kart, ilin ait olduğu coğrafi bölgenin tonuyla boyanır.
  const baseColor = region?.color ?? colors.mapUnconquered;
  const gradientColors: [string, string] = [
    shadeColor(baseColor, 18),
    shadeColor(baseColor, -22),
  ];

  const badgeLabel = hasData ? 'İNCELE' : 'YAKINDA';

  return (
    <Pressable onPress={onPress} style={{ width, height, marginRight: CARD_GAP }}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {width > 0 && height > 0 && (
          <Svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={StyleSheet.absoluteFill}
          >
            <G transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
              <Path d={path} fill="rgba(255,255,255,0.2)" />
            </G>
          </Svg>
        )}

        <View style={styles.cardTextBlock}>
          <Text style={styles.cardCity} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.cardMeta}>
            {region ? `${region.name} · ` : ''}
            {hasData ? `${districtCount} ilçe` : 'Çok yakında'}
          </Text>
        </View>

        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>{badgeLabel}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    padding: 16,
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  cardTextBlock: {
    paddingRight: 70,
  },
  cardCity: {
    color: colors.textInverse,
    fontSize: 24,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  cardMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  cardBadge: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  cardBadgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  footer: {
    height: FOOTER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
