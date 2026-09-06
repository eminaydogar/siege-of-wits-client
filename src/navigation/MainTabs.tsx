import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnasayfaScreen from '../screens/AnasayfaScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RewardsScreen from '../screens/RewardsScreen';
import ShopScreen from '../screens/ShopScreen';
import { colors, skyBackground } from '../theme/colors';
import { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

const ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Anasayfa: 'map',
  Odüller: 'gift',
  Shop: 'storefront',
  Profil: 'person-circle',
};

export default function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: skyBackground[0] },
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700' as const,
        },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={ICONS[route.name]} size={focused ? size + 2 : size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Anasayfa" component={AnasayfaScreen} />
      <Tab.Screen name="Odüller" component={RewardsScreen} options={{ title: 'Ödüller' }} />
      <Tab.Screen name="Shop" component={ShopScreen} options={{ title: 'Shop' }} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
