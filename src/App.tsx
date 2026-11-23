import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  Check,
  Clock,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  X,
  SlidersHorizontal,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  GiveawayGame,
  NavigationTab,
  NotificationPrefs,
  PlatformId,
  RadarAlert,
  StoreId,
} from './types';
import {
  INITIAL_GIVEAWAYS,
  PLATFORM_META,
  STORE_META,
} from './data/giveaways';
import {
  dispatchNativeNotification,
  formatCountdown,
  getBrowserNotificationPermission,
  playAlertChime,
  requestBrowserNotificationPermission,
} from './utils/notifications';
import { GameCoverArt } from './components/GameCoverArt';
import { GameDetailModal } from './components/GameDetailModal';
import { AlertsCenterView } from './components/AlertsCenterView';
import { ClaimedLibraryView } from './components/ClaimedLibraryView';
import {
  PlatformIcon,
  PlatformIconList,
  StoreIcon,
} from './components/PlatformIcons';
import { MobileAppDownloadModal } from './components/MobileAppDownloadModal';
import { AuthModal } from './components/AuthModal';
import {
  auth,
  db,
  User,
  CloudClaimRecord,
  OperationType,
  collection,
  doc,
  query,
  where,
  onAuthStateChanged,
  onSnapshot,
  ensureUserProfileAndSyncGuestClaims,
  saveClaimToCloud,
  removeClaimFromCloud,
  updateAlertPrefsInCloud,
  handleFirestoreError,
  sanitizeDocId,
} from './firebase';
import { fetchClientSideLiveGiveaways } from './utils/liveFeedClient';
import { isEligibleGiveawayGame, withCurrentStatus } from './utils/gameEligibility';

const FEED_POLL_INTERVAL_MS = 15 * 60 * 1000;
const FEED_RESUME_MIN_AGE_MS = 5 * 60 * 1000;

const STORAGE_KEYS = {
  CLAIMED: 'lootradar_claimed_ids_v4',
  PREFS: 'lootradar_notification_prefs_v4',
  ALERTS: 'lootradar_alerts_log_v4',
};

const DEFAULT_PREFS: NotificationPrefs = {
  browserPushEnabled: true,
  soundChimeEnabled: true,
  notifyNewDrops: true,
  notifyExpiringSoon: true,
  notifyUpcomingUnlocks: true,
  monitoredStores: ['epic', 'steam', 'gog', 'prime', 'itch'],
  monitoredPlatforms: ['windows', 'mac', 'linux', 'steamdeck', 'console'],
};

const INITIAL_ALERTS: RadarAlert[] = [
  {
    id: 'alert-init-1',
    type: 'new_drop',
    title: 'New Epic Games Store Freebie Live: Sker Ritual ($24.99 Value)',
    message:
      'Sker Ritual is now 100% FREE to claim and keep forever on the Epic Games Store until October 29 at 15:00 UTC.',
    timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    gameId: 'epic-live-sker-ritual-aac702',
    store: 'epic',
    read: false,
  },
  {
    id: 'alert-init-2',
    type: 'expiring_soon',
    title: 'Ending Soon: Terraspace ($7.99 Value — Epic Games Store)',
    message:
      'Urgent countdown warning: 100% off full-game giveaway for Terraspace ($7.99 retail) on Epic Games Store expires October 27.',
    timestamp: new Date(Date.now() - 47 * 60 * 1000).toISOString(),
    gameId: 'gp-3822',
    store: 'epic',
    read: false,
  },
  {
    id: 'alert-init-3',
    type: 'new_drop',
    title: 'New Epic Freebie Live: Home - A Unique Horror Adventure',
    message:
      'Home - A Unique Horror Adventure is now 100% free on Epic Games Store until October 29.',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    gameId: 'epic-live-home-19212a',
    store: 'epic',
    read: true,
  },
];

