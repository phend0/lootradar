import React from 'react';
import {
  Bell,
  BellRing,
  CheckCheck,
  Clock,
  CalendarClock,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  GiveawayGame,
  NotificationPrefs,
  PlatformId,
  RadarAlert,
  StoreId,
} from '../types';
import { PLATFORM_META, STORE_META } from '../data/giveaways';
import { PlatformIcon, StoreIcon } from './PlatformIcons';

interface AlertsCenterViewProps {
  prefs: NotificationPrefs;
  permissionStatus: NotificationPermission | 'unsupported';
  alerts: RadarAlert[];
  giveaways: GiveawayGame[];
  onUpdatePrefs: (updated: Partial<NotificationPrefs>) => void;
  onRequestBrowserPermission: () => void;
  onSimulateAlert: (type: 'new_drop' | 'expiring_soon' | 'upcoming_unlock') => void;
  onMarkAllRead: () => void;
  onClearAlerts: () => void;
  onSelectGameById: (gameId: string) => void;
}

const ALL_STORES: StoreId[] = ['epic', 'steam', 'gog', 'prime', 'itch'];
const ALL_PLATFORMS: PlatformId[] = ['windows', 'mac', 'linux', 'steamdeck', 'console'];

export const AlertsCenterView: React.FC<AlertsCenterViewProps> = ({
  prefs,
  permissionStatus,
  alerts,
  onUpdatePrefs,
  onRequestBrowserPermission,
  onSimulateAlert,
  onMarkAllRead,
  onClearAlerts,
  onSelectGameById,
}) => {
  const toggleMonitoredStore = (store: StoreId) => {
    const exists = prefs.monitoredStores.includes(store);
    const next = exists
      ? prefs.monitoredStores.filter((s) => s !== store)
      : [...prefs.monitoredStores, store];
    if (next.length > 0) {
      onUpdatePrefs({ monitoredStores: next });
    }
  };

  const toggleMonitoredPlatform = (platform: PlatformId) => {
    const exists = prefs.monitoredPlatforms.includes(platform);
    const next = exists
      ? prefs.monitoredPlatforms.filter((p) => p !== platform)
      : [...prefs.monitoredPlatforms, platform];
    if (next.length > 0) {
      onUpdatePrefs({ monitoredPlatforms: next });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div>
          <p className="text-xs font-medium text-cyan-400 mb-1">
            Real-Time Push Dispatch · Web Notification Engine
          </p>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            Push Notifications & Alert Rules
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Configure when LootRadar sends push notifications to your browser and device.
            Test live alert payloads below or filter alerts by storefront and platform.
          </p>
        </div>

        {/* Live Simulator Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onSimulateAlert('new_drop')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Test New Freebie Drop</span>
          </button>

          <button
            onClick={() => onSimulateAlert('expiring_soon')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 font-medium text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Test Expiring Alert</span>
          </button>

          <button
            onClick={() => onSimulateAlert('upcoming_unlock')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-400/15 hover:bg-emerald-400/25 border border-emerald-400/40 text-emerald-300 font-medium text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Test Next Week Unlock</span>
          </button>
        </div>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Trigger Channels */}
        <div className="lg:col-span-6 bg-[#111827] border border-slate-800/90 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-display font-semibold text-white">
                Push Notification Channels
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Browser permission status:{' '}
                <span className="font-mono text-slate-200 uppercase">
                  {permissionStatus}
                </span>
              </p>
            </div>

            {permissionStatus !== 'granted' ? (
              <button
                onClick={onRequestBrowserPermission}
                className="px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Grant Browser Permission
              </button>
            ) : (
              <button
                onClick={() =>
                  onUpdatePrefs({ browserPushEnabled: !prefs.browserPushEnabled })
                }
                className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  prefs.browserPushEnabled
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {prefs.browserPushEnabled ? 'Browser Push Active' : 'Browser Push Paused'}
              </button>
            )}
          </div>

          {/* Toggle Rows */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-100">
                  New Daily Giveaway Drops
                </div>
                <div className="text-xs text-slate-400">
                  Instant push notification the moment a 100% off game goes live
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdatePrefs({ notifyNewDrops: !prefs.notifyNewDrops })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  prefs.notifyNewDrops
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {prefs.notifyNewDrops ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-100">
                  Expiring Countdown Warnings
                </div>
                <div className="text-xs text-slate-400">
                  Urgent reminder before an unclaimed giveaway expires
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdatePrefs({ notifyExpiringSoon: !prefs.notifyExpiringSoon })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  prefs.notifyExpiringSoon
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {prefs.notifyExpiringSoon ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-100">
                  Upcoming Rotation Unlock Alerts
                </div>
                <div className="text-xs text-slate-400">
                  Alert when scheduled next-week Epic Games Store drops unlock
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdatePrefs({
                    notifyUpcomingUnlocks: !prefs.notifyUpcomingUnlocks,
                  })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  prefs.notifyUpcomingUnlocks
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {prefs.notifyUpcomingUnlocks ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-800/80">
              <div className="flex items-center gap-2.5">
                {prefs.soundChimeEnabled ? (
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                )}
                <div>
                  <div className="text-sm font-medium text-slate-100">
                    Radar Audio Chime
                  </div>
                  <div className="text-xs text-slate-400">
                    Play subtle two-tone acoustic ping when an alert arrives
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdatePrefs({ soundChimeEnabled: !prefs.soundChimeEnabled })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  prefs.soundChimeEnabled
                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {prefs.soundChimeEnabled ? 'Chime On' : 'Muted'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Store & Platform Scope Filters */}
        <div className="lg:col-span-6 bg-[#111827] border border-slate-800/90 rounded-xl p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-display font-semibold text-white">
                Store & Platform Alert Scope
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Only receive push notifications for the storefronts and hardware platforms
                you actually play on.
              </p>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-300 mb-2">
                Monitored Storefronts ({prefs.monitoredStores.length} of {ALL_STORES.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {ALL_STORES.map((store) => {
                  const active = prefs.monitoredStores.includes(store);
                  return (
                    <button
                      key={store}
                      type="button"
                      onClick={() => toggleMonitoredStore(store)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-cyan-400/15 border-cyan-500/50 text-cyan-200'
                          : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <StoreIcon store={store} className="w-3.5 h-3.5" />
                      <span>{STORE_META[store].name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-300 mb-2">
                Monitored Platforms ({prefs.monitoredPlatforms.length} of{' '}
                {ALL_PLATFORMS.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {ALL_PLATFORMS.map((plat) => {
                  const active = prefs.monitoredPlatforms.includes(plat);
                  return (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => toggleMonitoredPlatform(plat)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200'
                          : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <PlatformIcon platform={plat} className="w-3.5 h-3.5" />
                      <span>{PLATFORM_META[plat].label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Epic Games Thursday rotation check: Active (15:00 UTC)</span>
            <span className="font-mono tabular-nums text-emerald-400">Synced</span>
          </div>
        </div>
      </div>

      {/* Alert History Log */}
      <div className="bg-[#111827] border border-slate-800/90 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-display font-semibold text-white">
              Recent Push Notification Log
            </h2>
            <p className="text-xs text-slate-400">
              Archive of dispatched drop alerts, expiring countdown warnings, and upcoming
              unlock reminders
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
            <button
              onClick={onClearAlerts}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-500/40 text-xs font-medium text-slate-400 hover:text-rose-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Log</span>
            </button>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-300">
              No notifications in your log yet
            </p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Click any of the Test buttons above to dispatch a live push alert right now.
            </p>
            <button
              onClick={() => onSimulateAlert('new_drop')}
              className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
            >
              Dispatch Test Notification
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {alerts.map((alert) => {
              const typeLabel =
                alert.type === 'upcoming_unlock'
                  ? 'Upcoming Unlock'
                  : alert.type === 'expiring_soon'
                  ? 'Expiring Soon'
                  : 'New Freebie Drop';

              const typeColor =
                alert.type === 'upcoming_unlock'
                  ? 'text-emerald-400'
                  : alert.type === 'expiring_soon'
                  ? 'text-amber-400'
                  : 'text-cyan-400';

              return (
                <div
                  key={alert.id}
                  className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    alert.read ? 'bg-transparent' : 'bg-cyan-950/15'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`font-semibold ${typeColor}`}>{typeLabel}</span>
                      {alert.store && (
                        <>
                          <span aria-hidden="true" className="text-slate-600">
                            ·
                          </span>
                          <span className="text-slate-300">
                            {STORE_META[alert.store].name}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span className="font-mono tabular-nums text-slate-400">
                        {new Date(alert.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                      {!alert.read && (
                        <>
                          <span aria-hidden="true" className="text-slate-600">
                            ·
                          </span>
                          <span className="text-cyan-300 font-semibold">Unread</span>
                        </>
                      )}
                    </div>

                    <div className="text-sm font-semibold text-white">{alert.title}</div>
                    <p className="text-xs text-slate-300">{alert.message}</p>
                  </div>

                  {alert.gameId && (
                    <button
                      onClick={() => onSelectGameById(alert.gameId!)}
                      className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center cursor-pointer"
                    >
                      View Giveaway
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
