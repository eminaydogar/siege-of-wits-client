import { useCallback } from 'react';
import ZoomableMap, { MapFocus } from './ZoomableMap';
import WorldMap from './WorldMap';
import { WORLD_MAP_VIEWBOX } from '../data/worldCountryPaths';

// Harita Türkiye'nin üstünde, Türkiye haritasındaki kadar yakın açılır:
// Türkiye (~50 birim) ekranın yarısını kaplar, çevresinde Balkanlar, Kafkasya,
// Kıbrıs ve Levant görünür. (viewBox koordinatları — bkz. worldCountryPaths.ts)
const INITIAL_FOCUS: MapFocus = {
  centerX: 592,
  centerY: 124,
  width: 120,
  height: 80,
};

// En uzak zoomda dünyanın en fazla bu kadarı görünür (1000 birimlik haritada).
// Daha da uzaklaşınca ülke adları iç içe giriyor.
const MAX_VISIBLE_WIDTH = 430;

interface Props {
  onSelectCountry: (code: string) => void;
  ownerColors?: Record<string, string>;
}

export default function ZoomableWorldMap({ onSelectCountry, ownerColors }: Props) {
  // Kimliği sabit kalsın: ZoomableMap her zoom/kaydırma sonrası kendi içinde
  // yeniden çizilirken haritayı boşuna baştan kurmasın.
  const renderMap = useCallback(
    (viewBox: string) => (
      <WorldMap
        viewBox={viewBox}
        onSelectCountry={onSelectCountry}
        ownerColors={ownerColors}
      />
    ),
    [onSelectCountry, ownerColors]
  );

  return (
    <ZoomableMap
      viewBox={WORLD_MAP_VIEWBOX}
      initialFocus={INITIAL_FOCUS}
      maxVisibleWidth={MAX_VISIBLE_WIDTH}
    >
      {renderMap}
    </ZoomableMap>
  );
}
