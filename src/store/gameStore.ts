import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { WORLD_CITIES } from '../data/worldCities';
import { Player, PlayerId } from '../types';

export const LOCAL_PLAYER_ID = 'local-player';

// Kırmızı, "fethedilmemiş / rakip" rengi olarak ayrıldığı için oyuncu paletinde yok.
const PLAYER_COLOR_PALETTE = [
  '#2563EB', // mavi
  '#059669', // yeşil
  '#7C3AED', // mor
  '#D97706', // turuncu
  '#0891B2', // camgöbeği
  '#DB2777', // pembe
  '#CA8A04', // altın
  '#4F46E5', // indigo
];

function randomPlayerColor(): string {
  return PLAYER_COLOR_PALETTE[Math.floor(Math.random() * PLAYER_COLOR_PALETTE.length)];
}

// Harita hemen boş görünmesin diye eklenmiş örnek rakipler.
// Backend entegre edilince gerçek oyuncularla değişecek.
export const RIVAL_PLAYERS: Player[] = [
  { id: 'rival-ejder', name: 'Ejder Ordusu', color: '#B91C1C' },
  { id: 'rival-kartal', name: 'Kartal Birliği', color: '#1D4ED8' },
];

// Dünya haritası ilk açılışta boş görünmesin diye rakiplerin elindeki şehirler.
const SEED_CONQUESTS: Record<string, { ownerId: PlayerId; score: number }> = {
  'gb-2643743': { ownerId: 'rival-ejder', score: 14 }, // Londra
  'ru-524901': { ownerId: 'rival-kartal', score: 16 }, // Moskova
  'eg-360630': { ownerId: 'rival-ejder', score: 12 }, // Kahire
  'jp-1850147': { ownerId: 'rival-kartal', score: 15 }, // Tokyo
  'us-5128581': { ownerId: 'rival-ejder', score: 17 }, // New York
};

// Şehir kimliği → ülke kodu. Ülke bazlı sorgular (harita rengi, istatistik)
// her seferinde tüm şehir listesini taramasın diye bir kez kuruluyor.
const COUNTRY_BY_CITY: Record<string, string> = WORLD_CITIES.reduce(
  (acc, city) => {
    acc[city.id] = city.country;
    return acc;
  },
  {} as Record<string, string>
);

interface ConquestEntry {
  ownerId: PlayerId;
  score: number;
}

interface GameState {
  localPlayer: Player;
  conquests: Record<string, ConquestEntry>;
  setLocalPlayerName: (name: string) => void;
  getOwner: (targetId: string) => (Player & { score: number }) | null;
  /** Bir hedef için sınav sonucunu değerlendirir. Skor mevcut sahibi geçerse toprak el değiştirir. */
  submitConquestAttempt: (
    targetId: string,
    score: number
  ) => { success: boolean; previousOwnerId: PlayerId | null; previousScore: number | null };
  getAllPlayers: () => Player[];
  getLeaderboard: () => { player: Player; cityCount: number; totalScore: number }[];
  /**
   * Dünya haritasının boyanması için ülke kodu → sahip rengi.
   * Bir ülkede kullanıcının en az bir şehri varsa ülke kullanıcının rengine boyanır;
   * yoksa en çok şehri olan rakibin rengi kullanılır.
   */
  getCountryColors: () => Record<string, string>;
  getPlayerStats: () => { cityCount: number; countryCount: number; totalScore: number };
}

function findPlayer(id: PlayerId, localPlayer: Player): Player | undefined {
  if (id === localPlayer.id) return localPlayer;
  return RIVAL_PLAYERS.find((p) => p.id === id);
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      localPlayer: { id: LOCAL_PLAYER_ID, name: 'Sen', color: randomPlayerColor() },
      conquests: SEED_CONQUESTS,

      setLocalPlayerName: (name) =>
        set((state) => ({ localPlayer: { ...state.localPlayer, name } })),

      getOwner: (targetId) => {
        const state = get();
        const entry = state.conquests[targetId];
        if (!entry) return null;
        const player = findPlayer(entry.ownerId, state.localPlayer);
        if (!player) return null;
        return { ...player, score: entry.score };
      },

      submitConquestAttempt: (targetId, score) => {
        const state = get();
        const existing = state.conquests[targetId];
        const previousOwnerId = existing?.ownerId ?? null;
        const previousScore = existing?.score ?? null;

        if (existing && score <= existing.score) {
          return { success: false, previousOwnerId, previousScore };
        }

        set((s) => ({
          conquests: {
            ...s.conquests,
            [targetId]: { ownerId: s.localPlayer.id, score },
          },
        }));
        return { success: true, previousOwnerId, previousScore };
      },

      getAllPlayers: () => [get().localPlayer, ...RIVAL_PLAYERS],

      getLeaderboard: () => {
        const state = get();
        const players = [state.localPlayer, ...RIVAL_PLAYERS];
        return players
          .map((player) => {
            const owned = Object.values(state.conquests).filter(
              (c) => c.ownerId === player.id
            );
            return {
              player,
              cityCount: owned.length,
              totalScore: owned.reduce((sum, c) => sum + c.score, 0),
            };
          })
          .sort((a, b) => b.cityCount - a.cityCount || b.totalScore - a.totalScore);
      },

      getCountryColors: () => {
        const state = get();
        // Ülke başına oyuncu → şehir sayısı.
        const byCountry: Record<string, Record<PlayerId, number>> = {};
        for (const [cityId, entry] of Object.entries(state.conquests)) {
          const country = COUNTRY_BY_CITY[cityId];
          if (!country) continue;
          const counts = (byCountry[country] ??= {});
          counts[entry.ownerId] = (counts[entry.ownerId] ?? 0) + 1;
        }

        const result: Record<string, string> = {};
        for (const [country, counts] of Object.entries(byCountry)) {
          // Kullanıcının bir şehri bile varsa ülke onun rengiyle görünür.
          if (counts[state.localPlayer.id]) {
            result[country] = state.localPlayer.color;
            continue;
          }
          const [topOwnerId] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
          const player = findPlayer(topOwnerId, state.localPlayer);
          if (player) result[country] = player.color;
        }
        return result;
      },

      getPlayerStats: () => {
        const state = get();
        const owned = Object.entries(state.conquests).filter(
          ([, c]) => c.ownerId === state.localPlayer.id
        );
        const countries = new Set(
          owned.map(([cityId]) => COUNTRY_BY_CITY[cityId]).filter((c): c is string => !!c)
        );
        return {
          cityCount: owned.length,
          countryCount: countries.size,
          totalScore: owned.reduce((sum, [, c]) => sum + c.score, 0),
        };
      },
    }),
    {
      name: 'fetih-game-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ localPlayer: state.localPlayer, conquests: state.conquests }),
      // v2: hedefler Türkiye ilçelerinden dünya şehirlerine geçti; eski kayıtlardaki
      // ilçe kimliklerinin yeni haritada karşılığı yok, o yüzden sıfırdan başlatılıyor.
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as { localPlayer?: Player; conquests?: Record<string, ConquestEntry> };
        if (version < 2) {
          return { ...state, conquests: SEED_CONQUESTS };
        }
        return state;
      },
    }
  )
);
