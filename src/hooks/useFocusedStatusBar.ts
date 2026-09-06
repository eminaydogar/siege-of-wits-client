import { useFocusEffect } from '@react-navigation/native';
import { setStatusBarStyle, StatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

/**
 * Sekme ekranlarında durum çubuğu stilini odaklanınca uygular.
 *
 * Neden bileşen değil de hook: bottom-tabs bir sekmeyi ilk açılışta bağlıyor ve
 * sonra bağlı tutuyor. Her ekrana <StatusBar> koyulduğunda en son bağlanan
 * ekranın stili yığının tepesinde kalıyor ve sekme değiştirince düzelmiyor —
 * koyu zeminli anasayfa, açık zeminli Ödüller'e uğradıktan sonra koyu ikonlarla
 * kalıyordu. Stili odakta elle uygulamak bu durumu ortadan kaldırıyor.
 *
 * Yığına itilip çıkan ekranlarda (sınav, sonuç) <StatusBar> bileşeni yeterli:
 * ekran kapanınca girdisi de düşüyor ve sekme yeniden odaklandığında bu hook
 * kendi stilini geri yazıyor.
 */
export function useFocusedStatusBar(style: StatusBarStyle) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style);
    }, [style])
  );
}
