import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMusic } from '../audio/MusicProvider';
import CountryCarousel from '../components/CountryCarousel';
import GameModeCard from '../components/GameModeCard';
import SkyBackdrop from '../components/SkyBackdrop';
import WorldGlobeView from '../components/WorldGlobeView';
// Pasif kalan harita sürümleri — geri dönmek için ilgili import ve aşağıdaki
// harita bloğunu tekrar açmak yeterli:
// import WorldGlobe from '../components/WorldGlobe';           // SVG küre (yavaştı)
// import ZoomableWorldMap from '../components/ZoomableWorldMap'; // düz dünya haritası
// import ProvinceCarousel from '../components/ProvinceCarousel'; // Türkiye kurgusu
// import ZoomableTurkeyMap from '../components/ZoomableTurkeyMap'; // Türkiye kurgusu
import { WORLD_CITIES, WorldCity } from '../data/worldCities';
import { getCountry } from '../data/worldCountryPaths';
import { TabScreenProps } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { colors } from '../theme/colors';

type ViewMode = 'map' | 'list';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function AnasayfaScreen({ navigation }: TabScreenProps<'Anasayfa'>) {
  const insets = useSafeAreaInsets();
  const music = useMusic();
  // Açılış ülke kartlarıyla: harita ağır bir bileşen, ancak istenince kurulur.
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  // Küre bir kez kurulduktan sonra ekranda kalır (gizlenir), tekrar yüklenmez.
  const [globeRequested, setGlobeRequested] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const localPlayer = useGameStore((s) => s.localPlayer);
  const conquests = useGameStore((s) => s.conquests); // re-render tetikleyici

  const ownedCount = useMemo(
    () => Object.values(conquests).filter((c) => c.ownerId === localPlayer.id).length,
    [conquests, localPlayer.id]
  );

  // Ülkeler, içlerinde şehri olan oyuncunun rengiyle boyanır.
  const getCountryColors = useGameStore((s) => s.getCountryColors);
  const ownerColors = useMemo(() => getCountryColors(), [conquests, localPlayer.color]);

  function confirmAttack(target: WorldCity, message: string) {
    const countryName = getCountry(target.country)?.name ?? '';
    Alert.alert(message, `${target.name} (${countryName}) şehrine saldır?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Saldır',
        style: 'destructive',
        onPress: () => navigation.navigate('Quiz', { targetId: target.id }),
      },
    ]);
  }

  function pickRandom(pool: WorldCity[]) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function handleQuickBattle() {
    const state = useGameStore.getState();
    const attackable = WORLD_CITIES.filter(
      (city) => state.conquests[city.id]?.ownerId !== state.localPlayer.id
    );
    const pool = attackable.length > 0 ? attackable : WORLD_CITIES;
    confirmAttack(pickRandom(pool), 'Hızlı Savaş');
  }

  function handleTargetedAttack() {
    Alert.alert(
      'Hedefli Saldırı',
      'Yukarıdaki dünya haritasından bir ülkeye dokun, açılan şehir kartlarından hedefini seç.'
    );
  }

  // Komşu Fetih: şimdilik "komşuluk" = bayrak diktiğin ülkedeki diğer şehirler.
  // Gerçek sınır komşuluğu (ülkeler arası) backend'den gelince burası değişecek.
  function handleNeighborConquest() {
    const state = useGameStore.getState();
    const ownedCountries = new Set(
      WORLD_CITIES.filter(
        (city) => state.conquests[city.id]?.ownerId === state.localPlayer.id
      ).map((city) => city.country)
    );

    if (ownedCountries.size === 0) {
      Alert.alert('Komşu Fetih', 'Önce Hızlı Savaş ile ilk şehrini fethetmelisin.');
      return;
    }

    const pool = WORLD_CITIES.filter(
      (city) =>
        ownedCountries.has(city.country) &&
        state.conquests[city.id]?.ownerId !== state.localPlayer.id
    );

    if (pool.length === 0) {
      Alert.alert('Komşu Fetih', 'Bayrak diktiğin ülkelerin tamamı zaten senin!');
      return;
    }

    confirmAttack(pickRandom(pool), 'Komşu Fetih');
  }

  function handleDailySiege() {
    // Gün numarasına göre sabit hedef: aynı gün içinde herkese aynı şehir düşer.
    const dayIndex = Math.floor(Date.now() / DAY_MS);
    confirmAttack(WORLD_CITIES[dayIndex % WORLD_CITIES.length], 'Günlük Kuşatma');
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Tüm ekranın arkasındaki gökyüzü — harita kartı da saydam olduğu için üstünde uçar. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <SkyBackdrop />
      </View>

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
          <CountryCarousel
            onSelectCountry={(countryCode) =>
              navigation.navigate('CityList', { countryCode })
            }
          />
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
              onReady={() => setGlobeReady(true)}
              onSelectCountry={(countryCode) =>
                navigation.navigate('CityList', { countryCode })
              }
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
        <View style={styles.cardRow}>
          <GameModeCard
            title="Hızlı Savaş"
            subtitle="Sistem dünyadan rastgele bir şehir seçer. Hemen fethet."
            tag="RASTGELE"
            icon="sword-cross"
            gradient={['#FF7E6B', '#E11D48']}
            onPress={handleQuickBattle}
          />
          <GameModeCard
            title="Hedefli Saldırı"
            subtitle="Haritadan ülkeyi aç, istediğin şehre doğrudan saldır."
            tag="SEÇİMLİ"
            icon="target"
            gradient={['#5CC6FF', '#2563EB']}
            onPress={handleTargetedAttack}
          />
        </View>

        <View style={styles.cardRow}>
          <GameModeCard
            title="Komşu Fetih"
            subtitle="Bayrak diktiğin ülkelerin diğer şehirlerine saldır."
            tag="STRATEJİ"
            icon="fire"
            gradient={['#5FE0B0', '#0D9488']}
            onPress={handleNeighborConquest}
          />
          <GameModeCard
            title="Günlük Kuşatma"
            subtitle="Her gün özel bir şehir. Fethedene ekstra altın."
            tag="ÖDÜLLÜ"
            icon="trophy-variant"
            gradient={['#FFD35C', '#E08A00']}
            onPress={handleDailySiege}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.sky,
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
