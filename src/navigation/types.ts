import { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type TabParamList = {
  Anasayfa: undefined;
  Odüller: undefined;
  Shop: undefined;
  Profil: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<TabParamList>;
  /** Dünya haritasında bir ülkeye dokununca açılan şehir kartları. */
  CityList: { countryCode: string };
  // Türkiye kurgusundan kalan ekranlar: şu an navigator'a kayıtlı değil,
  // haritayı Türkiye'ye geri çevirmek isteyince tekrar açılacak.
  DistrictList: { provinceName: string };
  DistrictDetail: { districtId: string };
  /** targetId = fethedilecek birim (şu an dünya şehri, bkz. data/targets.ts). */
  Quiz: { targetId: string };
  Result: {
    targetId: string;
    score: number;
    total: number;
    success: boolean;
    previousOwnerName: string | null;
    previousScore: number | null;
  };
  Leaderboard: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
