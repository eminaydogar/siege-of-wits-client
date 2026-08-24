import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import Button3D from '../components/Button3D';
import { getContinent } from '../data/continents';
import { getCitiesOfCountry, WorldCity } from '../data/worldCities';
import { COUNTRY_PATHS, getCountry } from '../data/worldCountryPaths';
import { RootStackScreenProps } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { colors } from '../theme/colors';
import { shadeColor } from '../utils/color';

const CARD_GAP = 14;
const CARD_WIDTH_RATIO = 0.78;
const FOOTER_HEIGHT = 34;
// Kart yüksekliği genişliğinin katı olarak sınırlanır; ekranın tamamını kaplayan
// upuzun kartlar yerine elde tutulabilir bir oran.
const CARD_ASPECT = 1.15;

// Kart arkasındaki kara parçasının kaç viewBox birimi genişlik göstereceği.
// Küçük ülkelerde tamamı, dev ülkelerde şehrin çevresi görünsün diye sınırlı.
const MIN_LAND_SPAN = 26;
const MAX_LAND_SPAN = 130;
const LAND_SPAN_RATIO = 0.75;

function formatPopulation(population: number): string {
  if (population >= 1_000_000) {
    return `${(population / 1_000_000).toFixed(1).replace('.', ',')} milyon nüfus`;
  }
  if (population >= 1_000) {
    return `${Math.round(population / 1_000)} bin nüfus`;
  }
  return `${population} nüfus`;
}

