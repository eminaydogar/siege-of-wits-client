import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useState } from 'react';
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
import { getContinent } from '../data/continents';
import { getCityCount } from '../data/worldCities';
import { COUNTRY_PATHS, CountryPath } from '../data/worldCountryPaths';
import { colors } from '../theme/colors';
import { shadeColor } from '../utils/color';

const CARD_GAP = 14;
const CARD_WIDTH_RATIO = 0.76;
const FOOTER_HEIGHT = 30;
const TOP_INSET = 54;

// Şehir verisi olan ülkeler önce; kalanlar "yakında" olarak listenin sonunda.
const COUNTRY_CARDS = [...COUNTRY_PATHS].sort((a, b) => {
  const diff = Math.sign(getCityCount(b.code)) - Math.sign(getCityCount(a.code));
  return diff !== 0 ? diff : a.name.localeCompare(b.name, 'tr');
});

interface Props {
  onSelectCountry: (code: string) => void;
}

function CountryCarousel({ onSelectCountry }: Props) {
  const [container, setContainer] = useState({ width: 0, height: 0 });
  const [activeIndex, setActiveIndex] = useState(0);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setContainer({ width, height });
  }

  const cardWidth = Math.round(container.width * CARD_WIDTH_RATIO);
  const cardHeight = Math.max(0, container.height - FOOTER_HEIGHT - TOP_INSET);
  const sidePadding = Math.max(0, (container.width - cardWidth) / 2);
  const interval = cardWidth + CARD_GAP;

  const renderItem = useCallback(
    ({ item }: { item: CountryPath }) => (
      <CountryCard
        country={item}
        width={cardWidth}
        height={cardHeight}
        cityCount={getCityCount(item.code)}
        onSelect={onSelectCountry}
      />
    ),
    [cardWidth, cardHeight, onSelectCountry]
  );

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (interval <= 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / interval);
    setActiveIndex(Math.min(Math.max(idx, 0), COUNTRY_CARDS.length - 1));
  }

  return (
    <View style={styles.wrapper} onLayout={onLayout}>
      {container.width > 0 && (
        <FlatList
          data={COUNTRY_CARDS}
          keyExtractor={(item) => item.code}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={interval}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: sidePadding }}
          onMomentumScrollEnd={handleScrollEnd}
          style={{ height: cardHeight, marginTop: TOP_INSET }}
          initialNumToRender={3}
          windowSize={5}
          removeClippedSubviews
          getItemLayout={(_, index) => ({
            length: interval,
            offset: interval * index,
            index,
          })}
          renderItem={renderItem}
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.counter}>
          {activeIndex + 1} / {COUNTRY_CARDS.length}
        </Text>
      </View>
    </View>
  );
}

/**
 * Kart, ülkenin sınır SVG'sini çiziyor — react-native-svg her render'da tüm
 * vektör ağacını yeniden rasterleştirdiği için bu iş pahalı. Bu yüzden hem
 * kart hem de karüselin kendisi memo'lu: ana ekrandaki alakasız bir state
 * değişimi (ör. savaş modalının açılması) buraya kadar inmesin.
 */
const CountryCard = memo(function CountryCard({
  country,
  width,
  height,
  cityCount,
  onSelect,
}: {
  country: CountryPath;
  width: number;
  height: number;
  cityCount: number;
  onSelect: (code: string) => void;
}) {
  const continent = getContinent(country.continent);
  const { bounds } = country;
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const padX = w * 0.15 || 10;
  const padY = h * 0.15 || 10;
  const boxW = w + padX * 2;
  const boxH = h + padY * 2;
  const centerX = bounds.minX + w / 2;
  const centerY = bounds.minY + h / 2;
  const hasData = cityCount > 0;

  // Ülkeyi karta ortalayıp yakınlaştırmak için viewBox'ı kırpmak yerine
  // içeriğe scale/translate uyguluyoruz (bkz. ProvinceCarousel'deki aynı yaklaşım).
  const scale = width && height ? Math.min(width / boxW, height / boxH) : 0;
  const translateX = width / 2 - centerX * scale;
  const translateY = height / 2 - centerY * scale;

  const baseColor = continent?.color ?? colors.mapUnconquered;
  const gradientColors: [string, string] = [
    shadeColor(baseColor, 18),
    shadeColor(baseColor, -22),
  ];

  return (
    <Pressable
      onPress={() => onSelect(country.code)}
      style={{ width, height, marginRight: CARD_GAP }}
    >
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
              <Path d={country.path} fill="rgba(255,255,255,0.22)" fillRule="evenodd" />
            </G>
          </Svg>
        )}

        <View style={styles.cardTextBlock}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {country.name}
          </Text>
          <Text style={styles.cardMeta}>
            {continent ? `${continent.name} · ` : ''}
            {hasData ? `${cityCount} şehir` : 'Çok yakında'}
          </Text>
        </View>

        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>{hasData ? 'İNCELE' : 'YAKINDA'}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
});

export default memo(CountryCarousel);

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
  cardTitle: {
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
