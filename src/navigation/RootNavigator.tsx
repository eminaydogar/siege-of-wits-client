import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getCountry } from '../data/worldCountryPaths';
import { colors } from '../theme/colors';
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

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
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
          options={({ route }) => ({
            title: getCountry(route.params.countryCode)?.name ?? 'Ülke',
          })}
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
          options={{ title: 'Fetih Sınavı', headerBackVisible: false, gestureEnabled: false }}
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
