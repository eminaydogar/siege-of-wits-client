import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button3D from '../components/Button3D';
import { useFocusedStatusBar } from '../hooks/useFocusedStatusBar';
import { useGameStore } from '../store/gameStore';
import { colors, skyBackground, skyBackgroundLocations } from '../theme/colors';

/**
 * Alanlar backend'deki UserDefinition entity'sine göre kuruldu
 * (siege-of-wits · com.tr.easoft.entity.UserDefinition):
 *
 *   NAME    → Ad
 *   SURNAME → Soyad
 *   EMAIL   → E-posta
 *   PASSWORD→ Şifre
 *   IMAGE   → avatara dokununca seçilen görsel
 *
 * Şu an hiçbiri API'ye bağlı değil; ad dışındaki alanlar yerel state'te duruyor.
 * Uçlar hazır olunca form bu state'i doldurup geri gönderecek — düzen aynı kalır.
 */

/**
 * Şifre alanı kayıtlı bir şifre varmış gibi dolu başlar. Gerçek şifre asla
 * sunucudan gelmediği için bu sadece bir yer tutucu: alana dokunulduğu anda
 * temizlenir, kaydederken de değişmediyse gönderilmez.
 */
const PASSWORD_PLACEHOLDER = '••••••••';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  // Zeminin tepesi gece mavisi: sistem ikonları açık olmalı.
  useFocusedStatusBar('light');

  const localPlayer = useGameStore((s) => s.localPlayer);
  const setLocalPlayerName = useGameStore((s) => s.setLocalPlayerName);
  const getPlayerStats = useGameStore((s) => s.getPlayerStats);
  useGameStore((s) => s.conquests); // fetih değişince istatistikler tazelensin
  const stats = getPlayerStats();

  const [name, setName] = useState(localPlayer.name);
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  // UserDefinition.IMAGE karşılığı. Şimdilik cihazdaki dosyanın yerel yolu;
  // yükleme ucu bağlanınca burada sunucudan dönen URL tutulacak.
  const [image, setImage] = useState<string | null>(null);
  const [password, setPassword] = useState(PASSWORD_PLACEHOLDER);
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);

  // Yer tutucu duruyorsa kullanıcı şifreye hiç dokunmamış demektir.
  const passwordChanged = password !== PASSWORD_PLACEHOLDER;

  async function handlePickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'İzin gerekli',
        'Profil fotoğrafı seçebilmek için galeri erişimine izin vermelisin.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) setImage(result.assets[0].uri);
  }

  function handleSave() {
    // Store yalnızca adı tutuyor; kalan alanlar API bağlanınca gönderilecek.
    // Şifre yalnızca passwordChanged true iken isteğe eklenmeli.
    setLocalPlayerName(name.trim() || 'Sen');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleLogout() {
    Alert.alert('Çıkış Yap', 'Oturumunu kapatmak istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        // Oturum yönetimi henüz yok; hesap servisi bağlanınca token temizlenip
        // giriş ekranına dönülecek.
        onPress: () => Alert.alert('Çıkış', 'Oturum servisi bağlanınca aktif olacak.'),
      },
    ]);
  }

  return (
    <LinearGradient
      colors={skyBackground}
      locations={skyBackgroundLocations}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Kimlik başlığı — zeminin koyu bölgesinde durur. */}
          <View style={styles.header}>
            <Pressable onPress={handlePickAvatar} style={styles.avatarPress}>
              <View style={[styles.avatar, { backgroundColor: localPlayer.color }]}>
                {image ? (
                  <Image source={{ uri: image }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={34} color="#FFFFFF" />
                )}
              </View>
              {/* Değiştirme işareti: avatarın dokunulabilir olduğunu belli eder. */}
              <View style={styles.avatarEdit}>
                <Ionicons name="pencil" size={13} color={colors.surfaceDark} />
              </View>
            </Pressable>

            <Text style={styles.headerName} numberOfLines={1}>
              {name.trim() || 'Komutan'}
            </Text>
            <View style={styles.colorRow}>
              <View style={[styles.colorSwatch, { backgroundColor: localPlayer.color }]} />
              <Text style={styles.colorLabel}>Bölge rengin</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatCard label="Şehir" value={stats.cityCount} />
            <StatCard label="Ülke" value={stats.countryCount} />
            <StatCard label="Skor" value={stats.totalScore} />
          </View>

          <Panel title="HESAP BİLGİLERİ" icon="person-outline">
            <Field
              label="Ad"
              icon="person-outline"
              value={name}
              onChangeText={setName}
              placeholder="Adın"
              autoCapitalize="words"
            />
            <Field
              label="Soyad"
              icon="person-outline"
              value={surname}
              onChangeText={setSurname}
              placeholder="Soyadın"
              autoCapitalize="words"
            />
            <Field
              label="E-posta"
              icon="at-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="ornek@eposta.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="Şifre"
              icon="key-outline"
              value={password}
              onChangeText={setPassword}
              // Dokununca yer tutucu temizlenir, kullanıcı boş alana yazar.
              onFocus={() => {
                if (!passwordChanged) setPassword('');
              }}
              placeholder="Yeni şifren"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              accessory={
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={17}
                    color="rgba(248,250,252,0.6)"
                  />
                </Pressable>
              }
            />
          </Panel>

          <Button3D color={colors.success} radius={18} onPress={handleSave}>
            <Ionicons name="save-outline" size={18} color="#FFFFFF" />
            <Text style={styles.saveText}>{saved ? 'Kaydedildi' : 'Değişiklikleri Kaydet'}</Text>
          </Button3D>

          <Button3D color={colors.danger} radius={18} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
            <Text style={styles.logoutText}>Çıkış Yap</Text>
          </Button3D>

          <Text style={styles.note}>
            Ad dışındaki alanlar hesap servisi bağlanınca kaydedilecek.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

/** Koyu perdeli bölüm kutusu: zemin aşağıda açıldığı için yazılar hep bunun üstünde. */
function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Ionicons name={icon} size={14} color={colors.gold} />
        <Text style={styles.panelTitle}>{title}</Text>
      </View>
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Kutunun sağ ucuna oturan düğme (şifre göster/gizle gibi). */
  accessory?: ReactNode;
}

function Field({ label, icon, accessory, onFocus, onBlur, ...inputProps }: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
        <Ionicons
          name={icon}
          size={16}
          color={focused ? colors.gold : 'rgba(248,250,252,0.5)'}
        />
        <TextInput
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={styles.input}
          placeholderTextColor="rgba(248,250,252,0.4)"
        />
        {accessory}
      </View>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Panel ve kartların ortak koyu perdesi: gökyüzü zemininin her yüksekliğinde
// beyaz yazıyı okunur tutar.
const SCRIM = 'rgba(8,12,32,0.5)';
const AVATAR_SIZE = 84;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  avatarPress: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerName: {
    color: colors.textInverse,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  colorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(248,250,252,0.66)',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: SCRIM,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  statValue: {
    fontSize: 21,
    fontWeight: '900',
    color: colors.gold,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(248,250,252,0.66)',
  },
  panel: {
    borderRadius: 18,
    backgroundColor: SCRIM,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  panelTitle: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  panelBody: {
    padding: 14,
    gap: 12,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: 'rgba(248,250,252,0.66)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  inputBoxFocused: {
    borderColor: 'rgba(212,175,55,0.6)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  input: {
    flex: 1,
    paddingVertical: 11,
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  note: {
    textAlign: 'center',
    color: 'rgba(248,250,252,0.55)',
    fontSize: 11,
    fontWeight: '600',
  },
});
