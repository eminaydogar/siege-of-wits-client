import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMusic } from '../audio/MusicProvider';
import BattleModal, { BattleBriefing } from '../components/BattleModal';
import CountryCarousel from '../components/CountryCarousel';
import GameModeCard from '../components/GameModeCard';
import { useFocusedStatusBar } from '../hooks/useFocusedStatusBar';
import WorldGlobeView from '../components/WorldGlobeView';
// Pasif kalan harita sürümleri — geri dönmek için ilgili import ve aşağıdaki
// harita bloğunu tekrar açmak yeterli:
// import SkyBackdrop from '../components/SkyBackdrop';       // SVG gökyüzü + bulutlar
// import WorldGlobe from '../components/WorldGlobe';           // SVG küre (yavaştı)
// import ZoomableWorldMap from '../components/ZoomableWorldMap'; // düz dünya haritası
// import ProvinceCarousel from '../components/ProvinceCarousel'; // Türkiye kurgusu
// import ZoomableTurkeyMap from '../components/ZoomableTurkeyMap'; // Türkiye kurgusu
import { WORLD_CITIES, WorldCity } from '../data/worldCities';
import { getCountry } from '../data/worldCountryPaths';
import { TabScreenProps } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { colors, skyBackground, skyBackgroundLocations } from '../theme/colors';

type ViewMode = 'map' | 'list';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Savaş modları. Hem alttaki 2x2 kartların yüzü hem de dokununca açılan
 * brifing modalı bu tek tablodan besleniyor.
 *
 * `description` ve `stats` şu an tasarım için sabit — backend bağlanınca bu
 * alanlar API yanıtından gelecek, kartların ve modalın kodu değişmeyecek.
 */
const BATTLE_MODES = [
  {
    key: 'quick',
    title: 'Hızlı Savaş',
    subtitle: 'Sistem dünyadan rastgele bir şehir seçer. Hemen fethet.',
    tag: 'RASTGELE',
    icon: 'sword-cross',
    gradient: ['#FF7E6B', '#E11D48'],
    description:
      'Dünyanın dört bir yanından rastgele bir şehir karşına çıkar. Hazırlık yok, doğrudan kuşatma: sınavı geçersen bayrağın surlara dikilir.',
    actionLabel: 'Savaşa Katıl',
    stats: [
      { icon: 'help-circle-outline', label: 'Sınav', value: '20 soru' },
      { icon: 'treasure-chest', label: 'Ödül', value: '120 altın' },
      { icon: 'shield-sword', label: 'Zorluk', value: 'Orta' },
    ],
  },
  {
    key: 'targeted',
    title: 'Hedefli Saldırı',
    subtitle: 'Haritadan ülkeyi aç, istediğin şehre doğrudan saldır.',
    tag: 'SEÇİMLİ',
    icon: 'target',
    gradient: ['#5CC6FF', '#2563EB'],
    description:
      'Hedefi sen belirlersin. Küreyi döndür, gözüne kestirdiğin ülkeye dokun ve açılan şehir kartlarından saldıracağın yeri seç.',
    actionLabel: 'Haritayı Aç',
    stats: [
      { icon: 'help-circle-outline', label: 'Sınav', value: '20 soru' },
      { icon: 'treasure-chest', label: 'Ödül', value: '150 altın' },
      { icon: 'shield-sword', label: 'Zorluk', value: 'Hedefe göre' },
    ],
  },
  {
    key: 'neighbor',
    title: 'Komşu Fetih',
    subtitle: 'Bayrak diktiğin ülkelerin diğer şehirlerine saldır.',
    tag: 'STRATEJİ',
    icon: 'fire',
    gradient: ['#5FE0B0', '#0D9488'],
    description:
      'Bayrağının dalgalandığı ülkelerdeki diğer şehirlere yürü. Sınırlarını genişlettikçe önüne yeni komşu hedefler açılır.',
    actionLabel: 'Savaşa Katıl',
    stats: [
      { icon: 'help-circle-outline', label: 'Sınav', value: '20 soru' },
      { icon: 'treasure-chest', label: 'Ödül', value: '180 altın' },
      { icon: 'shield-sword', label: 'Zorluk', value: 'Zor' },
    ],
  },
  {
    key: 'daily',
    title: 'Günlük Kuşatma',
    subtitle: 'Her gün özel bir şehir. Fethedene ekstra altın.',
    tag: 'ÖDÜLLÜ',
    icon: 'trophy-variant',
    gradient: ['#FFD35C', '#E08A00'],
    description:
      'Bugün tüm komutanların karşısına aynı şehir çıkıyor. Kuşatmayı kıranlar ekstra altın ve sıralama puanı kazanır — hak her gün yenilenir.',
    actionLabel: 'Kuşatmaya Katıl',
    stats: [
      { icon: 'help-circle-outline', label: 'Sınav', value: '20 soru' },
      { icon: 'treasure-chest', label: 'Ödül', value: '300 altın' },
      { icon: 'timer-outline', label: 'Süre', value: 'Bugün' },
    ],
  },
] as const;

type BattleMode = (typeof BATTLE_MODES)[number];

