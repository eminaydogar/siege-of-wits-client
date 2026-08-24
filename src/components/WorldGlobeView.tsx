import { useEffect, useRef, useState } from 'react';
import { InteractionManager, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { buildGlobeHtml } from './globeHtml';
import { colors } from '../theme/colors';

interface Props {
  onSelectCountry: (code: string) => void;
  /** Ülke kodu → o ülkede en az bir şehri olan oyuncunun rengi. */
  ownerColors?: Record<string, string>;
  /** Küre ilk kez çizildiğinde bir kez çağrılır. */
  onReady?: () => void;
}

/**
 * Dünya küresi. Çizim ve döndürme WebView içindeki bir canvas'ta yapılıyor —
 * gerekçesi globeHtml.ts başındaki notta. React Native tarafı sadece iki şey
 * yapar: sayfayı kurar ve gelen "ülke seçildi" mesajını yönlendirir.
 */
export default function WorldGlobeView({ onSelectCountry, ownerColors, onReady }: Props) {
  const webViewRef = useRef<WebView>(null);
  const isReady = useRef(false);

  // Veri sayfaya gömülü olduğu için bu dize bir kez üretilir (ilk açılıştaki
  // "dünya hazırlanıyor" adımı burası). Üretimi ilk çizimden sonraya bırakıyoruz
  // ki yükleniyor göstergesi anında görünsün.
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setHtml(buildGlobeHtml()));
    return () => task.cancel();
  }, []);

  // Fetihler değiştikçe sahiplik renklerini sayfaya gönder.
  useEffect(() => {
    if (!isReady.current) return;
    webViewRef.current?.injectJavaScript(
      `window.__setOwners(${JSON.stringify(ownerColors ?? {})}); true;`
    );
  }, [ownerColors]);

  function handleMessage(event: WebViewMessageEvent) {
    let message: { type?: string; code?: string };
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    if (message.type === 'ready') {
      isReady.current = true;
      // Sayfa hazır olmadan gönderilen renkler kaybolur; ilk gönderim burada.
      webViewRef.current?.injectJavaScript(
        `window.__setOwners(${JSON.stringify(ownerColors ?? {})}); true;`
      );
      onReady?.();
      return;
    }

    if (message.type === 'select' && message.code) {
      onSelectCountry(message.code);
    }
  }

  if (!html) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        originWhitelist={['*']}
        onMessage={handleMessage}
        style={styles.webView}
        containerStyle={styles.webView}
        // Küre kendi içinde kaydırma/yakınlaştırma yönetiyor.
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        // Donanım katmanı: canvas'ın GPU'da çizilmesini sağlar.
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
        // Sayfa tamamen yerel; dış ağa çıkışa gerek yok.
        javaScriptEnabled
        domStorageEnabled={false}
        cacheEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.sky,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.sky,
  },
});
