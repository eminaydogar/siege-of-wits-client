import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ComponentProps, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { WorldCity } from '../data/worldCities';
import { COUNTRY_PATHS, getCountry } from '../data/worldCountryPaths';
import { useGameStore } from '../store/gameStore';
import { colors } from '../theme/colors';
import { Player } from '../types';
import { shadeColor } from '../utils/color';

/**
 * Fethedilen şehir şeridinin sayfa boyu: her istekte 5 şehir.
 *
 * Servis bağlanınca `loadMore` bu boyla uca gidecek (?page=&size=5), dönen
 * sayfa listenin sonuna eklenecek ve istek sürerken şeridin ucundaki mini
 * yükleme kutusu görünecek. Şu an veri store'dan geldiği için aynı mantık
 * yerelde dilimleniyor — şerit takılmadan kayar, sona gelince sonraki beşli açılır.
 */
const PAGE_SIZE = 5;

const CITY_CARD_WIDTH = 132;
const CITY_CARD_HEIGHT = 158;
const CITY_CARD_GAP = 10;

/** Şehir kutusunun arkasındaki harita penceresinin viewBox birimi cinsinden genişliği. */
const LAND_SPAN = 30;

const MONTHS_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

/** "12 Mart 2024" — Intl'e bağlı kalmadan sabit Türkçe biçim. */
function formatJoinDate(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getDate()} ${MONTHS_TR[date.getMonth()]} ${date.getFullYear()}`;
}

interface Props {
  /** null ise modal kapalı. */
  player: Player | null;
  /** Sıralama tablosundaki basamak — başlıktaki madalyayı belirler. */
  rank?: number;
  onClose: () => void;
}

function ProfileCard({ player, rank, onClose }: Props & { player: Player }) {
  const getPlayerCities = useGameStore((s) => s.getPlayerCities);
  const conquests = useGameStore((s) => s.conquests); // fetih değişince liste tazelensin

  const cities = useMemo(
    () => getPlayerCities(player.id),
    [getPlayerCities, player.id, conquests]
  );
  const totalScore = useMemo(() => cities.reduce((sum, item) => sum + item.score, 0), [cities]);

  // Şeridin o an basılmış sayfa sayısı. Oyuncu değişince baştan başlar.
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [player.id]);

  const visibleCities = cities.slice(0, page * PAGE_SIZE);
  const hasMore = visibleCities.length < cities.length;

  function loadMore() {
    if (!hasMore) return;
    // Servis bağlanınca istek burada atılacak; sayfa dönene kadar şeridin
    // sonundaki yükleme kutusu bekler.
    setPage((p) => p + 1);
  }

  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withSpring(1, { damping: 14, stiffness: 190, mass: 0.7 });
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.6),
    transform: [{ scale: 0.9 + enter.value * 0.1 }, { translateY: (1 - enter.value) * 26 }],
  }));

  const medalColor = rank && rank <= 3 ? MEDAL_COLORS[rank - 1] : null;

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      {/* Lacivert kimlik bandı — sıralama tablosunun başlığıyla aynı dil. */}
      <LinearGradient
        colors={[shadeColor(colors.navy, 18), colors.navy, shadeColor(colors.navy, -34)]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={styles.head}
      >
        <MaterialCommunityIcons
          name="shield-crown"
          size={132}
          color="rgba(255,255,255,0.10)"
          style={styles.ghostIcon}
        />

        <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={19} color="#FFFFFF" />
        </Pressable>

        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: player.color }]}>
            {player.avatar ? (
              <Image source={{ uri: player.avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>{player.name.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          {medalColor ? (
            <View style={[styles.medal, { backgroundColor: medalColor }]}>
              <Text style={styles.medalText}>{rank}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.name} numberOfLines={1}>
          {player.name}
        </Text>
        <View style={styles.rankRow}>
          <View style={[styles.colorSwatch, { backgroundColor: player.color }]} />
          <Text style={styles.rankText}>{rank ? `Sıralamada ${rank}.` : 'Komutan'}</Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.statsRow}>
          <Stat icon="city-variant-outline" value={String(cities.length)} label="Şehir" />
          <Stat icon="sword-cross" value={String(totalScore)} label="Puan" />
          <Stat
            icon="calendar-account-outline"
            value={formatJoinDate(player.joinedAt)}
            label="Katılım"
            wide
          />
        </View>

        <View style={styles.sectionHead}>
          <MaterialCommunityIcons name="flag-variant" size={14} color={colors.navy} />
          <Text style={styles.sectionTitle}>FETHETTİĞİ ŞEHİRLER</Text>
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{cities.length}</Text>
          </View>
        </View>

        {cities.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="map-marker-off-outline"
              size={22}
              color={colors.textMuted}
            />
            <Text style={styles.emptyText}>Henüz fethedilmiş şehri yok.</Text>
          </View>
        ) : (
          <FlatList
            data={visibleCities}
            keyExtractor={(item) => item.city.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CITY_CARD_WIDTH + CITY_CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={styles.stripContent}
            style={styles.strip}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            renderItem={({ item }) => (
              <CityBox city={item.city} score={item.score} color={player.color} />
            )}
            ListFooterComponent={
              hasMore ? (
                // Sayfa isteği sürerken görünen mini yükleme kutusu.
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={colors.navy} />
                  <Text style={styles.loadingText}>Yükleniyor</Text>
                </View>
              ) : null
            }
          />
        )}

        <Text style={styles.note}>Şehirleri görmek için şeridi sola kaydır.</Text>
      </View>
    </Animated.View>
  );
}

/** Şehir listesindeki kutuların küçültülmüş hâli: arkasında gerçek harita parçası. */
function CityBox({ city, score, color }: { city: WorldCity; score: number; color: string }) {
  const country = getCountry(city.country);
  const scale = CITY_CARD_WIDTH / LAND_SPAN;
  const translateX = CITY_CARD_WIDTH / 2 - city.x * scale;
  const translateY = CITY_CARD_HEIGHT / 2 - city.y * scale;

  // Pencereye giren kara parçaları: kendi ülkesi belirgin, komşular soluk.
  const visibleLands = useMemo(() => {
    const halfW = LAND_SPAN / 2;
    const halfH = CITY_CARD_HEIGHT / scale / 2;
    return COUNTRY_PATHS.filter(
      (c) =>
        c.bounds.maxX >= city.x - halfW &&
        c.bounds.minX <= city.x + halfW &&
        c.bounds.maxY >= city.y - halfH &&
        c.bounds.minY <= city.y + halfH
    );
  }, [city.x, city.y, scale]);

  return (
    <LinearGradient
      colors={[shadeColor(color, 22), shadeColor(color, -34)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.cityBox}
    >
      <Svg
        width={CITY_CARD_WIDTH}
        height={CITY_CARD_HEIGHT}
        viewBox={`0 0 ${CITY_CARD_WIDTH} ${CITY_CARD_HEIGHT}`}
        style={StyleSheet.absoluteFill}
      >
        <G transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
          {visibleLands.map((land) => (
            <Path
              key={land.code}
              d={land.path}
              fill={
                land.code === city.country ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.12)'
              }
              fillRule="evenodd"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={0.5 / scale}
            />
          ))}
          <Circle cx={city.x} cy={city.y} r={9 / scale} fill="rgba(255,255,255,0.25)" />
          <Circle
            cx={city.x}
            cy={city.y}
            r={4 / scale}
            fill={colors.gold}
            stroke="#FFFFFF"
            strokeWidth={1.4 / scale}
          />
        </G>
      </Svg>

      {/* Yazıların altındaki karartma: harita ne kadar açık olursa olsun okunur. */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.cityScore}>
        <MaterialCommunityIcons name="sword-cross" size={10} color={colors.gold} />
        <Text style={styles.cityScoreText}>{score}</Text>
      </View>

      {city.isCapital ? (
        <View style={styles.capitalDot}>
          <Ionicons name="star" size={9} color={colors.gold} />
        </View>
      ) : null}

      <View style={styles.cityBottom}>
        <Text style={styles.cityName} numberOfLines={2}>
          {city.name}
        </Text>
        <Text style={styles.cityCountry} numberOfLines={1}>
          {country?.name ?? city.country}
        </Text>
      </View>
    </LinearGradient>
  );
}

function Stat({
  icon,
  value,
  label,
  wide,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  value: string;
  label: string;
  /** Katılma tarihi sayılardan uzun; kutusu geniş ve küçük puntolu olur. */
  wide?: boolean;
}) {
  return (
    <View style={[styles.stat, wide && styles.statWide]}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.navy} />
      <Text style={[styles.statValue, wide && styles.statValueWide]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** İlk üç basamağın madalya rengi: altın, gümüş, bronz. */
const MEDAL_COLORS = [colors.gold, '#B8C0CC', '#C87F45'] as const;

export default function PlayerProfileModal({ player, rank, onClose }: Props) {
  return (
    <Modal
      transparent
      visible={player !== null}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Perdeye dokunmak kapatır; kart bunun üstünde ayrı bir katman. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {player ? <ProfileCard player={player} rank={rank} onClose={onClose} /> : null}
      </View>
    </Modal>
  );
}

const RADIUS = 26;
const AVATAR = 76;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(6,8,26,0.74)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: RADIUS,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 14,
  },
  head: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  ghostIcon: {
    position: 'absolute',
    right: -22,
    top: -18,
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  avatarWrap: {
    width: AVATAR,
    height: AVATAR,
    marginBottom: 10,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
  },
  medal: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  medalText: {
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '900',
  },
  name: {
    color: colors.textInverse,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  colorSwatch: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  rankText: {
    color: 'rgba(248,250,252,0.72)',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    padding: 16,
    gap: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statWide: {
    flex: 1.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.navy,
  },
  statValueWide: {
    fontSize: 12,
    marginTop: 3,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.navy,
  },
  sectionCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textMuted,
  },
  strip: {
    // Yükseklik sabitlenmezse yatay FlatList dikeyde büyüyor.
    height: CITY_CARD_HEIGHT,
    flexGrow: 0,
    // Şerit kartın kenarlarına kadar uzansın; iç boşluk contentContainer'da.
    marginHorizontal: -16,
  },
  stripContent: {
    paddingHorizontal: 16,
    gap: CITY_CARD_GAP,
  },
  cityBox: {
    width: CITY_CARD_WIDTH,
    height: CITY_CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 10,
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  cityScore: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  cityScoreText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  capitalDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  cityBottom: {
    gap: 1,
  },
  cityName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cityCountry: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    fontWeight: '700',
  },
  loadingBox: {
    width: 96,
    height: CITY_CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
  },
  empty: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 22,
    borderRadius: 16,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  note: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