const ALL_STORES: StoreId[] = ['epic', 'steam', 'gog', 'prime', 'itch'];
const ALL_PLATFORMS: PlatformId[] = ['windows', 'mac', 'linux', 'steamdeck', 'console'];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('radar');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [feedGiveaways, setGiveaways] = useState<GiveawayGame[]>(INITIAL_GIVEAWAYS);
  // Re-evaluated each minute so games unlock and expire without a refetch.
  const nowMinute = Math.floor(nowMs / 60000);
  const giveaways = useMemo(
    () => withCurrentStatus(feedGiveaways, nowMinute * 60000),
    [feedGiveaways, nowMinute]
  );
  const giveawaysRef = useRef(giveaways);
  giveawaysRef.current = giveaways;
  const lastFeedAttemptRef = useRef(0);
  const [isSyncingFeed, setIsSyncingFeed] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() =>
    new Date().toISOString()
  );

  // Persistent Claimed IDs
  const [claimedIds, setClaimedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CLAIMED);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persistent Notification Prefs
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PREFS);
      return saved ? { ...DEFAULT_PREFS, ...JSON.parse(saved) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });

  // Persistent Alerts Log
  const [alerts, setAlerts] = useState<RadarAlert[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ALERTS);
      return saved ? JSON.parse(saved) : INITIAL_ALERTS;
    } catch {
      return INITIAL_ALERTS;
    }
  });

  const [permissionStatus, setPermissionStatus] = useState<
    NotificationPermission | 'unsupported'
  >(() => getBrowserNotificationPermission());

  // Active Toast Banner for Real-Time Push Feedback
  const [liveToast, setLiveToast] = useState<RadarAlert | null>(null);

  // Selected Game for Modal Inspection
  const [selectedGame, setSelectedGame] = useState<GiveawayGame | null>(null);

  // Modals & Cloud User Auth State
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [cloudClaims, setCloudClaims] = useState<CloudClaimRecord[]>([]);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Radar Filter & Sort State
  const [selectedStore, setSelectedStore] = useState<StoreId | 'all'>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'expiring' | 'unclaimed'
  >('all');
  const [sortBy, setSortBy] = useState<'ending_soon' | 'highest_value' | 'rating'>(
    'ending_soon'
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Upcoming View Filter State
  const [upcomingStoreFilter, setUpcomingStoreFilter] = useState<StoreId | 'all'>('all');
  const [upcomingPlatformFilter, setUpcomingPlatformFilter] = useState<
    PlatformId | 'all'
  >('all');

  // Sync live giveaways from backend API (/api/giveaways) or native Android APK bridge
  const syncLiveGiveaways = async (forceRefresh = false) => {
    lastFeedAttemptRef.current = Date.now();
    setIsSyncingFeed(true);
    try {
      const res = await fetch(
        `/api/giveaways${forceRefresh ? '?refresh=true' : ''}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.giveaways) && data.giveaways.length > 0) {
          setGiveaways(data.giveaways);
          if (data.syncedAt) setLastSyncedAt(data.syncedAt);
          return;
        }
      }
      throw new Error('Fallback to direct client sync');
    } catch {
      try {
        const directGames = await fetchClientSideLiveGiveaways();
        if (directGames.length > 0) {
          setGiveaways(directGames);
          setLastSyncedAt(new Date().toISOString());
        }
      } catch {
        // Keep verified INITIAL_GIVEAWAYS on network error
      }
    } finally {
      setIsSyncingFeed(false);
    }
  };

  // Sync on load, on a timer, and whenever the app returns to the foreground
  useEffect(() => {
    syncLiveGiveaways(false);

    const syncIfStale = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastFeedAttemptRef.current >= FEED_RESUME_MIN_AGE_MS
      ) {
        syncLiveGiveaways(false);
      }
    };
    const interval = setInterval(syncIfStale, FEED_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', syncIfStale);
    window.addEventListener('focus', syncIfStale);
    window.addEventListener('online', syncIfStale);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', syncIfStale);
      window.removeEventListener('focus', syncIfStale);
      window.removeEventListener('online', syncIfStale);
    };
  }, []);

  // Listen to Firebase Auth state and sync user profile + guest claims
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
      if (user) {
        setIsSyncingCloud(true);
        try {
          await ensureUserProfileAndSyncGuestClaims(
            user,
            claimedIds,
            giveawaysRef.current,
            prefs.browserPushEnabled,
            prefs.monitoredStores
          );
        } catch {
          // Handled inside firebase helper
        } finally {
          setIsSyncingCloud(false);
        }
      } else {
        setCloudClaims([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Attach real-time Firestore listeners for user profile and claimed games when authenticated
  useEffect(() => {
    if (!isAuthReady || !currentUser) return;
    const uid = sanitizeDocId(currentUser.uid);
    const claimsPath = `users/${uid}/claims`;
    const claimsQuery = query(
      collection(db, 'users', uid, 'claims'),
      where('uid', '==', uid)
    );

    const unsubscribeClaims = onSnapshot(
      claimsQuery,
      (snapshot) => {
        const records: CloudClaimRecord[] = [];
        const cloudGameIds = new Set<string>();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as CloudClaimRecord;
          records.push(data);
          cloudGameIds.add(data.gameId);
        });
        setCloudClaims(records);

        // Ensure all cloud-claimed games are reflected in claimedIds
        setClaimedIds((prev) => {
          const merged = new Set(prev);
          for (const g of giveawaysRef.current) {
            const sId = sanitizeDocId(g.id);
            if (cloudGameIds.has(sId) || cloudGameIds.has(g.id)) {
              merged.add(g.id);
            }
          }
          for (const cid of cloudGameIds) {
            merged.add(cid);
          }
          return Array.from(merged);
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, claimsPath);
      }
    );

    const userPath = `users/${uid}`;
    const unsubscribeProfile = onSnapshot(
      doc(db, 'users', uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data.notifyStores)) {
            setPrefs((prev) => ({
              ...prev,
              browserPushEnabled:
                typeof data.pushEnabled === 'boolean'
                  ? data.pushEnabled
                  : prev.browserPushEnabled,
              monitoredStores: data.notifyStores,
            }));
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, userPath);
      }
    );

    return () => {
      unsubscribeClaims();
      unsubscribeProfile();
    };
  }, [isAuthReady, currentUser]);

  // 1-second live countdown ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Save state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CLAIMED, JSON.stringify(claimedIds));
    } catch {
      // ignore storage quota errors
    }
  }, [claimedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PREFS, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts));
    } catch {
      // ignore
    }
  }, [alerts]);

  // Auto-dismiss live toast after 6 seconds
  useEffect(() => {
    if (!liveToast) return;
    const timer = setTimeout(() => {
      setLiveToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [liveToast]);

  // Dispatch a push notification + in-app toast + log entry
  const triggerPushAlert = (newAlert: RadarAlert) => {
    setAlerts((prev) => [newAlert, ...prev]);
    setLiveToast(newAlert);
    if (prefs.soundChimeEnabled) {
      playAlertChime();
    }
    if (prefs.browserPushEnabled) {
      dispatchNativeNotification(newAlert);
    }
  };

  const handleSimulateAlert = (
    type: 'new_drop' | 'expiring_soon' | 'upcoming_unlock'
  ) => {
    if (giveaways.length === 0) return;
    if (type === 'upcoming_unlock') {
      const target =
        giveaways.find((g) => g.status === 'upcoming') || giveaways[0];
      triggerPushAlert({
        id: `alert-${Date.now()}`,
        type: 'upcoming_unlock',
        title: `Upcoming Drop Reminder: ${target.title}`,
        message: `${target.storeName} confirmed ${target.title} ($${target.originalPrice.toFixed(
          2
        )} value) is scheduled to unlock at 100% off for ${target.platforms
          .map((p) => PLATFORM_META[p].shortLabel)
          .join(', ')}.`,
        timestamp: new Date().toISOString(),
        gameId: target.id,
        store: target.store,
        read: false,
      });
    } else if (type === 'expiring_soon') {
      const expiringGame =
        giveaways.find((g) => g.status === 'expiring') || giveaways[1] || giveaways[0];
      const countdown = formatCountdown(expiringGame.endDate, nowMs);
      triggerPushAlert({
        id: `alert-${Date.now()}`,
        type: 'expiring_soon',
        title: `Ending Soon: ${expiringGame.title}`,
        message: `Only ${countdown.formatted} remaining to claim ${
          expiringGame.title
        } ($${expiringGame.originalPrice.toFixed(2)}) for free on ${
          expiringGame.storeName
        }.`,
        timestamp: new Date().toISOString(),
        gameId: expiringGame.id,
        store: expiringGame.store,
        read: false,
      });
    } else {
      const dropGame =
        giveaways.find((g) => g.status === 'active') || giveaways[0];
      triggerPushAlert({
        id: `alert-${Date.now()}`,
        type: 'new_drop',
        title: `New Freebie Radar Drop: ${dropGame.title}`,
        message: `${dropGame.title} ($${dropGame.originalPrice.toFixed(
          2
        )} retail) is now 100% FREE on ${dropGame.storeName} (${dropGame.drmType}).`,
        timestamp: new Date().toISOString(),
        gameId: dropGame.id,
        store: dropGame.store,
        read: false,
      });
    }
  };

  const handleTriggerAlertForGame = (game: GiveawayGame) => {
    triggerPushAlert({
      id: `alert-${Date.now()}`,
      type:
        game.status === 'upcoming'
          ? 'upcoming_unlock'
          : game.status === 'expiring'
          ? 'expiring_soon'
          : 'new_drop',
      title: `Radar Alert: ${game.title} on ${game.storeName}`,
      message: `${
        game.status === 'upcoming' ? 'Upcoming giveaway reminder' : '100% off claim active'
      } — Save $${game.originalPrice.toFixed(2)} on ${game.platforms
        .map((p) => PLATFORM_META[p].shortLabel)
        .join(', ')}.`,
      timestamp: new Date().toISOString(),
      gameId: game.id,
      store: game.store,
      read: false,
    });
  };

  const handleRequestBrowserPermission = async () => {
    const status = await requestBrowserNotificationPermission();
    setPermissionStatus(status);
    if (status === 'granted') {
      setPrefs((prev) => ({ ...prev, browserPushEnabled: true }));
      handleSimulateAlert('new_drop');
    }
  };

  const isGameClaimed = (gameId: string): boolean => {
    const sId = sanitizeDocId(gameId);
    return claimedIds.includes(gameId) || claimedIds.includes(sId);
  };

  const handleToggleClaimed = (gameId: string) => {
    const sId = sanitizeDocId(gameId);
    const currentlyClaimed =
      claimedIds.includes(gameId) || claimedIds.includes(sId);

    setClaimedIds((prev) => {
      if (currentlyClaimed) {
        return prev.filter((id) => id !== gameId && sanitizeDocId(id) !== sId);
      }
      return Array.from(new Set([...prev, gameId]));
    });

    if (currentUser) {
      if (currentlyClaimed) {
        removeClaimFromCloud(currentUser, gameId).catch(() => {});
      } else {
        const targetGame = giveaways.find(
          (g) => g.id === gameId || sanitizeDocId(g.id) === sId
        );
        if (targetGame) {
          saveClaimToCloud(currentUser, targetGame).catch(() => {});
        }
      }
    }
  };

  const handleMarkClaimedOnStoreVisit = (game: GiveawayGame) => {
    if (!isGameClaimed(game.id)) {
      handleToggleClaimed(game.id);
    }
  };

  // Active & Expiring Giveaways (excluding upcoming, strictly paid games/expansions/official Steam playtests)
  const liveGiveaways = useMemo(
    () =>
      giveaways.filter(
        (g) => g.status !== 'upcoming' && isEligibleGiveawayGame(g)
      ),
    [giveaways]
  );

  // Upcoming Giveaways
  const upcomingGiveaways = useMemo(
    () =>
      giveaways.filter(
        (g) => g.status === 'upcoming' && isEligibleGiveawayGame(g)
      ),
    [giveaways]
  );

  // Headliner Game
  const headlinerGame = useMemo(
    () =>
      liveGiveaways.find((g) => g.isHeadliner) ||
      liveGiveaways[0] ||
      INITIAL_GIVEAWAYS[0],
    [liveGiveaways]
  );

  // Urgent / Soonest Ending Games (Top 3 soonest ending live giveaways)
  const expiringGames = useMemo(
    () =>
      [...liveGiveaways]
        .sort(
          (a, b) =>
            new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
        )
        .slice(0, 3),
    [liveGiveaways]
  );

  // Filtered & Sorted Live Giveaways
  const filteredLiveGiveaways = useMemo(() => {
    return liveGiveaways
      .filter((game) => {
        if (selectedStore !== 'all' && game.store !== selectedStore) return false;
        if (
          selectedPlatform !== 'all' &&
          !game.platforms.includes(selectedPlatform)
        ) {
          return false;
        }
        if (statusFilter === 'expiring' && game.status !== 'expiring') return false;
        if (statusFilter === 'unclaimed' && claimedIds.includes(game.id))
          return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = game.title.toLowerCase().includes(q);
          const matchGenre = game.genres.some((genre) =>
            genre.toLowerCase().includes(q)
          );
          const matchStore = game.storeName.toLowerCase().includes(q);
          if (!matchTitle && !matchGenre && !matchStore) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'ending_soon') {
          return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
        }
        if (sortBy === 'highest_value') {
          return b.originalPrice - a.originalPrice;
        }
        return b.ratingScore - a.ratingScore;
      });
  }, [
    liveGiveaways,
    selectedStore,
    selectedPlatform,
    statusFilter,
    sortBy,
    searchQuery,
    claimedIds,
  ]);

  // Filtered Upcoming Giveaways
  const filteredUpcomingGiveaways = useMemo(() => {
    return upcomingGiveaways.filter((game) => {
      if (upcomingStoreFilter !== 'all' && game.store !== upcomingStoreFilter)
        return false;
      if (
        upcomingPlatformFilter !== 'all' &&
        !game.platforms.includes(upcomingPlatformFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [upcomingGiveaways, upcomingStoreFilter, upcomingPlatformFilter]);

  // KPI Metrics
  const totalLiveValue = useMemo(
    () => liveGiveaways.reduce((acc, g) => acc + g.originalPrice, 0),
    [liveGiveaways]
  );

  const totalClaimedSavings = useMemo(
    () =>
      giveaways
        .filter((g) => claimedIds.includes(g.id))
        .reduce((acc, g) => acc + g.originalPrice, 0),
    [giveaways, claimedIds]
  );

  const endingSoonCount = useMemo(
    () => liveGiveaways.filter((g) => g.status === 'expiring').length,
    [liveGiveaways]
  );

  const unreadAlertsCount = useMemo(
    () => alerts.filter((a) => !a.read).length,
    [alerts]
  );

  const headlinerCountdown = formatCountdown(headlinerGame.endDate, nowMs);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#0B0F19]/95 backdrop-blur-md border-b border-slate-800/90">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#radar"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('radar');
            }}
            className="text-xl font-display font-bold tracking-tight text-white hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
          >
            LootRadar
          </a>

          {/* Zone 2: 4 clean single-line text navigation links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            <a
              href="#radar"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('radar');
              }}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'radar'
                  ? 'text-white border-cyan-400'
                  : 'text-slate-400 hover:text-slate-100 border-transparent'
              }`}
            >
              Live Radar ({liveGiveaways.length})
            </a>

            <a
              href="#upcoming"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('upcoming');
              }}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'upcoming'
                  ? 'text-white border-cyan-400'
                  : 'text-slate-400 hover:text-slate-100 border-transparent'
              }`}
            >
              Upcoming ({upcomingGiveaways.length})
            </a>

            <a
              href="#claimed"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('claimed');
              }}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'claimed'
                  ? 'text-white border-cyan-400'
                  : 'text-slate-400 hover:text-slate-100 border-transparent'
              }`}
            >
              Claimed ({claimedIds.length})
            </a>

            <a
              href="#alerts"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('alerts');
              }}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'alerts'
                  ? 'text-white border-cyan-400'
                  : 'text-slate-400 hover:text-slate-100 border-transparent'
              }`}
            >
              Push Alerts {unreadAlertsCount > 0 ? `(${unreadAlertsCount})` : ''}
            </a>
          </nav>

          {/* Zone 3: Top-Right Download App (Android & iOS) + User Account Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsDownloadModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-100 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Download App</span>
            </button>

            <button
              onClick={() => setIsAuthModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentUser
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300'
                  : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
              }`}
            >
              {currentUser ? (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span className="max-w-[120px] truncate">
                    {currentUser.displayName ||
                      currentUser.email?.split('@')[0] ||
                      'Account'}
                  </span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Sign In / Sign Up</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Compact Sub-Nav (Visible only on small viewports) */}
        <div className="flex md:hidden items-center justify-around border-t border-slate-800/80 bg-[#0B0F19] px-2 py-2 text-xs font-medium overflow-x-auto">
          {(
            [
              { id: 'radar', label: `Radar (${liveGiveaways.length})` },
              { id: 'upcoming', label: `Upcoming (${upcomingGiveaways.length})` },
              { id: 'claimed', label: `Claimed (${claimedIds.length})` },
              { id: 'alerts', label: `Alerts (${unreadAlertsCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-cyan-400/15 text-cyan-300 font-semibold'
                  : 'text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Live Push Notification Toast Banner */}
      {liveToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md w-[calc(100%-2.5rem)] bg-[#111827] border border-cyan-500/50 rounded-xl shadow-2xl p-4 text-slate-100 animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-cyan-400/15 text-cyan-300 shrink-0 mt-0.5">
                <BellRing className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-cyan-300">
                  Live Push Notification Dispatched
                </div>
                <div className="text-sm font-display font-bold text-white">
                  {liveToast.title}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {liveToast.message}
                </p>
                <div className="pt-1.5 flex items-center gap-3">
                  {liveToast.gameId && (
                    <button
                      onClick={() => {
                        const found = giveaways.find(
                          (g) => g.id === liveToast.gameId
                        );
                        if (found) setSelectedGame(found);
                        setLiveToast(null);
                      }}
                      className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                    >
                      Inspect Giveaway →
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setActiveTab('alerts');
                      setLiveToast(null);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Open Alert Log
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setLiveToast(null)}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'radar' && (
          <div className="space-y-8">
            {/* Hero 2-Column Split: Featured Headliner + Ending Soonest Priority Queue */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left 8 Columns: Headliner Freebie Spotlight */}
              <div className="lg:col-span-8 relative rounded-2xl overflow-hidden border border-slate-800/90 bg-[#111827] flex flex-col justify-end min-h-[380px] sm:min-h-[420px]">
                <div className="absolute inset-0">
                  <GameCoverArt
                    src={headlinerGame.coverImage}
                    alt={headlinerGame.title}
                    accentGradient={headlinerGame.accentGradient}
                    className="w-full h-full object-cover"
                  />
                  {/* Measured Contrast Scrim */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-[#0B0F19]/80 to-black/30" />
                </div>

                <div className="relative z-10 p-6 sm:p-8 space-y-4">
                  {/* Unboxed Metadata Kicker */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <span className="font-semibold text-cyan-400">
                      Featured Weekly Freebie
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-white">
                      <StoreIcon
                        store={headlinerGame.store}
                        className={`w-3.5 h-3.5 ${
                          STORE_META[headlinerGame.store].colorClass
                        }`}
                      />
                      <span>{headlinerGame.storeName}</span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <PlatformIconList platforms={headlinerGame.platforms} />
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-400 font-mono tabular-nums font-semibold">
                      Worth ${headlinerGame.originalPrice.toFixed(2)} → $0.00 (100% Off)
                    </span>
                  </div>

                  <div className="space-y-1.5 max-w-2xl">
                    <h1 className="text-2xl sm:text-4xl font-display font-bold text-white tracking-tight">
                      {headlinerGame.title}
                    </h1>
                    <p className="text-sm text-slate-300 line-clamp-2">
                      {headlinerGame.description}
                    </p>
                  </div>

                  {/* Live Countdown & Action Controls */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="text-xs text-slate-300">Ends in</span>
                      <span className="text-sm sm:text-base font-mono font-bold tabular-nums text-white bg-slate-950/90 border border-slate-800 px-3 py-1 rounded-lg">
                        {headlinerCountdown.formatted}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <a
                        href={headlinerGame.claimUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleMarkClaimedOnStoreVisit(headlinerGame)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs transition-colors whitespace-nowrap shrink-0"
                      >
                        <StoreIcon
                          store={headlinerGame.store}
                          className="w-3.5 h-3.5"
                        />
                        <span>
                          {isGameClaimed(headlinerGame.id)
                            ? `Claimed on ${STORE_META[headlinerGame.store].shortName}`
                            : `Claim Free on ${STORE_META[headlinerGame.store].shortName}`}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => handleToggleClaimed(headlinerGame.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isGameClaimed(headlinerGame.id)
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-950/85 border-slate-700 text-slate-200 hover:border-slate-500'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {isGameClaimed(headlinerGame.id)
                            ? 'Claimed'
                            : 'Mark Claimed'}
                        </span>
                      </button>

                      <button
                        onClick={() => setSelectedGame(headlinerGame)}
                        className="px-3.5 py-2.5 rounded-lg bg-slate-950/85 hover:bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Full Specs
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 4 Columns: Ending Soonest Priority Queue */}
              <div className="lg:col-span-4 bg-[#111827] border border-slate-800/90 rounded-2xl p-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h2 className="text-base font-display font-bold text-white">
                        Ending Soonest Queue
                      </h2>
                      <p className="text-xs text-slate-400">
                        Next giveaways scheduled to expire
                      </p>
                    </div>
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  </div>

                  <div className="divide-y divide-slate-800/80">
                    {expiringGames.map((expGame) => {
                      const cd = formatCountdown(expGame.endDate, nowMs);
                      const storeMeta = STORE_META[expGame.store];
                      const claimed = claimedIds.includes(expGame.id);

                      return (
                        <div key={expGame.id} className="py-3.5 first:pt-1 last:pb-1 space-y-2">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="inline-flex items-center gap-1.5 min-w-0">
                              <span
                                className={`inline-flex items-center gap-1 font-semibold ${storeMeta.colorClass}`}
                              >
                                <StoreIcon
                                  store={expGame.store}
                                  className="w-3.5 h-3.5"
                                />
                                <span>{storeMeta.shortName}</span>
                              </span>
                              <span aria-hidden="true" className="text-slate-600">
                                ·
                              </span>
                              <PlatformIconList
                                platforms={expGame.platforms}
                                className="inline-flex items-center gap-1.5 text-slate-300"
                              />
                            </span>
                            <span className="font-mono font-semibold tabular-nums text-amber-300 shrink-0">
                              {cd.formatted}
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between gap-2">
                            <h3
                              onClick={() => setSelectedGame(expGame)}
                              className="text-sm font-display font-semibold text-white hover:text-cyan-300 transition-colors cursor-pointer truncate"
                            >
                              {expGame.title}
                            </h3>
                            <span className="text-xs font-mono tabular-nums text-emerald-400 shrink-0">
                              <span className="line-through text-slate-500 mr-1">
                                ${expGame.originalPrice.toFixed(2)}
                              </span>
                              FREE
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <button
                              onClick={() => setSelectedGame(expGame)}
                              className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                            >
                              View Details
                            </button>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleToggleClaimed(expGame.id)}
                                className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                                  claimed
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                {claimed ? 'Claimed' : 'Mark Claimed'}
                              </button>
                              <a
                                href={expGame.claimUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => handleMarkClaimedOnStoreVisit(expGame)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-colors"
                              >
                                <span>{claimed ? 'Claimed' : 'Claim'}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <button
                    onClick={() => syncLiveGiveaways(true)}
                    disabled={isSyncingFeed}
                    className="inline-flex items-center gap-1.5 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isSyncingFeed ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {isSyncingFeed ? 'Syncing Store Feeds...' : 'Refresh Live Store Feeds'}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('alerts')}
                    className="font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    Configure Alerts →
                  </button>
                </div>
              </div>
            </section>

            {/* Full-Width 4-Column KPI Summary Bar */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-[#111827] border border-slate-800/90 rounded-xl p-5">
              <div className="space-y-1">
                <div className="text-xs text-slate-400">Active 100% Off Giveaways</div>
                <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-white">
                  {liveGiveaways.length} Games Live
                </div>
                <div className="text-xs text-slate-400">
                  Direct verified links to Epic, Amazon Luna, Steam, GOG, itch.io
                </div>
              </div>

              <div className="space-y-1 border-l border-slate-800/80 pl-4">
                <div className="text-xs text-slate-400">Claimable Value Right Now</div>
                <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-emerald-400">
                  ${totalLiveValue.toFixed(2)} USD
                </div>
                <div className="text-xs text-slate-400">
                  100% free to keep permanently
                </div>
              </div>

              <div className="space-y-1 border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-3 lg:pt-0 lg:pl-4">
                <div className="text-xs text-slate-400">Ending Within 48 Hours</div>
                <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-amber-400">
                  {endingSoonCount} Urgent Drops
                </div>
                <div className="text-xs text-slate-400">
                  Synced at{' '}
                  <span className="font-mono tabular-nums text-slate-300">
                    {new Date(lastSyncedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              <div className="space-y-1 border-t lg:border-t-0 border-l border-slate-800/80 pt-3 lg:pt-0 pl-4">
                <div className="text-xs text-slate-400">Your Lifetime Savings</div>
                <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-white">
                  ${totalClaimedSavings.toFixed(2)} Saved
                </div>
                <div className="text-xs text-slate-400">
                  {claimedIds.length} giveaways marked claimed
                </div>
              </div>
            </section>

            {/* Interactive Filter & Platform Matrix Toolbar */}
            <section className="bg-[#111827] border border-slate-800/90 rounded-xl p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Store Filter Tabs */}
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-400 block">
                    Filter by Storefront
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setSelectedStore('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedStore === 'all'
                          ? 'bg-cyan-400 text-slate-950 font-semibold'
                          : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                      }`}
                    >
                      All Stores ({liveGiveaways.length})
                    </button>
                    {ALL_STORES.map((store) => {
                      const count = liveGiveaways.filter(
                        (g) => g.store === store
                      ).length;
                      return (
                        <button
                          key={store}
                          onClick={() => setSelectedStore(store)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            selectedStore === store
                              ? 'bg-cyan-400 text-slate-950 font-semibold'
                              : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                          }`}
                        >
                          <StoreIcon
                            store={store}
                            className={`w-3.5 h-3.5 ${
                              selectedStore === store
                                ? 'text-slate-950'
                                : STORE_META[store].colorClass
                            }`}
                          />
                          <span>
                            {STORE_META[store].shortName} ({count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Platform Filter Tabs */}
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-400 block">
                    Filter by Target Platform
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setSelectedPlatform('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedPlatform === 'all'
                          ? 'bg-emerald-400 text-slate-950 font-semibold'
                          : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                      }`}
                    >
                      All Platforms
                    </button>
                    {ALL_PLATFORMS.map((platform) => (
                      <button
                        key={platform}
                        onClick={() => setSelectedPlatform(platform)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          selectedPlatform === platform
                            ? 'bg-emerald-400 text-slate-950 font-semibold'
                            : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                        }`}
                      >
                        <PlatformIcon platform={platform} className="w-3.5 h-3.5" />
                        <span>{PLATFORM_META[platform].shortLabel}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Second Row: Status Filter, Sort & Live Search */}
              <div className="pt-3 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                    {(
                      [
                        { id: 'all', label: 'All Active' },
                        { id: 'expiring', label: 'Ending Soon' },
                        { id: 'unclaimed', label: 'Unclaimed Only' },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        onClick={() => setStatusFilter(st.id)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          statusFilter === st.id
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sort:</span>
                    <select
                      aria-label="Sort giveaways"
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(
                          e.target.value as
                            | 'ending_soon'
                            | 'highest_value'
                            | 'rating'
                        )
                      }
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      <option value="ending_soon">Ending Soonest</option>
                      <option value="highest_value">Highest Value ($)</option>
                      <option value="rating">Highest User Rating</option>
                    </select>
                  </div>
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search title, genre, or store..."
                    className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Active Giveaways Grid */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display font-bold text-white">
                  Active Game Giveaways ({filteredLiveGiveaways.length})
                </h2>
                {(selectedStore !== 'all' ||
                  selectedPlatform !== 'all' ||
                  statusFilter !== 'all' ||
                  searchQuery) && (
                  <button
                    onClick={() => {
                      setSelectedStore('all');
                      setSelectedPlatform('all');
                      setStatusFilter('all');
                      setSearchQuery('');
                    }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>

              {filteredLiveGiveaways.length === 0 ? (
                <div className="bg-[#111827] border border-slate-800/90 rounded-xl p-12 text-center space-y-3">
                  <p className="text-base font-medium text-slate-200">
                    No active giveaways match your current filter combination
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Try resetting your platform or store filter to view all live 100% off
                    giveaways.
                  </p>
                  <div className="pt-2 flex items-center justify-center">
                    <button
                      onClick={() => {
                        setSelectedStore('all');
                        setSelectedPlatform('all');
                        setStatusFilter('all');
                        setSearchQuery('');
                      }}
                      className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Reset Radar Filters
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredLiveGiveaways.map((game) => {
                    const countdown = formatCountdown(game.endDate, nowMs);
                    const storeMeta = STORE_META[game.store];
                    const isClaimed = claimedIds.includes(game.id);

                    return (
                      <article
                        key={game.id}
                        className="bg-[#111827] border border-slate-800/90 hover:border-slate-700 rounded-xl overflow-hidden flex flex-col justify-between transition-colors"
                      >
                        <div>
                          {/* 16:9 Artwork Header */}
                          <div
                            onClick={() => setSelectedGame(game)}
                            className="relative h-48 w-full overflow-hidden bg-slate-950 cursor-pointer group"
                          >
                            <GameCoverArt
                              src={game.coverImage}
                              alt={game.title}
                              accentGradient={game.accentGradient}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-black/25 to-black/30" />

                            {/* Bottom Scrim Overlay: Live Countdown & Price */}
                            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums bg-slate-950/90 border border-slate-800/90 px-2.5 py-1 rounded">
                                <Clock
                                  className={`w-3.5 h-3.5 ${
                                    countdown.isUrgent
                                      ? 'text-amber-400'
                                      : 'text-cyan-400'
                                  }`}
                                />
                                <span
                                  className={
                                    countdown.isUrgent
                                      ? 'text-amber-300 font-semibold'
                                      : 'text-slate-100'
                                  }
                                >
                                  {countdown.formatted}
                                </span>
                              </div>

                              <div className="flex items-baseline gap-1.5 bg-slate-950/90 border border-slate-800/90 px-2.5 py-1 rounded font-mono tabular-nums">
                                <span className="text-xs text-slate-400 line-through">
                                  ${game.originalPrice.toFixed(2)}
                                </span>
                                <span className="text-xs font-bold text-emerald-400">
                                  FREE
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Body — Clean Unboxed Metadata (Zero-Pill Discipline) */}
                          <div className="p-5 space-y-2.5">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                              <span
                                className={`inline-flex items-center gap-1.5 font-semibold ${storeMeta.colorClass}`}
                              >
                                <StoreIcon store={game.store} className="w-3.5 h-3.5" />
                                <span>{storeMeta.shortName}</span>
                              </span>
                              <span aria-hidden="true">·</span>
                              <PlatformIconList
                                platforms={game.platforms}
                                className="inline-flex flex-wrap items-center gap-1.5 text-slate-300"
                              />
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums text-slate-300">
                                {game.ratingScore}% Rating
                              </span>
                            </div>

                            <div>
                              <h3
                                onClick={() => setSelectedGame(game)}
                                className="text-lg font-display font-bold text-white hover:text-cyan-300 transition-colors cursor-pointer leading-snug"
                              >
                                {game.title}
                              </h3>
                              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                                {game.genres.join(' · ')}
                              </p>
                            </div>

                            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                              {game.description}
                            </p>
                          </div>
                        </div>

                        {/* Card Footer Controls */}
                        <div className="px-5 pb-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleClaimed(game.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                isClaimed
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isClaimed ? 'Claimed' : 'Mark Claimed'}</span>
                            </button>

                            <button
                              onClick={() => setSelectedGame(game)}
                              className="px-2.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Details
                            </button>
                          </div>

                          <a
                            href={game.claimUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleMarkClaimedOnStoreVisit(game)}
                            title={`Open ${game.title} on ${storeMeta.name}`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs transition-colors whitespace-nowrap shrink-0"
                          >
                            <StoreIcon store={game.store} className="w-3.5 h-3.5" />
                            <span>
                              {isClaimed
                                ? `Claimed on ${storeMeta.shortName}`
                                : `Claim on ${storeMeta.shortName}`}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* UPCOMING GIVEAWAYS TAB */}
        {activeTab === 'upcoming' && (
          <div className="space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800/80">
              <div>
                <p className="text-xs font-medium text-cyan-400 mb-1">
                  Official Upcoming Promotional Schedule · Verified Store Pages
                </p>
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                  Upcoming Freebie Schedule ({filteredUpcomingGiveaways.length})
                </h1>
                <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                  Preview upcoming confirmed 100% free giveaways from Epic Games Store’s
                  official promotional feed. Click "Send Unlock Alert" on any upcoming
                  title to test or trigger a notification reminder.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-[#111827] border border-slate-800 rounded-lg">
                  <button
                    onClick={() => setUpcomingStoreFilter('all')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      upcomingStoreFilter === 'all'
                        ? 'bg-cyan-400 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Stores
                  </button>
                  {(['epic', 'steam'] as StoreId[]).map((store) => (
                    <button
                      key={store}
                      onClick={() => setUpcomingStoreFilter(store)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        upcomingStoreFilter === store
                          ? 'bg-cyan-400 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <StoreIcon store={store} className="w-3.5 h-3.5" />
                      <span>{STORE_META[store].shortName}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 p-1 bg-[#111827] border border-slate-800 rounded-lg">
                  {(
                    ['all', 'windows', 'mac', 'linux', 'steamdeck', 'console'] as const
                  ).map((plat) => (
                    <button
                      key={plat}
                      onClick={() => setUpcomingPlatformFilter(plat)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        upcomingPlatformFilter === plat
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {plat !== 'all' && (
                        <PlatformIcon platform={plat} className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {plat === 'all' ? 'All Platforms' : PLATFORM_META[plat].shortLabel}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUpcomingGiveaways.map((game) => {
                const unlockCountdown = formatCountdown(game.startDate, nowMs);
                const storeMeta = STORE_META[game.store];

                return (
                  <article
                    key={game.id}
                    className="bg-[#111827] border border-slate-800/90 rounded-xl overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div
                        onClick={() => setSelectedGame(game)}
                        className="relative h-48 w-full overflow-hidden bg-slate-950 cursor-pointer group"
                      >
                        <GameCoverArt
                          src={game.coverImage}
                          alt={game.title}
                          accentGradient={game.accentGradient}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-black/30 to-black/30" />

                        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                          <div className="text-xs font-mono tabular-nums text-cyan-300 bg-slate-950/90 border border-slate-800 px-2.5 py-1 rounded">
                            Unlocks in {unlockCountdown.formatted}
                          </div>
                          <div className="text-xs font-mono font-bold tabular-nums text-emerald-400 bg-slate-950/90 border border-slate-800 px-2.5 py-1 rounded">
                            ${game.originalPrice.toFixed(2)} → $0.00
                          </div>
                        </div>
                      </div>

                      <div className="p-5 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                          <span
                            className={`inline-flex items-center gap-1.5 font-semibold ${storeMeta.colorClass}`}
                          >
                            <StoreIcon store={game.store} className="w-3.5 h-3.5" />
                            <span>{storeMeta.name}</span>
                          </span>
                          <span aria-hidden="true">·</span>
                          <PlatformIconList
                            platforms={game.platforms}
                            className="inline-flex flex-wrap items-center gap-1.5 text-slate-300"
                          />
                        </div>

                        <h3
                          onClick={() => setSelectedGame(game)}
                          className="text-lg font-display font-bold text-white hover:text-cyan-300 transition-colors cursor-pointer"
                        >
                          {game.title}
                        </h3>

                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                          {game.description}
                        </p>
                      </div>
                    </div>

                    <div className="px-5 pb-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <a
                        href={game.claimUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-cyan-300 transition-colors"
                      >
                        <span>Store Page</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => handleTriggerAlertForGame(game)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        <span>Send Unlock Alert</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* CLAIMED LIBRARY TAB */}
        {activeTab === 'claimed' && (
          <ClaimedLibraryView
            giveaways={giveaways}
            claimedIds={claimedIds}
            cloudClaims={cloudClaims}
            currentUser={currentUser}
            onToggleClaimed={handleToggleClaimed}
            onSelectGame={(game) => setSelectedGame(game)}
            onExploreRadar={() => setActiveTab('radar')}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        )}

        {/* ALERTS & PUSH NOTIFICATIONS TAB */}
        {activeTab === 'alerts' && (
          <AlertsCenterView
            prefs={prefs}
            permissionStatus={permissionStatus}
            alerts={alerts}
            giveaways={giveaways}
            onUpdatePrefs={(updated) => {
              setPrefs((prev) => {
                const next = { ...prev, ...updated };
                if (currentUser) {
                  updateAlertPrefsInCloud(
                    currentUser,
                    next.browserPushEnabled,
                    next.monitoredStores
                  ).catch(() => {});
                }
                return next;
              });
            }}
            onRequestBrowserPermission={handleRequestBrowserPermission}
            onSimulateAlert={handleSimulateAlert}
            onMarkAllRead={() =>
              setAlerts((prev) => prev.map((a) => ({ ...a, read: true })))
            }
            onClearAlerts={() => setAlerts([])}
            onSelectGameById={(gameId) => {
              const found = giveaways.find((g) => g.id === gameId);
              if (found) setSelectedGame(found);
            }}
          />
        )}
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t border-slate-800/80 py-6 mt-12">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            LootRadar — Live Freebie Games Radar &amp; Cloud Claim Tracker
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <button
              onClick={() => setActiveTab('radar')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Live Giveaways
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Upcoming Drops
            </button>
            <button
              onClick={() => setIsDownloadModalOpen(true)}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Android &amp; iOS Apps
            </button>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              {currentUser ? 'Cloud Account' : 'Sign In / Sign Up'}
            </button>
          </div>
        </div>
      </footer>

      {/* Game Detail Modal */}
      <GameDetailModal
        game={selectedGame}
        nowMs={nowMs}
        isClaimed={selectedGame ? isGameClaimed(selectedGame.id) : false}
        onClose={() => setSelectedGame(null)}
        onToggleClaimed={handleToggleClaimed}
        onTriggerTestAlert={handleTriggerAlertForGame}
      />

      {/* Mobile App Download Modal (Android APK & iOS .mobileconfig/.ipa) */}
      <MobileAppDownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />

      {/* User Account & Cloud Sync Modal (Google, Apple, Email/Password) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        currentUser={currentUser}
        claimedCount={claimedIds.length}
        totalSavedUsd={totalClaimedSavings}
        isSyncingCloud={isSyncingCloud}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={async (user) => {
          setCurrentUser(user);
          setIsSyncingCloud(true);
          try {
            await ensureUserProfileAndSyncGuestClaims(
              user,
              claimedIds,
              giveaways,
              prefs.browserPushEnabled,
              prefs.monitoredStores
            );
          } catch {
            // Handled in firebase helper
          } finally {
            setIsSyncingCloud(false);
          }
        }}
      />
    </div>
  );
}
