import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getCountry } from '../data/worldCountryPaths';
import { colors, skyBackground } from '../theme/colors';
import { RootStackParamList } from './types';
import MainTabs from './MainTabs';
import CityListScreen from '../screens/CityListScreen';
// Türkiye kurgusu şimdilik pasif — geri dönülecek olursa bu iki ekran ve
// aşağıdaki Stack.Screen kayıtları tekrar açılmalı.
// import DistrictListScreen from '../screens/DistrictListScreen';
// import DistrictDetailScreen from '../screens/DistrictDetailScreen';
import QuizScreen from '../screens/QuizScreen';
import ResultScreen from '../screens/ResultScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Ekranların altında kalan zemin.
 *
 * Varsayılan tema burayı rgb(242,242,242) yapıyor; yeni ekran sağdan kayarken
 * kendi zeminini boyayana kadar bir kare boyunca o açık renk görünüyordu —
 * ekranın sağ üst köşesinde beliren beyaz dilim buydu. Uygulamanın gökyüzü
 * zemininin tepe rengine çekilince geçiş dikişsiz oluyor.
 */
const navigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: skyBackground[0] },
};

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          // Geçiş sırasında ekranın arkasında kalan yüzey.
          contentStyle: { backgroundColor: skyBackground[0] },
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="CityList"
          component={CityListScreen}
          // Ekran kendi üst çubuğunu çiziyor (Geri Dön düğmesi orada).
          options={{ headerShown: false }}
        />
        {/* Türkiye kurgusu (pasif):
        <Stack.Screen
          name="DistrictList"
          component={DistrictListScreen}
          options={({ route }) => ({ title: route.params.provinceName })}
        />
        <Stack.Screen
          name="DistrictDetail"
          component={DistrictDetailScreen}
          options={{ title: 'Bölge' }}
        /> */}
        <Stack.Screen
          name="Quiz"
          component={QuizScreen}
          // Sınav ekranı kendi koyu üst çubuğunu çiziyor (Savaştan Ayrıl düğmesi orada).
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="Result"
          component={ResultScreen}
          options={{ title: 'Sonuç', headerBackVisible: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="Leaderboard"
          component={LeaderboardScreen}
          options={{ title: 'Sıralama Tablosu' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
