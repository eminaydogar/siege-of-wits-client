import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button3D from '../components/Button3D';
import { TabScreenProps } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { colors } from '../theme/colors';
import { raisedCardLight } from '../theme/shadows';

export default function ProfileScreen({ navigation }: TabScreenProps<'Profil'>) {
  const insets = useSafeAreaInsets();
  const localPlayer = useGameStore((s) => s.localPlayer);
  const setLocalPlayerName = useGameStore((s) => s.setLocalPlayerName);
  const getPlayerStats = useGameStore((s) => s.getPlayerStats);
  const conquests = useGameStore((s) => s.conquests); // re-render tetikleyici
  const stats = getPlayerStats();

  const [name, setName] = useState(localPlayer.name);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <View style={[styles.avatar, raisedCardLight, { backgroundColor: localPlayer.color }]}>
          <Ionicons name="person" size={32} color="#fff" />
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          onEndEditing={() => setLocalPlayerName(name.trim() || 'Sen')}
          style={styles.nameInput}
          placeholder="Adını gir"
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.colorRow}>
          <View style={[styles.colorSwatch, { backgroundColor: localPlayer.color }]} />
          <Text style={styles.colorLabel}>Senin bölge renginin</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Şehir" value={stats.cityCount} />
        <StatCard label="Ülke" value={stats.countryCount} />
        <StatCard label="Skor" value={stats.totalScore} />
      </View>

      <Button3D color={colors.primary} onPress={() => navigation.navigate('Leaderboard')}>
        <Ionicons name="trophy" size={18} color={colors.text} />
        <Text style={styles.leaderboardButtonText}>Sıralama Tablosu</Text>
      </Button3D>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={[styles.statCard, raisedCardLight]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    minWidth: 160,
    paddingVertical: 4,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  colorSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  colorLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  leaderboardButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
