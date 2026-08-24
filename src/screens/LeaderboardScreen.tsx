import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { colors } from '../theme/colors';
import { raisedCardLight } from '../theme/shadows';

export default function LeaderboardScreen() {
  const getLeaderboard = useGameStore((s) => s.getLeaderboard);
  const conquests = useGameStore((s) => s.conquests); // re-render tetikleyici
  const leaderboard = getLeaderboard();

  return (
    <View style={styles.container}>
      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.player.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <View style={[styles.row, raisedCardLight]}>
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={[styles.dot, { backgroundColor: item.player.color }]} />
            <View style={styles.info}>
              <Text style={styles.name}>{item.player.name}</Text>
              <Text style={styles.detail}>
                {item.cityCount} şehir · {item.totalScore} toplam skor
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Henüz fethedilmiş bölge yok.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  listContent: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  rank: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textMuted,
    width: 28,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  detail: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: 40,
  },
});
