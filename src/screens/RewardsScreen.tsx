import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GameListCard from '../components/GameListCard';
import { useFocusedStatusBar } from '../hooks/useFocusedStatusBar';
import { colors, skyBackground, skyBackgroundLocations } from '../theme/colors';

const UPCOMING_REWARDS: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  accent: string;
}[] = [
  {
    icon: 'flame',
    title: 'Günlük Fetih Serisi',
    desc: 'Art arda gün fethet, bonus puan kazan',
    accent: '#FF7E6B',
  },
  {
    icon: 'ribbon',
    title: 'İlk 5 İl Rozeti',
    desc: '5 farklı ili fethedince açılır',
    accent: colors.gold,
  },
  {
    icon: 'diamond',
    title: 'Bölge Ustası',
    desc: 'Bir ildeki tüm ilçeleri tek başına tut',
    accent: '#5CC6FF',
  },
];

export default function RewardsScreen() {
  const insets = useSafeAreaInsets();
  // Zeminin tepesi gece mavisi: sistem ikonları açık olmalı.
  useFocusedStatusBar('light');

  return (
    <LinearGradient
      colors={skyBackground}
      locations={skyBackgroundLocations}
      style={styles.container}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="gift" size={22} color={colors.gold} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Ödüller</Text>
            <Text style={styles.subtitle}>Fetihlerinle rozetler ve bonuslar kazan</Text>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>YOLDA OLANLAR</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.list}>
          {UPCOMING_REWARDS.map((reward) => (
            <GameListCard
              key={reward.title}
              icon={reward.icon}
              title={reward.title}
              desc={reward.desc}
              accent={reward.accent}
              badge="Yakında"
            />
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.38)',
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.textInverse,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(248,250,252,0.66)',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: -8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: colors.textMutedInverse,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  list: {
    gap: 12,
  },
});
