import React from 'react';
import {
  X,
  ExternalLink,
  Check,
  Clock,
  ShieldCheck,
  Cpu,
  HardDrive,
  Monitor,
  BellRing,
  Link2,
} from 'lucide-react';
import { GiveawayGame } from '../types';
import { PLATFORM_META, STORE_META } from '../data/giveaways';
import { formatCountdown } from '../utils/notifications';
import { GameCoverArt } from './GameCoverArt';
import {
  PlatformIcon,
  PlatformIconList,
  StoreIcon,
} from './PlatformIcons';

interface GameDetailModalProps {
  game: GiveawayGame | null;
  nowMs: number;
  isClaimed: boolean;
  onClose: () => void;
  onToggleClaimed: (gameId: string) => void;
  onTriggerTestAlert: (game: GiveawayGame) => void;
}

export const GameDetailModal: React.FC<GameDetailModalProps> = ({
  game,
  nowMs,
  isClaimed,
  onClose,
  onToggleClaimed,
  onTriggerTestAlert,
}) => {
  if (!game) return null;

  const targetIso = game.status === 'upcoming' ? game.startDate : game.endDate;
  const countdown = formatCountdown(targetIso, nowMs);
  const storeMeta = STORE_META[game.store];
  const platformLabels = game.platforms.map((p) => PLATFORM_META[p].shortLabel).join(', ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-game-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#111827] border border-slate-800 rounded-2xl shadow-2xl text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Cover Banner */}
        <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-slate-950">
          <GameCoverArt
            src={game.coverImage}
            alt={game.title}
            accentGradient={game.accentGradient}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#111827]/45 to-black/30" />

          <button
            onClick={onClose}
            aria-label="Close details"
            className="absolute top-4 right-4 p-2.5 rounded-lg bg-slate-950/80 text-slate-300 hover:text-white hover:bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 mb-1.5">
                <span
                  className={`inline-flex items-center gap-1.5 font-semibold ${storeMeta.colorClass}`}
                >
                  <StoreIcon store={game.store} className="w-3.5 h-3.5" />
                  <span>{storeMeta.name}</span>
                </span>
                <span aria-hidden="true">·</span>
                <PlatformIconList platforms={game.platforms} />
                <span aria-hidden="true">·</span>
                <span>{game.releaseYear}</span>
                {game.ratingScore !== undefined && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-emerald-400">
                      Metacritic {game.ratingScore}
                    </span>
                  </>
                )}
              </div>
              <h2
                id="modal-game-title"
                className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white"
              >
                {game.title}
              </h2>
              <p className="text-sm text-slate-300 mt-0.5">{game.subtitle}</p>
            </div>

            <div className="flex items-baseline gap-2.5 shrink-0 bg-slate-950/85 border border-slate-800 px-3.5 py-2 rounded-lg">
              <span className="text-xs text-slate-400 line-through font-mono tabular-nums">
                ${game.originalPrice.toFixed(2)}
              </span>
              <span className="text-lg font-mono font-bold tabular-nums text-emerald-400">
                FREE (100% Off)
              </span>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6">
          {/* Countdown & Primary Actions Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <Clock
                className={`w-5 h-5 shrink-0 ${
                  game.status === 'upcoming'
                    ? 'text-cyan-400'
                    : countdown.isUrgent
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              />
              <div>
                <div className="text-xs text-slate-400">
                  {game.status === 'upcoming'
                    ? 'Giveaway Unlocks In'
                    : countdown.totalHours === Infinity
                    ? 'Claim Window'
                    : countdown.isUrgent
                    ? 'Urgent — Giveaway Ends In'
                    : 'Claim Window Remaining'}
                </div>
                <div
                  className={`text-base font-mono font-semibold tabular-nums ${
                    game.status === 'upcoming'
                      ? 'text-cyan-300'
                      : countdown.isUrgent
                      ? 'text-amber-300'
                      : 'text-slate-100'
                  }`}
                >
                  {countdown.formatted}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={game.claimUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (!isClaimed && game.status !== 'upcoming') {
                    onToggleClaimed(game.id);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs transition-colors whitespace-nowrap shrink-0"
              >
                <StoreIcon store={game.store} className="w-3.5 h-3.5" />
                <span>
                  {game.status === 'upcoming'
                    ? `View on ${storeMeta.shortName}`
                    : isClaimed
                    ? `Claimed on ${storeMeta.shortName}`
                    : `Claim on ${storeMeta.shortName}`}
                </span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {game.status !== 'upcoming' && (
                <button
                  onClick={() => onToggleClaimed(game.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isClaimed
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/25'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isClaimed ? 'Claimed in Library' : 'Mark as Claimed'}</span>
                </button>
              )}

              <button
                onClick={() => onTriggerTestAlert(game)}
                title="Send push notification for this title"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Send Push Alert</span>
              </button>
            </div>
          </div>

          {/* Verified Direct Store Link Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-lg bg-slate-950 border border-slate-800/90 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Link2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-slate-400 shrink-0">Verified Store URL:</span>
              <a
                href={game.claimUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-cyan-300 hover:text-cyan-200 underline truncate"
              >
                {game.claimUrl}
              </a>
            </div>
            <a
              href={game.claimUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1"
            >
              <span>Open Store Page</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Overview & Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-2">
                  About This Giveaway
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">{game.description}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-2">
                  Edition Highlights
                </h3>
                <ul className="space-y-2">
                  {game.highlights.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-sm text-slate-300 break-words"
                    >
                      <span className="text-cyan-400 font-mono mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Metadata Summary Column */}
            <div className="space-y-3 text-xs border-t md:border-t-0 md:border-l border-slate-800/80 pt-4 md:pt-0 md:pl-6">
              <div>
                <div className="text-slate-400 mb-0.5">DRM & Activation</div>
                <div className="text-slate-200 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{game.drmType}</span>
                </div>
              </div>

              <div>
                <div className="text-slate-400 mb-0.5">Developer / Publisher</div>
                <div className="text-slate-200 font-medium">
                  {game.developer} · {game.publisher}
                </div>
              </div>

              <div>
                <div className="text-slate-400 mb-0.5">Genres</div>
                <div className="text-slate-200">{game.genres.join(' · ')}</div>
              </div>

              <div>
                <div className="text-slate-400 mb-1">Supported Platforms</div>
                <div className="flex flex-wrap items-center gap-2.5 text-slate-200">
                  {game.platforms.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1.5 font-medium"
                    >
                      <PlatformIcon platform={p} className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{PLATFORM_META[p].label}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-slate-400 mb-0.5">Retail Value Saved</div>
                <div className="text-emerald-400 font-mono font-semibold tabular-nums text-sm">
                  ${game.originalPrice.toFixed(2)} USD
                </div>
              </div>
            </div>
          </div>

          {/* System Requirements */}
          {game.systemRequirements ? (
          <div className="pt-5 border-t border-slate-800/80">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              Minimum System Requirements (from Steam)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1">
                <div className="text-slate-400 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-slate-500" />
                  <span>Operating System</span>
                </div>
                <div className="text-slate-200 font-medium">
                  {game.systemRequirements.os}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-slate-500" />
                  <span>Processor & Memory</span>
                </div>
                <div className="text-slate-200 font-medium">
                  {game.systemRequirements.processor} ({game.systemRequirements.memory})
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-400 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-slate-500" />
                  <span>Graphics</span>
                </div>
                <div className="text-slate-200 font-medium">
                  {game.systemRequirements.graphics}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-400 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                  <span>Storage</span>
                </div>
                <div className="text-slate-200 font-medium">
                  {game.systemRequirements.storage}
                </div>
              </div>
            </div>
          </div>
          ) : (
            <p className="pt-5 border-t border-slate-800/80 text-xs text-slate-400">
              System requirements aren't available here. Check the store page before
              installing.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
