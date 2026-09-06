import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getRandomQuestions } from '../data/questions';
import { getTarget } from '../data/targets';
import { useGameStore } from '../store/gameStore';
import { colors } from '../theme/colors';
import { mixColor, shadeColor } from '../utils/color';
import { RootStackParamList } from '../navigation/types';

const QUESTION_COUNT = 20;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Seçeneğin basılınca ineceği "kalınlık".
const DEPTH = 5;

// Doğru/yanlış renkleri her iki temada da aynı: anlamları sabit kalsın.
const CORRECT_FACE = '#15A06F';
const CORRECT_BASE = '#0A6647';
const WRONG_FACE = '#D0364B';
const WRONG_BASE = '#89202F';

/** Sınav ekranının tüm renkleri; girişin nereden yapıldığına göre üretilir. */
interface QuizTheme {
  /** Üç duraklı zemin: tepede derin, aşağıda kartın kendi rengine açılan. */
  bg: readonly [string, string, string];
  bgLocations: readonly [number, number, number];
  /** İlerleme çubuğu ve rozetlerin vurgu rengi. */
  accent: string;
  text: string;
  textMuted: string;
  cardBg: string;
  cardBorder: string;
  glossTint: string;
  optionFace: string;
  optionBase: string;
  optionBorder: string;
  letterBg: string;
  letterBorder: string;
  letterText: string;
  chipBg: string;
  chipBorder: string;
  statusBar: 'light' | 'dark';
}

// Kartın rengi bununla derinleştiriliyor; tonu bozmadan koyulaştırır.
const DEEP = '#0D1734';

/**
 * Anasayfadaki savaş kartından girildi: ekran o kartın rengini taşır.
 *
 * Tepesi kartın koyu tonunun derinleşmiş hâli, ortası neredeyse kartın kendi
 * rengi, altı ise açılıp aydınlanıyor. Aşağısı beyaz yazı için fazla açık
 * kaldığından soru levhası ve şıklar kendi koyu yüzeylerini taşıyor.
 */
function buildBattleTheme([top, bottom]: readonly [string, string]): QuizTheme {
  const face = mixColor(bottom, DEEP, 0.5);

  return {
    bg: [
      mixColor(bottom, DEEP, 0.58),
      mixColor(bottom, DEEP, 0.15),
      mixColor(top, '#FFFFFF', 0.18),
    ],
    bgLocations: [0, 0.55, 1],
    accent: top,
    text: colors.textInverse,
    textMuted: 'rgba(248,250,252,0.72)',
    cardBg: 'rgba(8,12,32,0.42)',
    cardBorder: 'rgba(255,255,255,0.2)',
    glossTint: 'rgba(255,255,255,0.1)',
    optionFace: face,
    optionBase: shadeColor(face, -16),
    optionBorder: 'rgba(255,255,255,0.2)',
    letterBg: 'rgba(255,255,255,0.16)',
    letterBorder: 'rgba(255,255,255,0.28)',
    letterText: '#FFFFFF',
    chipBg: 'rgba(255,255,255,0.1)',
    chipBorder: 'rgba(255,255,255,0.2)',
    statusBar: 'light',
  };
}

/** Şehir listesi gibi başka bir yerden girildi: sade beyaz zemin. */
const PLAIN_THEME: QuizTheme = {
  bg: ['#FFFFFF', '#FFFFFF', '#FFFFFF'],
  bgLocations: [0, 0.55, 1],
  accent: colors.primary,
  text: colors.text,
  textMuted: colors.textMuted,
  cardBg: '#FFFFFF',
  cardBorder: colors.border,
  glossTint: 'rgba(0,0,0,0.02)',
  optionFace: '#FFFFFF',
  optionBase: '#DCD2EE',
  optionBorder: colors.border,
  letterBg: '#F5EBFF',
  letterBorder: colors.border,
  letterText: colors.primaryDark,
  chipBg: '#F5EBFF',
  chipBorder: colors.border,
  statusBar: 'dark',
};

type OptionState = 'idle' | 'correct' | 'wrong' | 'dimmed';

interface OptionProps {
  text: string;
  letter: string;
  state: OptionState;
  disabled: boolean;
  theme: QuizTheme;
  onPress: () => void;
}

