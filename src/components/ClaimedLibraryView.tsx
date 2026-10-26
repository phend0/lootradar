import React, { useState } from 'react';
import {
  Check,
  ExternalLink,
  RotateCcw,
  Search,
  Trophy,
  Download,
} from 'lucide-react';
import { GiveawayGame, PlatformId, StoreId } from '../types';
import { PLATFORM_META, STORE_META } from '../data/giveaways';
import { GameCoverArt } from './GameCoverArt';
import {
  PlatformIcon,
  PlatformIconList,
  StoreIcon,
} from './PlatformIcons';

interface ClaimedLibraryViewProps {
  giveaways: GiveawayGame[];
  claimedIds: string[];
  onToggleClaimed: (gameId: string) => void;
  onSelectGame: (game: GiveawayGame) => void;
  onExploreRadar: () => void;
}

const ALL_STORES: StoreId[] = ['epic', 'steam', 'gog', 'prime', 'itch'];

export const ClaimedLibraryView: React.FC<ClaimedLibraryViewProps> = ({
  giveaways,
  claimedIds,
  onToggleClaimed,
  onSelectGame,
  onExploreRadar,
}) => {
  const [selectedStore, setSelectedStore] = useState<StoreId | 'all'>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const claimedGames = giveaways.filter((g) => claimedIds.includes(g.id));

  const filteredClaimed = claimedGames.filter((g) => {
    if (selectedStore !== 'all' && g.store !== selectedStore) return false;
    if (selectedPlatform !== 'all' && !g.platforms.includes(selectedPlatform))
      return false;
    if (
      searchQuery.trim() &&
      !g.title.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const totalSaved = claimedGames.reduce((sum, g) => sum + g.originalPrice, 0);

  const exportLibraryJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      totalClaimedCount: claimedGames.length,
      totalRetailValueSaved: Number(totalSaved.toFixed(2)),
      games: claimedGames.map((g) => ({
        id: g.id,
        title: g.title,
        store: g.storeName,
        originalPrice: g.originalPrice,
        drmType: g.drmType,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lootradar-claimed-library.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header & Cumulative Savings */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div>
          <p className="text-xs font-medium text-emerald-400 mb-1">
            Personal Freebie Vault · Lifetime Value Tracker
          </p>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            Claimed Games & Savings Ledger
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Track every 100% off giveaway you have redeemed across Epic Games Store,
            Steam, GOG, Prime Gaming, and itch.io in one unified cross-launcher record.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-xs text-slate-400">Games Claimed</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-white">
              {claimedGames.length}
            </div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <div className="text-xs text-slate-400">Total Retail Value Saved</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-emerald-400">
              ${totalSaved.toFixed(2)}
            </div>
          </div>
          {claimedGames.length > 0 && (
            <button
              onClick={exportLibraryJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#111827] border border-slate-800 rounded-lg overflow-x-auto">
            <button
              onClick={() => setSelectedStore('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedStore === 'all'
                  ? 'bg-cyan-400 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Stores
            </button>
            {ALL_STORES.map((store) => (
              <button
                key={store}
                onClick={() => setSelectedStore(store)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedStore === store
                    ? 'bg-cyan-400 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <StoreIcon store={store} className="w-3.5 h-3.5" />
                <span>{STORE_META[store].shortName}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#111827] border border-slate-800 rounded-lg overflow-x-auto">
            {(['all', 'windows', 'mac', 'linux', 'steamdeck', 'console'] as const).map(
              (plat) => (
                <button
                  key={plat}
                  onClick={() => setSelectedPlatform(plat)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedPlatform === plat
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
              )
            )}
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search claimed games..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#111827] border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* Content */}
      {claimedGames.length === 0 ? (
        <div className="bg-[#111827] border border-slate-800/90 rounded-xl p-12 text-center">
          <Trophy className="w-9 h-9 text-emerald-400/70 mx-auto mb-3" />
          <h2 className="text-base font-display font-semibold text-white mb-1">
            Your Claimed Freebie Vault is Empty
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
            Mark any active giveaway as claimed after redeeming it on Epic Games, Steam,
            GOG, Prime Gaming, or itch.io to track your total money saved.
          </p>
          <button
            onClick={onExploreRadar}
            className="px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
          >
            Browse Active Freebies
          </button>
        </div>
      ) : filteredClaimed.length === 0 ? (
        <div className="bg-[#111827] border border-slate-800/90 rounded-xl p-10 text-center">
          <p className="text-sm text-slate-300 mb-3">
            No claimed games match your current store or platform filter.
          </p>
          <button
            onClick={() => {
              setSelectedStore('all');
              setSelectedPlatform('all');
              setSearchQuery('');
            }}
            className="px-3.5 py-2 rounded-lg bg-slate-800 text-xs font-medium text-slate-200 cursor-pointer"
          >
            Reset Filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClaimed.map((game) => {
            const storeMeta = STORE_META[game.store];
            return (
              <article
                key={game.id}
                className="bg-[#111827] border border-slate-800/90 rounded-xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div
                    onClick={() => onSelectGame(game)}
                    className="relative h-44 w-full overflow-hidden bg-slate-950 cursor-pointer group"
                  >
                    <GameCoverArt
                      src={game.coverImage}
                      alt={game.title}
                      accentGradient={game.accentGradient}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-transparent to-black/30" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-400 inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Claimed in Library
                      </span>
                      <span className="font-mono font-bold tabular-nums text-white bg-slate-950/85 px-2.5 py-1 rounded">
                        Saved ${game.originalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 mb-1">
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
                    </div>
                    <h3
                      onClick={() => onSelectGame(game)}
                      className="text-lg font-display font-bold text-white hover:text-cyan-300 transition-colors cursor-pointer"
                    >
                      {game.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {game.drmType}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-3 border-t border-slate-800/70 flex items-center justify-between gap-2">
                  <a
                    href={game.claimUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 whitespace-nowrap shrink-0"
                  >
                    <StoreIcon store={game.store} className="w-3.5 h-3.5" />
                    <span>Open {storeMeta.shortName}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={() => onToggleClaimed(game.id)}
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Unmark Claimed</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