export default function CityListScreen({ route, navigation }: RootStackScreenProps<'CityList'>) {
  const { countryCode } = route.params;
  const country = getCountry(countryCode);
  const cities = useMemo(() => getCitiesOfCountry(countryCode), [countryCode]);
  const continent = country ? getContinent(country.continent) : undefined;

  const getOwner = useGameStore((s) => s.getOwner);
  const localPlayer = useGameStore((s) => s.localPlayer);
  const conquests = useGameStore((s) => s.conquests); // re-render tetikleyici

  const [container, setContainer] = useState({ width: 0, height: 0 });
  const [activeIndex, setActiveIndex] = useState(0);

  const ownedCount = cities.filter(
    (city) => conquests[city.id]?.ownerId === localPlayer.id
  ).length;

  // Şehrin çevresindeki kara parçası: ülkenin kendisi + o pencereye giren komşuları.
  const landSpan = useMemo(() => {
    if (!country) return MIN_LAND_SPAN;
    const w = country.bounds.maxX - country.bounds.minX;
    const h = country.bounds.maxY - country.bounds.minY;
    return Math.min(MAX_LAND_SPAN, Math.max(MIN_LAND_SPAN, Math.max(w, h) * LAND_SPAN_RATIO));
  }, [country]);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setContainer({ width, height });
  }

  const cardWidth = Math.round(container.width * CARD_WIDTH_RATIO);
  const cardHeight = Math.min(
    Math.max(0, container.height - FOOTER_HEIGHT),
    Math.round(cardWidth * CARD_ASPECT)
  );
  const sidePadding = Math.max(0, (container.width - cardWidth) / 2);
  const interval = cardWidth + CARD_GAP;

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (interval <= 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / interval);
    setActiveIndex(Math.min(Math.max(idx, 0), cities.length - 1));
  }

  function handleAttack(city: WorldCity) {
    const owner = getOwner(city.id);
    Alert.alert(
      owner ? 'Saldırı' : 'Fetih',
      owner
        ? `${city.name} şu an ${owner.name} elinde (skor ${owner.score}). Saldırıya geçilsin mi?`
        : `${city.name} henüz fethedilmemiş. Sınava girilsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: owner ? 'Saldır' : 'Fethet',
          style: 'destructive',
          onPress: () => navigation.navigate('Quiz', { targetId: city.id }),
        },
      ]
    );
  }

  if (!country) return null;

  if (cities.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>{country.name}</Text>
        <Text style={styles.emptyText}>
          Bu ülke için henüz şehir verisi yok. Yakında daha fazla ülke savaş alanına
          açılacak.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {continent ? `${continent.name} · ` : ''}
          {cities.length} şehir
        </Text>
        <View style={styles.summaryChip}>
          <Ionicons name="flag" size={12} color={colors.gold} />
          <Text style={styles.summaryChipText}>{ownedCount} fethedildi</Text>
        </View>
      </View>

      <View style={styles.carousel} onLayout={onLayout}>
        {container.width > 0 && (
          <FlatList
            data={cities}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={interval}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: sidePadding }}
            onMomentumScrollEnd={handleScrollEnd}
            style={{ height: cardHeight }}
            getItemLayout={(_, index) => ({
              length: interval,
              offset: interval * index,
              index,
            })}
            renderItem={({ item }) => (
              <CityCard
                city={item}
                countryCode={countryCode}
                continentColor={continent?.color ?? colors.mapUnconquered}
                landSpan={landSpan}
                width={cardWidth}
                height={cardHeight}
                onAttack={() => handleAttack(item)}
              />
            )}
          />
        )}

        <View style={styles.footer}>
          <Text style={styles.counter}>
            {activeIndex + 1} / {cities.length}
          </Text>
        </View>
      </View>
    </View>
  );
}

function CityCard({
  city,
  countryCode,
  continentColor,
  landSpan,
  width,
  height,
  onAttack,
}: {
  city: WorldCity;
  countryCode: string;
  continentColor: string;
  landSpan: number;
  width: number;
  height: number;
  onAttack: () => void;
}) {
  const getOwner = useGameStore((s) => s.getOwner);
  const localPlayer = useGameStore((s) => s.localPlayer);
  const owner = getOwner(city.id);
  const isLocalOwner = owner?.id === localPlayer.id;

  // Şehri kartın ortasına alan harita penceresi.
  const scale = width > 0 ? width / landSpan : 0;
  const translateX = width / 2 - city.x * scale;
  const translateY = height / 2 - city.y * scale;

  // Pencereye giren ülkeler: kendi ülkesi belirgin, komşular soluk çizilir —
  // kart arkası gerçek bir harita parçası gibi görünsün diye.
  const visibleLands = useMemo(() => {
    if (scale === 0) return [];
    const halfW = landSpan / 2;
    const halfH = height / scale / 2;
    const minX = city.x - halfW;
    const maxX = city.x + halfW;
    const minY = city.y - halfH;
    const maxY = city.y + halfH;
    return COUNTRY_PATHS.filter(
      (c) =>
        c.bounds.maxX >= minX &&
        c.bounds.minX <= maxX &&
        c.bounds.maxY >= minY &&
        c.bounds.minY <= maxY
    );
  }, [city.x, city.y, landSpan, scale, height]);

  const baseColor = isLocalOwner
    ? localPlayer.color
    : owner
      ? owner.color
      : continentColor;
  const gradientColors: [string, string] = [
    shadeColor(baseColor, 20),
    shadeColor(baseColor, -32),
  ];

  const statusText = isLocalOwner
    ? 'Senin toprağın'
    : owner
      ? `${owner.name} · Skor ${owner.score}`
      : 'Fethedilmemiş';

  return (
    <View style={{ width, height, marginRight: CARD_GAP }}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, isLocalOwner && styles.cardOwned]}
      >
        {width > 0 && height > 0 && (
          <Svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={StyleSheet.absoluteFillObject}
          >
            <G transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
              {visibleLands.map((land) => (
                <Path
                  key={land.code}
                  d={land.path}
                  fill={
                    land.code === countryCode
                      ? 'rgba(255,255,255,0.30)'
                      : 'rgba(255,255,255,0.12)'
                  }
                  fillRule="evenodd"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={0.5 / scale}
                />
              ))}

              {/* Şehir işareti: dışta halka, ortada dolu nokta. Yarıçaplar ölçeğe
                  bölünüyor ki zoom ne olursa olsun ekranda aynı büyüklükte dursun. */}
              <Circle
                cx={city.x}
                cy={city.y}
                r={12 / scale}
                fill="rgba(255,255,255,0.25)"
              />
              <Circle
                cx={city.x}
                cy={city.y}
                r={5 / scale}
                fill={colors.gold}
                stroke="#FFFFFF"
                strokeWidth={1.6 / scale}
              />
            </G>
          </Svg>
        )}

        {/* Metnin altındaki karartma: harita ne kadar açık olursa olsun yazı okunur. */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {city.isCapital && (
          <View style={styles.capitalBadge}>
            <Ionicons name="star" size={11} color={colors.gold} />
            <Text style={styles.capitalBadgeText}>BAŞKENT</Text>
          </View>
        )}

        <View style={styles.cardBottom}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {city.name}
          </Text>
          <Text style={styles.cardMeta}>{formatPopulation(city.population)}</Text>

          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: owner ? owner.color : 'rgba(255,255,255,0.6)' },
              ]}
            />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>

          <Button3D
            color={isLocalOwner ? colors.surface : colors.primary}
            disabled={isLocalOwner}
            onPress={onAttack}
            style={styles.attackButton}
          >
            <Text style={styles.attackButtonText}>
              {isLocalOwner
                ? 'Fethedildi'
                : owner
                  ? `Saldır · Geçilecek skor ${owner.score}`
                  : 'Fethet'}
            </Text>
          </Button3D>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  summaryChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  carousel: {
    flex: 1,
    // Kartlar ekran boyunu kaplamadığı için dikeyde ortalanır.
    justifyContent: 'center',
    paddingBottom: 12,
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
  cardOwned: {
    borderWidth: 2,
    borderColor: colors.gold,
  },
  capitalBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  capitalBadgeText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardBottom: {
    gap: 6,
  },
  cardTitle: {
    color: colors.textInverse,
    fontSize: 26,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  cardMeta: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  statusText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '700',
  },
  attackButton: {
    marginTop: 2,
  },
  attackButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  footer: {
    height: FOOTER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.backgroundLight,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