export default function AnasayfaScreen({ navigation }: TabScreenProps<'Anasayfa'>) {
  const insets = useSafeAreaInsets();
  // Arka plan görselinin tepesi gece mavisi: ikonlar açık kalmalı.
  useFocusedStatusBar('light');
  const music = useMusic();
  // Açılış ülke kartlarıyla: harita ağır bir bileşen, ancak istenince kurulur.
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  // Küre bir kez kurulduktan sonra ekranda kalır (gizlenir), tekrar yüklenmez.
  const [globeRequested, setGlobeRequested] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  // Açık brifing modalı: gösterilecek içerik + onaylanınca çalışacak eylem.
  const [pending, setPending] = useState<{
    briefing: BattleBriefing;
    confirm: () => void;
  } | null>(null);
  const localPlayer = useGameStore((s) => s.localPlayer);
  const conquests = useGameStore((s) => s.conquests); // re-render tetikleyici

  const ownedCount = useMemo(
    () => Object.values(conquests).filter((c) => c.ownerId === localPlayer.id).length,
    [conquests, localPlayer.id]
  );

  // Karüsel ve küre memo'lu: bu iki geri çağrı her render'da yeniden
  // üretilirse memo delinir ve ülke SVG'leri boşuna yeniden çizilir.
  const handleSelectCountry = useCallback(
    (countryCode: string) => navigation.navigate('CityList', { countryCode }),
    [navigation]
  );
  const handleGlobeReady = useCallback(() => setGlobeReady(true), []);

  // Ülkeler, içlerinde şehri olan oyuncunun rengiyle boyanır.
  const getCountryColors = useGameStore((s) => s.getCountryColors);
  const ownerColors = useMemo(() => getCountryColors(), [conquests, localPlayer.color]);

  function pickRandom(pool: WorldCity[]) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Modun sabit bilgilerini alır, duruma özel alanları üstüne yazar. */
  function openBriefing(
    mode: BattleMode,
    extra: Partial<BattleBriefing>,
    confirm: () => void
  ) {
    setPending({
      briefing: {
        mode: mode.title,
        tag: mode.tag,
        icon: mode.icon,
        gradient: mode.gradient,
        description: mode.description,
        stats: mode.stats,
        actionLabel: mode.actionLabel,
        ...extra,
      },
      confirm,
    });
  }

  /** Hedefi belli olan modlar: onaylanınca doğrudan sınava girilir. */
  function openTargetBriefing(mode: BattleMode, target: WorldCity) {
    openBriefing(
      mode,
      { targetName: target.name, targetParent: getCountry(target.country)?.name ?? '' },
      () => navigation.navigate('Quiz', { targetId: target.id, battleColors: mode.gradient })
    );
  }

  function handleModePress(mode: BattleMode) {
    const state = useGameStore.getState();

    switch (mode.key) {
      case 'quick': {
        const attackable = WORLD_CITIES.filter(
          (city) => state.conquests[city.id]?.ownerId !== state.localPlayer.id
        );
        const pool = attackable.length > 0 ? attackable : WORLD_CITIES;
        openTargetBriefing(mode, pickRandom(pool));
        return;
      }

      case 'targeted':
        // Hedef haritadan seçilecek; onay küreyi açar.
        openBriefing(mode, {}, () => {
          setGlobeRequested(true);
          setViewMode('map');
        });
        return;

      // Komşu Fetih: şimdilik "komşuluk" = bayrak diktiğin ülkedeki diğer
      // şehirler. Gerçek sınır komşuluğu backend'den gelince burası değişecek.
      case 'neighbor': {
        const ownedCountries = new Set(
          WORLD_CITIES.filter(
            (city) => state.conquests[city.id]?.ownerId === state.localPlayer.id
          ).map((city) => city.country)
        );

        if (ownedCountries.size === 0) {
          openBriefing(
            mode,
            { blockedReason: 'Önce Hızlı Savaş ile ilk şehrini fethetmelisin.' },
            () => {}
          );
          return;
        }

        const pool = WORLD_CITIES.filter(
          (city) =>
            ownedCountries.has(city.country) &&
            state.conquests[city.id]?.ownerId !== state.localPlayer.id
        );

        if (pool.length === 0) {
          openBriefing(
            mode,
            { blockedReason: 'Bayrak diktiğin ülkelerin tamamı zaten senin!' },
            () => {}
          );
          return;
        }

        openTargetBriefing(mode, pickRandom(pool));
        return;
      }

      case 'daily': {
        // Gün numarasına göre sabit hedef: aynı gün herkese aynı şehir düşer.
        const dayIndex = Math.floor(Date.now() / DAY_MS);
        openTargetBriefing(mode, WORLD_CITIES[dayIndex % WORLD_CITIES.length]);
        return;
      }
    }
  }

  /** Modal önce kapanır, eylem sonra çalışır — geçiş üst üste binmesin. */
  function handleConfirm() {
    const action = pending?.confirm;
    setPending(null);
    action?.();
  }

  return (
    <LinearGradient
      colors={skyBackground}
      locations={skyBackgroundLocations}
      style={styles.container}
    >
      {/* Arka plan görseli şimdilik kapalı — uygulamanın gökyüzü zemini kullanılıyor.
          Geri açmak için aşağıdaki bloğu ve backdrop/backdropImage stillerini aç,
          react-native'den Image importunu geri ekle:

      <View style={[StyleSheet.absoluteFill, styles.backdrop]} pointerEvents="none">
        <Image source={require('../images/main/war_main.png')} style={styles.backdropImage} />
      </View> */}

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.musicButton} onPress={music.toggle}>
            <Ionicons
              name={music.isPlaying ? 'volume-high' : 'volume-mute'}
              size={18}
              color={music.isPlaying ? colors.primaryDark : colors.textMuted}
            />
          </Pressable>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.statChip}>
            <MaterialCommunityIcons name="flag-variant" size={13} color={colors.gold} />
            <Text style={styles.statText}>{ownedCount} şehir</Text>
          </View>
          <Pressable
            style={styles.trophyButton}
            onPress={() => navigation.navigate('Leaderboard')}
          >
            <Ionicons name="trophy" size={19} color={colors.gold} />
          </Pressable>
        </View>
      </View>

      {/* Ekranın üst yarısı: ülke kartları ya da küre */}
      <View style={styles.mapArea}>
        {viewMode === 'list' && (
          <CountryCarousel onSelectCountry={handleSelectCountry} />
        )}

        {/* Küre bir kez istendikten sonra ağaçta kalır; kartlara dönünce
            sadece gizlenir, böylece ikinci açılış anında gelir. */}
        {globeRequested && (
          <View
            style={[StyleSheet.absoluteFill, viewMode !== 'map' && styles.hiddenLayer]}
            pointerEvents={viewMode === 'map' ? 'auto' : 'none'}
          >
            <WorldGlobeView
              ownerColors={ownerColors}
              onReady={handleGlobeReady}
              onSelectCountry={handleSelectCountry}
            />
          </View>
        )}

        {viewMode === 'map' && !globeReady && (
          <View style={[StyleSheet.absoluteFill, styles.globeLoading]}>
            <ActivityIndicator size="large" color={colors.textInverse} />
            <Text style={styles.globeLoadingTitle}>Dünya hazırlanıyor…</Text>
            <Text style={styles.globeLoadingHint}>
              Bu yükleme sadece bir kez yapılır.
            </Text>
          </View>
        )}

        {/* Düz dünya haritası (pasif):
        <ZoomableWorldMap
          ownerColors={ownerColors}
          onSelectCountry={(countryCode) => navigation.navigate('CityList', { countryCode })}
        /> */}

        {/* Türkiye kurgusu (pasif):
        {viewMode === 'map' ? (
          <ZoomableTurkeyMap
            onSelectProvince={(provinceName) =>
              navigation.navigate('DistrictList', { provinceName })
            }
          />
        ) : (
          <ProvinceCarousel
            onSelectProvince={(provinceName) =>
              navigation.navigate('DistrictList', { provinceName })
            }
          />
        )} */}

        <View style={styles.viewModeToggle}>
          <Pressable
            onPress={() => {
              setGlobeRequested(true);
              setViewMode('map');
            }}
            style={[styles.viewModeButton, viewMode === 'map' && styles.viewModeButtonActive]}
          >
            <Ionicons
              name="earth"
              size={17}
              color={viewMode === 'map' ? colors.surfaceDark : colors.textInverse}
            />
          </Pressable>
          <Pressable
            onPress={() => setViewMode('list')}
            style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
          >
            <MaterialCommunityIcons
              name="cards"
              size={17}
              color={viewMode === 'list' ? colors.surfaceDark : colors.textInverse}
            />
          </Pressable>
        </View>
      </View>

      {/* Ekranın alt yarısı: 2x2 savaş modu kartları */}
      <View style={styles.cardArea}>
        {[BATTLE_MODES.slice(0, 2), BATTLE_MODES.slice(2)].map((row) => (
          <View key={row[0].key} style={styles.cardRow}>
            {row.map((mode) => (
              <GameModeCard
                key={mode.key}
                title={mode.title}
                subtitle={mode.subtitle}
                tag={mode.tag}
                icon={mode.icon}
                gradient={mode.gradient}
                onPress={() => handleModePress(mode)}
              />
            ))}
          </View>
        ))}
      </View>

      <BattleModal
        briefing={pending?.briefing ?? null}
        onClose={() => setPending(null)}
        onConfirm={handleConfirm}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  musicButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  statText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  trophyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  mapArea: {
    // Harita alanı, alttaki savaş modu kartlarından belirgin biçimde daha yüksek.
    flex: 1.35,
    // Arkadaki gökyüzü katmanı görünsün diye kartın kendi zemini yok.
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginHorizontal: 10,
  },
  hiddenLayer: {
    display: 'none',
  },
  globeLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(43,29,74,0.25)',
  },
  globeLoadingTitle: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  globeLoadingHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  viewModeToggle: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    backgroundColor: 'rgba(43,29,74,0.35)',
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  viewModeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: colors.primary,
  },
  cardArea: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 10,
  },
  cardRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
});