/** Harf rozetli, basınca aşağı inen 3B şık. */
function Option({ text, letter, state, disabled, theme, onPress }: OptionProps) {
  const [pressed, setPressed] = useState(false);
  const revealed = state === 'correct' || state === 'wrong';

  // Cevap açıldığında doğru/yanlış renkleri temanın üstüne biner.
  const face =
    state === 'correct' ? CORRECT_FACE : state === 'wrong' ? WRONG_FACE : theme.optionFace;
  const base =
    state === 'correct' ? CORRECT_BASE : state === 'wrong' ? WRONG_BASE : theme.optionBase;
  const border = revealed ? 'rgba(255,255,255,0.4)' : theme.optionBorder;

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[
        styles.optionWrapper,
        { backgroundColor: base, opacity: state === 'dimmed' ? 0.45 : 1 },
      ]}
    >
      <View
        style={[
          styles.optionFace,
          {
            backgroundColor: face,
            borderColor: border,
            marginBottom: pressed ? 0 : DEPTH,
            transform: [{ translateY: pressed ? DEPTH : 0 }],
          },
        ]}
      >
        <View
          style={[
            styles.letterBadge,
            {
              backgroundColor: revealed ? 'rgba(255,255,255,0.2)' : theme.letterBg,
              borderColor: revealed ? 'rgba(255,255,255,0.36)' : theme.letterBorder,
            },
          ]}
        >
          {revealed ? (
            <Ionicons
              name={state === 'correct' ? 'checkmark-sharp' : 'close-sharp'}
              size={17}
              color="#FFFFFF"
            />
          ) : (
            <Text style={[styles.letterText, { color: theme.letterText }]}>{letter}</Text>
          )}
        </View>
        <Text style={[styles.optionText, { color: revealed ? '#FFFFFF' : theme.text }]}>
          {text}
        </Text>
      </View>
    </Pressable>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, 'Quiz'>;

export default function QuizScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { targetId, battleColors } = route.params;
  const target = getTarget(targetId);
  const questions = useMemo(() => getRandomQuestions(QUESTION_COUNT), []);
  const submitConquestAttempt = useGameStore((s) => s.submitConquestAttempt);
  const getAllPlayers = useGameStore((s) => s.getAllPlayers);

  // Savaş modu kartından gelindiyse kartın rengi, değilse beyaz tema.
  const theme = useMemo(
    () => (battleColors ? buildBattleTheme(battleColors) : PLAIN_THEME),
    [battleColors]
  );

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

  const progress = ((index + 1) / questions.length) * 100;

  return (
    <LinearGradient colors={theme.bg} locations={theme.bgLocations} style={styles.container}>
      <StatusBar style={theme.statusBar} />

      {/* Üst çubuk: soldan savaştan çıkış, sağda anlık skor. */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.leaveButton} hitSlop={8}>
          <Ionicons name="exit-outline" size={16} color="#FFFFFF" />
          <Text style={styles.leaveText}>Savaştan Ayrıl</Text>
        </Pressable>

        <View
          style={[
            styles.scoreChip,
            { backgroundColor: theme.chipBg, borderColor: theme.chipBorder },
          ]}
        >
          <MaterialCommunityIcons name="flag-variant" size={14} color={theme.accent} />
          <Text style={[styles.scoreText, { color: theme.text }]}>{score}</Text>
        </View>
      </View>

      {/* Hedef ve ilerleme */}
      <View style={styles.progressBlock}>
        <View style={styles.targetRow}>
          <MaterialCommunityIcons name="castle" size={15} color={theme.accent} />
          <Text style={[styles.targetText, { color: theme.textMuted }]} numberOfLines={1}>
            {target.name}
            {target.parentName ? ` · ${target.parentName}` : ''}
          </Text>
          <Text style={[styles.counterText, { color: theme.textMuted }]}>
            {index + 1}/{questions.length}
          </Text>
        </View>

        <View
          style={[
            styles.progressTrack,
            { backgroundColor: theme.chipBg, borderColor: theme.chipBorder },
          ]}
        >
          <LinearGradient
            colors={[theme.accent, shadeColor(theme.accent, 16)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${progress}%` }]}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Soru levhası */}
        <View
          style={[
            styles.questionCard,
            { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
          ]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={[theme.glossTint, 'rgba(255,255,255,0)']}
            style={styles.questionGloss}
          />
          <View
            style={[
              styles.questionBadge,
              { backgroundColor: theme.chipBg, borderColor: theme.chipBorder },
            ]}
          >
            <MaterialCommunityIcons name="sword-cross" size={14} color={theme.accent} />
            <Text style={[styles.questionBadgeText, { color: theme.accent }]}>
              SORU {index + 1}
            </Text>
          </View>
          <Text style={[styles.questionText, { color: theme.text }]}>{current.text}</Text>
        </View>

        <View style={styles.options}>
          {current.options.map((option, i) => {
            const showResult = selected !== null;
            let state: OptionState = 'idle';
            if (showResult) {
              if (i === current.correctIndex) state = 'correct';
              else if (i === selected) state = 'wrong';
              else state = 'dimmed';
            }

            return (
              <Option
                key={i}
                text={option}
                letter={LETTERS[i] ?? String(i + 1)}
                state={state}
                disabled={showResult}
                theme={theme}
                onPress={() => handleSelect(i)}
              />
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    // Çıkış her temada kırmızı: tehlikeli eylem olduğu ilk bakışta anlaşılsın.
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: shadeColor(colors.danger, -22),
  },
  leaveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '900',
  },
  progressBlock: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    gap: 8,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  targetText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  counterText: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 18,
  },
  questionCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    gap: 12,
  },
  questionGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  questionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  questionBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  questionText: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
  },
  options: {
    gap: 12,
  },
  optionWrapper: {
    borderRadius: 16,
  },
  optionFace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  letterBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  letterText: {
    fontSize: 13,
    fontWeight: '900',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
});
