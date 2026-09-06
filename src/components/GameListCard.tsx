import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { shadeColor } from '../utils/color';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  /** Sağdaki küçük damga — "Yakında" gibi. */
  badge?: string;
  /** İkon rozetinin rengi; kartlar birbirinden bununla ayrılır. */
  accent: string;
}

// Kartın altında görünen "kalınlık".
const DEPTH = 5;
const RADIUS = 18;

/**
 * Ödüller ve Mağaza listelerinin ortak kartı: koyu gradient zemin üstünde
 * duran, altı kalınlaştırılmış oyun kartı. Şimdilik hepsi "yakında" olduğu
 * için basılabilir değil — içerik geldiğinde Pressable'a çevrilecek.
 */
export default function GameListCard({ icon, title, desc, badge, accent }: Props) {
  return (
    <View style={[styles.wrapper, { shadowColor: shadeColor(accent, -50) }]}>
      <View style={styles.face}>
        {/* Üstten cam parlaması — yüzeye kabartma hissi verir. */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0)']}
          style={styles.gloss}
        />

        <LinearGradient
          colors={[shadeColor(accent, 14), shadeColor(accent, -26)]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.iconBadge}
        >
          <Ionicons name={icon} size={21} color="#FFFFFF" />
        </LinearGradient>

        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.desc} numberOfLines={2}>
            {desc}
          </Text>
        </View>

        {badge ? (
          <View style={styles.badge}>
            <Ionicons name="lock-closed" size={9} color={colors.gold} />
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: RADIUS,
    backgroundColor: 'rgba(0,0,0,0.32)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: DEPTH,
    borderRadius: RADIUS,
    // Gökyüzü zemini aşağıya doğru açıldığı için kart saydam beyaz değil koyu
    // perde: gradientin her yerinde yazı okunur kalsın.
    backgroundColor: 'rgba(8,12,32,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  gloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    flexShrink: 0,
  },
  text: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  desc: {
    color: 'rgba(248,250,252,0.66)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(212,175,55,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.38)',
    flexShrink: 0,
  },
  badgeText: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
