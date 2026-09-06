import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MusicProvider from './src/audio/MusicProvider';
import RootNavigator from './src/navigation/RootNavigator';
import { skyBackground } from './src/theme/colors';

export default function App() {
  return (
    // Kök görünümün zemini de uygulamanın gece mavisi: ekranlar kendi
    // zeminlerini boyayana kadar altta beyaz bir kare kalmasın.
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: skyBackground[0] }}>
      <SafeAreaProvider>
        <MusicProvider>
          <RootNavigator />
        </MusicProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
