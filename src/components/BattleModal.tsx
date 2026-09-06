import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ComponentProps, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Button3D from './Button3D';
import { colors } from '../theme/colors';
import { shadeColor } from '../utils/color';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface BriefingStat {
  icon: IconName;
  label: string;
  value: string;
}

/**
 * Savaş brifingi: bir savaş moduna dokununca açılan kartın tüm içeriği.
 *
 * Alanların tamamı ileride backend'den gelecek — bu yüzden bileşen hiçbir şeyi
 * kendi içinde üretmiyor, yalnızca verilen brifingi çiziyor. Şu an brifingi
 * AnasayfaScreen içindeki BATTLE_MODES tablosu dolduruyor.
 */
export interface BattleBriefing {
  /** Mod adı — "Hızlı Savaş". */
  mode: string;
  /** Başlıktaki küçük damga — "RASTGELE". */
  tag: string;
  icon: IconName;
  /** [üst açık ton, alt koyu ton] — modu tanıtan renk. */
  gradient: readonly [string, string];
  /** Hedef şehir. Hedefi sonra seçilen modlarda (Hedefli Saldırı) boş kalır. */
  targetName?: string;
  /** Hedefin ülkesi. */
  targetParent?: string;
  description: string;
  stats: readonly BriefingStat[];
  /** Onay düğmesinin yazısı — "Savaşa Katıl", "Haritayı Aç"… */
  actionLabel: string;
  /** Dolu ise savaşa girilemez; sebep uyarı olarak gösterilir, düğme kapanır. */
  blockedReason?: string;
}

interface Props {
  /** null ise modal kapalı. */
  briefing: BattleBriefing | null;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Kart her açılışta yeniden bindiği için (aşağıdaki koşullu render) giriş
 * animasyonu da her seferinde baştan çalışır.
 */
function BriefingCard({ briefing, onClose, onConfirm }: Props & { briefing: BattleBriefing }) {
  const [top, bottom] = briefing.gradient;
  const blocked = Boolean(briefing.blockedReason);

  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withSpring(1, { damping: 14, stiffness: 190, mass: 0.7 });
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.6),
    transform: [{ scale: 0.9 + enter.value * 0.1 }, { translateY: (1 - enter.value) * 26 }],
  }));

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      {/* Modun rengini taşıyan başlık bandı. */}
      <LinearGradient
        colors={[shadeColor(top, 8), top, bottom]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={styles.head}
      >
        {/* Köşeye taşan dev ikon — savaş kartlarındaki dokuyla aynı dil. */}
        <MaterialCommunityIcons
          name={briefing.icon}
          size={124}
          color="rgba(255,255,255,0.13)"
          style={styles.ghostIcon}
        />

        <View style={styles.headBadge}>
          <MaterialCommunityIcons name={briefing.icon} size={26} color="#FFFFFF" />
        </View>

        <View style={styles.headText}>
          <View style={styles.tag}>
            <Text style={styles.tagText} numberOfLines={1}>
              {briefing.tag}
            </Text>
          </View>
          <Text style={styles.mode} numberOfLines={1}>
            {briefing.mode}
          </Text>
        </View>

        <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={19} color="#FFFFFF" />
        </Pressable>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.headline}>
          {briefing.targetName ? `${briefing.targetName} savaşına katıl` : 'Hedefini sen seç'}
        </Text>
        {briefing.targetParent ? (
          <View style={styles.targetRow}>
            <MaterialCommunityIcons
              name="map-marker-radius"
              size={13}
              color={colors.textMutedInverse}
            />
            <Text style={styles.targetText}>{briefing.targetParent}</Text>
          </View>
        ) : null}

        <Text style={styles.description}>{briefing.description}</Text>

        {briefing.blockedReason ? (
          <View style={styles.warning}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.gold} />
            <Text style={styles.warningText}>{briefing.blockedReason}</Text>
          </View>
        ) : (
          <View style={styles.stats}>
            {briefing.stats.map((stat) => (
              <View key={stat.label} style={styles.stat}>
                <MaterialCommunityIcons name={stat.icon} size={17} color={colors.gold} />
                <Text style={styles.statValue} numberOfLines={1}>
                  {stat.value}
                </Text>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Button3D
          color={bottom}
          radius={18}
          disabled={blocked}
          onPress={onConfirm}
          style={styles.action}
        >
          <MaterialCommunityIcons name={briefing.icon} size={18} color="#FFFFFF" />
          <Text style={styles.actionText}>{briefing.actionLabel}</Text>
        </Button3D>

        <Pressable onPress={onClose} style={styles.cancel} hitSlop={6}>
          <Text style={styles.cancelText}>Vazgeç</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function BattleModal({ briefing, onClose, onConfirm }: Props) {
  return (
    <Modal
      transparent
      visible={briefing !== null}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Perdeye dokunmak kapatır; kart bunun üstünde ayrı bir katman. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {briefing ? (
          <BriefingCard briefing={briefing} onClose={onClose} onConfirm={onConfirm} />
        ) : null}
      </View>
    </Modal>
  );
}

const RADIUS = 26;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    backgroundColor: 'rgba(6,8,26,0.74)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: RADIUS,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    overflow: 'hidden',
  },
  ghostIcon: {
    position: 'absolute',
    right: -22,
    bottom: -38,
    transform: [{ rotate: '-12deg' }],
  },
  headBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  headText: {
    flex: 1,
    gap: 4,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  mode: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  body: {
    padding: 18,
    gap: 12,
  },
  headline: {
    color: colors.textInverse,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: -8,
  },
  targetText: {
    color: colors.textMutedInverse,
    fontSize: 12,
    fontWeight: '700',
  },
  description: {
    color: 'rgba(248,250,252,0.78)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
  },
  statValue: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.textMutedInverse,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  warningText: {
    flex: 1,
    color: colors.gold,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  action: {
    marginTop: 2,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  cancel: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cancelText: {
    color: colors.textMutedInverse,
    fontSize: 13,
    fontWeight: '700',
  },
});
