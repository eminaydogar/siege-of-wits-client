import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PlayerProfileModal from '../components/PlayerProfileModal';
import { RootStackScreenProps } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { colors } from '../theme/colors';
import { raisedCardLight } from '../theme/shadows';
import { Player } from '../types';
import { shadeColor } from '../utils/color';

/** İlk üç basamağın madalya rengi ve adı. */
const MEDALS = [
  { color: colors.gold, label: 'ALTIN' },
  { color: '#B8C0CC', label: 'GÜMÜŞ' },
  { color: '#C87F45', label: 'BRONZ' },
] as const;

interface LeaderboardRow {
  player: Player;
  cityCount: number;
  totalScore: number;
}

export default function LeaderboardScreen({ navigation }: RootStackScreenProps<'Leaderboard'>) {
  const insets = useSafeAreaInsets();
  const getLeaderboard = useGameStore((s) => s.getLeaderboard);
  const localPlayer = useGameStore((s) => s.localPlayer);
  useGameStore((s) => s.conquests); // re-render tetikleyici
  const leaderboard = getLeaderboard();

  // Profil kartı: dokunulan oyuncu ve onun basamağı.
  const [selected, setSelected] = useState<{ player: Player; rank: number } | null>(null);

  // Şehir çubuklarının ölçeği: lider her zaman tam dolu görünür.
  const topCityCount = Math.max(1, ...leaderboard.map((row) => row.cityCount));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Lacivert başlık bandı — sayfanın kalanı beyaz. */}
      <LinearGradient
        colors={[shadeColor(colors.navy, 16), colors.navy, shadeColor(colors.navy, -30)]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <MaterialCommunityIcons
          name="trophy"
          size={128}
          color="rgba(255,255,255,0.09)"
          style={styles.ghostIcon}
        />

        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={16} color={colors.textInverse} />
            <Text style={styles.backText}>Geri Dön</Text>
          </Pressable>

          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>
              Sıralama Tablosu
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {leaderboard.length} komutan yarışıyor
            </Text>
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.player.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <PlayerRow
            row={item}
            rank={index + 1}
            isLocal={item.player.id === localPlayer.id}
            fill={item.cityCount / topCityCount}
            onOpenProfile={() => setSelected({ player: item.player, rank: index + 1 })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="flag-off-outline" size={26} color={colors.textMuted} />
            <Text style={styles.emptyText}>Henüz fethedilmiş bölge yok.</Text>
          </View>
        }
      />

      <PlayerProfileModal
        player={selected?.player ?? null}
        rank={selected?.rank}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

function PlayerRow({
  row,
  rank,
  isLocal,
  fill,
  onOpenProfile,
}: {
  row: LeaderboardRow;
  rank: number;
  isLocal: boolean;
  /** 0-1 arası; lidere göre şehir oranı. */
  fill: number;
  onOpenProfile: () => void;
}) {
  const medal = rank <= 3 ? MEDALS[rank - 1] : null;
  const accent = medal?.color ?? colors.border;

  return (
    <View style={[styles.card, raisedCardLight, isLocal && styles.cardLocal]}>
      {/* Basamağı uzaktan okutan renk şeridi. */}
      <View style={[styles.accent, { backgroundColor: accent }]} />

      {/* Profil fotoğrafı: dokununca oyuncunun kartı açılır. */}
      <Pressable onPress={onOpenProfile} hitSlop={6} style={styles.avatarPress}>
        <View style={[styles.avatar, { borderColor: row.player.color }]}>
          {row.player.avatar ? (
            <Image source={{ uri: row.player.avatar }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: row.player.color }]}>
              <Text style={styles.avatarInitial}>
                {row.player.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Basamak rozeti fotoğrafın köşesine oturur. */}
        <View
          style={[
            styles.rankBadge,
            { backgroundColor: medal ? medal.color : colors.surface },
            !medal && styles.rankBadgePlain,
          ]}
        >
          {medal ? (
            <MaterialCommunityIcons name="crown" size={11} color="#3B2E06" />
          ) : (
            <Text style={styles.rankBadgeText}>{rank}</Text>
          )}
        </View>
      </Pressable>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {row.player.name}
          </Text>
          {isLocal ? (
            <View style={styles.youChip}>
              <Text style={styles.youChipText}>SEN</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <MaterialCommunityIcons name="city-variant-outline" size={12} color={colors.navy} />
            <Text style={styles.chipText}>{row.cityCount} şehir</Text>
          </View>
          {medal ? (
            <View style={[styles.chip, { borderColor: medal.color }]}>
              <MaterialCommunityIcons name="medal-outline" size={12} color={colors.navy} />
              <Text style={styles.chipText}>{medal.label}</Text>
            </View>
          ) : null}
        </View>

        {/* Fetih çubuğu: liderin toprağına göre doluluk. */}
        <View style={styles.bar}>
          <View
            style={[
              styles.barFill,
              {
                width: `${Math.max(6, Math.round(fill * 100))}%`,
                backgroundColor: row.player.color,
              },
            ]}
          />
        </View>
      </View>

      {/* Toplam puan: kartın sağ ucundaki skor sütunu. */}
      <View style={styles.scoreBlock}>
        <Text style={styles.scoreValue}>{row.totalScore}</Text>
        <Text style={styles.scoreLabel}>PUAN</Text>
      </View>
    </View>
  );
}

const AVATAR = 54;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  ghostIcon: {
    position: 'absolute',
    right: -18,
    top: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  backText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '800',
  },
  titleBlock: {
    flex: 1,
    gap: 1,
  },
  title: {
    color: colors.textInverse,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: 'rgba(248,250,252,0.66)',
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 12,
    paddingLeft: 18,
    paddingRight: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardLocal: {
    backgroundColor: '#F7F3FF',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  avatarPress: {
    width: AVATAR,
    height: AVATAR,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2.5,
    overflow: 'hidden',
    backgroundColor: colors.backgroundLight,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  rankBadge: {
    position: 'absolute',
    left: -4,
    bottom: -2,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  rankBadgePlain: {
    borderColor: colors.border,
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textMuted,
  },
  info: {
    flex: 1,
    gap: 5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  youChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.navy,
  },
  youChipText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.navy,
  },
  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.backgroundLight,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreBlock: {
    alignItems: 'center',
    minWidth: 42,
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.navy,
  },
  scoreLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});
