export type StoreId = 'epic' | 'steam' | 'gog' | 'prime' | 'itch';

export type PlatformId = 'windows' | 'mac' | 'linux' | 'steamdeck' | 'console';

export type GiveawayStatus = 'active' | 'expiring' | 'upcoming';

export type NavigationTab = 'radar' | 'upcoming' | 'claimed' | 'alerts';

export interface SystemRequirements {
  os: string;
  processor: string;
  memory: string;
  graphics: string;
  storage: string;
}

export interface GiveawayGame {
  id: string;
  title: string;
  subtitle: string;
  store: StoreId;
  storeName: string;
  platforms: PlatformId[];
  originalPrice: number;
  status: GiveawayStatus;
  startDate: string;
  endDate: string;
  coverImage: string;
  accentGradient: string;
  genres: string[];
  publisher: string;
  developer: string;
  releaseYear: number;
  /** Metacritic score from the Steam listing. Absent when none exists. */
  ratingScore?: number;
  drmType: string;
  claimUrl: string;
  description: string;
  highlights: string[];
  /** Minimum PC requirements from Steam. Absent when unknown. */
  systemRequirements?: SystemRequirements;
  isHeadliner?: boolean;
}

export interface NotificationPrefs {
  browserPushEnabled: boolean;
  soundChimeEnabled: boolean;
  notifyNewDrops: boolean;
  notifyExpiringSoon: boolean;
  notifyUpcomingUnlocks: boolean;
  monitoredStores: StoreId[];
  monitoredPlatforms: PlatformId[];
}

export interface RadarAlert {
  id: string;
  type: 'new_drop' | 'expiring_soon' | 'upcoming_unlock';
  title: string;
  message: string;
  timestamp: string;
  gameId?: string;
  store?: StoreId;
  read: boolean;
}
