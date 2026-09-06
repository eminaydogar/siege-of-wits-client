import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GameListCard from '../components/GameListCard';
import { useFocusedStatusBar } from '../hooks/useFocusedStatusBar';
import { colors, skyBackground, skyBackgroundLocations } from '../theme/colors';

const UPCOMING_ITEMS: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  accent: string;
}[] = [
  {
    icon: 'color-palette',
    title: 'Özel Renkler',
    desc: 'Bölgen için özel renk tonları aç',
    accent: colors.primary,
  },
  {
    icon: 'shield',
    title: 'Savunma Kalkanı',
    desc: 'Toprağını bir sonraki saldırıya karşı koru',
    accent: '#5FE0B0',
  },
  {
    icon: 'flash',
    title: 'İpucu Hakkı',
    desc: 'Zor sorularda bir şıkkı eleyebil',
    accent: '#FFD35C',
  },
];

export default function ShopScreen() {
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
            <Ionicons name="storefront" size={22} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Mağaza</Text>
            <Text style={styles.subtitle}>Fetihlerini kolaylaştıracak eşyalar</Text>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>TEZGÂHA GELECEKLER</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.list}>
          {UPCOMING_ITEMS.map((item) => (
            <GameListCard
              key={item.title}
              icon={item.icon}
              title={item.title}
              desc={item.desc}
              accent={item.accent}
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
    backgroundColor: 'rgba(217,153,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(217,153,255,0.4)',
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
