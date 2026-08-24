import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getRandomQuestions } from '../data/questions';
import { getTarget } from '../data/targets';
import { useGameStore } from '../store/gameStore';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';

const QUESTION_COUNT = 20;

type Props = NativeStackScreenProps<RootStackParamList, 'Quiz'>;

export default function QuizScreen({ route, navigation }: Props) {
  const { targetId } = route.params;
  const target = getTarget(targetId);
  const questions = useMemo(() => getRandomQuestions(QUESTION_COUNT), []);
  const submitConquestAttempt = useGameStore((s) => s.submitConquestAttempt);
  const getAllPlayers = useGameStore((s) => s.getAllPlayers);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const current = questions[index];
  const isLast = index === questions.length - 1;

  function handleSelect(optionIndex: number) {
    if (selected !== null) return;
    setSelected(optionIndex);
    const correct = optionIndex === current.correctIndex;
    const nextScore = correct ? score + 1 : score;
    if (correct) setScore(nextScore);

    setTimeout(() => {
      if (isLast) {
        const result = submitConquestAttempt(targetId, nextScore);
        const previousOwner = result.previousOwnerId
          ? getAllPlayers().find((p) => p.id === result.previousOwnerId) ?? null
          : null;
        navigation.replace('Result', {
          targetId,
          score: nextScore,
          total: questions.length,
          success: result.success,
          previousOwnerName: previousOwner?.name ?? null,
          previousScore: result.previousScore,
        });
      } else {
        setIndex(index + 1);
        setSelected(null);
      }
    }, 400);
  }

  if (!current || !target) return null;

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {target.name} · Soru {index + 1}/{questions.length}
        </Text>
        <Text style={styles.scoreText}>Skor: {score}</Text>
      </View>
      <View style={styles.progressBarTrack}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${((index + 1) / questions.length) * 100}%` },
          ]}
        />
      </View>

      <Text style={styles.question}>{current.text}</Text>

      <View style={styles.options}>
        {current.options.map((option, i) => {
          const isSelected = selected === i;
          const isCorrect = i === current.correctIndex;
          const showResult = selected !== null;
          return (
            <Pressable
              key={i}
              style={[
                styles.option,
                showResult && isCorrect && styles.optionCorrect,
                showResult && isSelected && !isCorrect && styles.optionWrong,
              ]}
              onPress={() => handleSelect(i)}
              disabled={selected !== null}
            >
              <Text style={styles.optionText}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    padding: 24,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  scoreText: {
    fontSize: 13,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginTop: 8,
    marginBottom: 32,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  question: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 32,
  },
  options: {
    gap: 12,
  },
  option: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  optionCorrect: {
    borderColor: colors.success,
    backgroundColor: '#ECFDF5',
  },
  optionWrong: {
    borderColor: colors.danger,
    backgroundColor: '#FEF2F2',
  },
  optionText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
});
