import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import Button3D from '../components/Button3D';
import { getTarget } from '../data/targets';
import { colors } from '../theme/colors';
import { raisedCardLight } from '../theme/shadows';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

export default function ResultScreen({ route, navigation }: Props) {
  const { targetId, score, total, success, previousOwnerName, previousScore } = route.params;
  const target = getTarget(targetId);

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{success ? '🏰' : '⚔️'}</Text>
      <Text style={styles.result}>{success ? 'Fetih Başarılı!' : 'Fetih Başarısız'}</Text>
      <Text style={styles.districtName}>
        {target?.name}
        {target?.parentName ? ` · ${target.parentName}` : ''}
      </Text>

      <View style={[styles.scoreCard, raisedCardLight]}>
        <Text style={styles.scoreLabel}>Senin skorun</Text>
        <Text style={styles.scoreValue}>
          {score} / {total}
        </Text>
        {previousOwnerName && previousScore !== null && (
          <Text style={styles.compareText}>
            {previousOwnerName}'in skoru: {previousScore}
          </Text>
        )}
      </View>

      <Text style={styles.message}>
        {success
          ? 'Bu bölge artık senin toprağın. Rakipler daha yüksek skorla saldırırsa savunman gerekecek.'
          : 'Skorun mevcut sahibi geçemedi, toprak el değiştirmedi. Tekrar deneyebilirsin.'}
      </Text>

      <View style={styles.buttons}>
        <Button3D
          color={colors.primary}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })}
        >
          <Text style={styles.primaryButtonText}>Haritaya Dön</Text>
        </Button3D>
        <Button3D
          color={colors.surface}
          onPress={() => navigation.replace('Quiz', { targetId })}
        >
          <Text style={styles.secondaryButtonText}>Tekrar Dene</Text>
        </Button3D>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  result: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  districtName: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 24,
  },
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 4,
  },
  compareText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 8,
  },
  message: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
