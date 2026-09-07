export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
  color: string;
  /**
   * Profil fotoğrafı. Şimdilik cihazdan seçilen dosyanın yerel yolu; yükleme
   * ucu bağlanınca UserDefinition.IMAGE alanından dönen URL burada tutulacak.
   */
  avatar?: string | null;
  /** Hesabın açıldığı an (ISO). Backend bağlanınca sunucudan gelecek. */
  joinedAt?: string;
}

export interface District {
  id: string;
  name: string;
  city: string;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
}

export interface Conquest {
  districtId: string;
  ownerId: PlayerId;
  score: number;
}

export interface QuizResult {
  districtId: string;
  score: number;
  total: number;
}
