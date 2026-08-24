import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import Button3D from '../components/Button3D';
import { getDistrictById } from '../data/districts';
import { useGameStore } from '../store/gameStore';
import { colors } from '../theme/colors';
import { raisedCardLight } from '../theme/shadows';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DistrictDetail'>;

export default function DistrictDetailScreen({ route, navigation }: Props) {
  const { districtId } = route.params;
  const district = getDistrictById(districtId);
  const getOwner = useGameStore((s) => s.getOwner);
  const owner = getOwner(districtId);

  if (!district) return null;

  const isLocalOwner = owner?.id === 'local-player';
  const isUnconquered = !owner;

  return (
    <View style={styles.container}>
      <Text style={styles.city}>{district.city}</Text>
      <Text style={styles.title}>{district.name}</Text>

      <View style={[styles.statusCard, raisedCardLight]}>
        {isUnconquered ? (
          <Text style={styles.statusText}>Bu bölge henüz fethedilmemiş.</Text>
        ) : (
          <>
            <View style={styles.ownerRow}>
              <View style={[styles.ownerDot, { backgroundColor: owner.color }]} />
              <Text style={styles.statusText}>
                {isLocalOwner ? 'Bu toprak sana ait' : `Sahibi: ${owner.name}`}
              </Text>
            </View>
            <Text style={styles.scoreText}>Mevcut skor: {owner.score} / 20</Text>
          </>
        )}
      </View>

      {isLocalOwner ? (
        <Text style={styles.hint}>
          Bu bölge zaten senin. Rakipler daha yüksek skor yaparsa savunman gerekecek.
        </Text>
      ) : (
        <Button3D
          color={colors.primary}
          onPress={() => navigation.navigate('Quiz', { targetId: districtId })}
        >
          <Text style={styles.actionButtonText}>
            {isUnconquered ? 'Fethet' : `Saldır (Geçilecek skor: ${owner.score})`}
          </Text>
        </Button3D>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    padding: 24,
  },
  city: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 24,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ownerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  scoreText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 8,
  },
  actionButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
