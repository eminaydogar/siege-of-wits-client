import { shadeColor } from '../utils/color';

const PRIMARY = '#D999FF';
// Fethedilmemiş bölgeler için açık sarı-pembeye yakın toprak tonu.
const MAP_UNCONQUERED = '#F0C6A0';

export const colors = {
  // Koyu tema (savaş ekranları, modal yüzeyleri) — anasayfanın gece mavisi
  // arka plan görseliyle uyumlu lacivert zemin.
  background: '#16224A',
  surfaceDark: '#1D2A57',
  // Gökyüzü zemini: harita bulutların üstünde uçuyormuş gibi görünsün diye
  // yukarıdan aşağıya açılan mavi tonu (skyTop = tepe, sky = ufuk).
  skyTop: '#9FD9F5',
  sky: '#4FB3E0',
  mapStroke: '#1A1030',
  // Açık tema (diğer tüm ekranlar) — mor markanın soluk tonu.
  backgroundLight: '#F5EBFF',
  surface: '#FFFFFF',
  border: '#E9DFFA',
  text: '#1F2937',
  textInverse: '#F8FAFC',
  textMuted: '#6B7280',
  textMutedInverse: '#A6B3D9',
  primary: PRIMARY,
  primaryDark: shadeColor(PRIMARY, -30),
  // Eylem düğmelerinin lacivert tonu — gökyüzü gradientinin orta durağıyla aynı.
  navy: '#164289',
  gold: '#D4AF37',
  goldDark: '#9A7B1F',
  unconquered: '#D1D5DB',
  success: '#059669',
  danger: '#DC2626',
  // Fetih durumu rengi: haritada "fethedilmemiş/rakip" bölgeler toprak/kum
  // tonuyla gösterilir — beyaz harita zeminiyle uyumlu, marka morundan bağımsız.
  mapUnconquered: MAP_UNCONQUERED,
};

/**
 * Ödüller ve Mağaza zemini: anasayfadaki arka plan görselinin gökyüzü
 * tonlarından örneklendi — tepesi gece mavisi, aşağı indikçe ufka açılıyor.
 *
 * Aşağıdaki duraklar beyaz yazı için fazla açık; bu zemine oturan kartlar
 * kendi koyu perdesini taşımalı (bkz. GameListCard).
 */
export const skyBackground = ['#051F61', '#164289', '#3B7CB8', '#7FA8C2'] as const;
export const skyBackgroundLocations = [0, 0.32, 0.68, 1] as const;
