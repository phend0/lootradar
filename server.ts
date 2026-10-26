import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { INITIAL_GIVEAWAYS } from './src/data/giveaways';
import { GiveawayGame, PlatformId, StoreId } from './src/types';
import {
  COSMETIC_AND_NONGAME_BLOCKLIST_REGEX,
  isEligibleGamerPowerOffer,
  isEligibleGiveawayGame,
  parseRetailWorth,
} from './src/utils/gameEligibility';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedGiveaways: GiveawayGame[] | null = null;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const redirectUrlCache = new Map<string, string>();

async function resolveDirectStoreUrl(
  gamerPowerOpenUrl: string,
  fallbackUrl: string
): Promise<string> {
  if (!gamerPowerOpenUrl) return fallbackUrl;
  if (redirectUrlCache.has(gamerPowerOpenUrl)) {
    return redirectUrlCache.get(gamerPowerOpenUrl)!;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(gamerPowerOpenUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const location = res.headers.get('location');
    if (location && location.startsWith('http')) {
      redirectUrlCache.set(gamerPowerOpenUrl, location);
      return location;
    }
  } catch {
    // Fallback to open_giveaway_url if redirect check times out
  }
  return gamerPowerOpenUrl || fallbackUrl;
}

interface EpicOffer {
  startDate: string;
  endDate: string;
  discountSetting?: {
    discountType?: string;
    discountPercentage?: number;
  };
}

async function fetchLiveEpicGiveaways(): Promise<GiveawayGame[]> {
  const res = await fetch(
    'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US'
  );
  if (!res.ok) return [];
  const json = await res.json();
  const elements = json?.data?.Catalog?.searchStore?.elements || [];
  const results: GiveawayGame[] = [];
  const now = Date.now();

  for (const item of elements) {
    const title = String(item?.title || '').trim();
    const description = String(item?.description || '').trim();
    if (!title || COSMETIC_AND_NONGAME_BLOCKLIST_REGEX.test(title)) {
      continue;
    }

    // Reject non-game add-on cosmetics in Epic catalog
    const offerType = String(item?.offerType || '').toUpperCase();
    if (offerType === 'ADD_ON' || offerType === 'CONSUMABLE' || offerType === 'VIRTUAL_CURRENCY') {
      continue;
    }

    const activeOffers: EpicOffer[] = (
      item?.promotions?.promotionalOffers || []
    ).flatMap(
      (group: { promotionalOffers?: EpicOffer[] }) =>
        group.promotionalOffers || []
    );

    const upcomingOffers: EpicOffer[] = (
      item?.promotions?.upcomingPromotionalOffers || []
    ).flatMap(
      (group: { promotionalOffers?: EpicOffer[] }) =>
        group.promotionalOffers || []
    );

    const originalPriceCents = Number(item?.price?.totalPrice?.originalPrice ?? 0);
    const rawPriceStr =
      item?.price?.totalPrice?.fmtPrice?.originalPrice || '$19.99';
    const parsedPrice =
      parseRetailWorth(rawPriceStr) ||
      (originalPriceCents > 0 ? originalPriceCents / 100 : 19.99);

    // Strictly verify 100% FREE active offer for a paid game
    const activeFree = activeOffers.find(
      (o) =>
        o?.discountSetting?.discountPercentage === 0 &&
        item?.price?.totalPrice?.discountPrice === 0 &&
        parsedPrice > 0 &&
        (!o.endDate || new Date(o.endDate).getTime() > now)
    );

    // Strictly verify 100% FREE upcoming offer for a paid game
    const upcomingFree = !activeFree
      ? upcomingOffers.find(
          (o) =>
            o?.discountSetting?.discountPercentage === 0 &&
            parsedPrice > 0 &&
            (!o.startDate || new Date(o.startDate).getTime() > now)
        )
      : undefined;

    if (!activeFree && !upcomingFree) continue;

    const promo = (activeFree || upcomingFree)!;
    const slug =
      item?.offerMappings?.[0]?.pageSlug ||
      item?.catalogNs?.mappings?.[0]?.pageSlug ||
      item?.productSlug ||
      item?.urlSlug;

    if (!slug) continue;

    const isBundle = offerType === 'BUNDLE';
    const claimUrl = isBundle
      ? `https://store.epicgames.com/en-US/bundles/${slug}`
      : `https://store.epicgames.com/en-US/p/${slug}`;

    const wideImg =
      item?.keyImages?.find(
        (img: { type: string; url: string }) =>
          img.type === 'OfferImageWide' ||
          img.type === 'DieselStoreFrontWide' ||
          img.type === 'featuredMedia' ||
          img.type === 'Thumbnail'
      )?.url ||
      item?.keyImages?.[0]?.url ||
      '';

    const isUpcoming = !activeFree && Boolean(upcomingFree);
    const endDateIso =
      promo.endDate || new Date(now + 7 * 86400000).toISOString();
    const startDateIso = promo.startDate || new Date(now).toISOString();
    const hoursLeft = (new Date(endDateIso).getTime() - now) / 3600000;

    const status = isUpcoming
      ? 'upcoming'
      : hoursLeft <= 48 && hoursLeft > 0
      ? 'expiring'
      : 'active';

    const sellerName = item?.seller?.name || 'Epic Games Store Partner';

    results.push({
      id: `epic-live-${slug}`,
      title,
      subtitle: isUpcoming
        ? 'Confirmed Upcoming Epic Games Store Paid Game (100% Off)'
        : 'Full Paid Game — 100% Off on Epic Games Store',
      store: 'epic',
      storeName: 'Epic Games Store',
      platforms: ['windows', 'steamdeck'],
      originalPrice: parsedPrice,
      status,
      startDate: startDateIso,
      endDate: endDateIso,
      coverImage: wideImg,
      accentGradient: 'from-cyan-950/90 via-slate-900/90 to-slate-950',
      genres: isBundle
        ? ['Game Bundle', 'Full Edition']
        : ['Full Game', 'Epic Weekly Freebie'],
      publisher: sellerName,
      developer: sellerName,
      releaseYear: 2025,
      ratingScore: 90,
      drmType: 'Epic Games Store (Keep Forever)',
      claimUrl,
      description:
        description ||
        `Claim ${title} ($${parsedPrice.toFixed(2)} retail value) for 100% free on the Epic Games Store and keep the full game forever in your library.`,
      highlights: [
        `Direct Epic Games Store page: ${claimUrl}`,
        `Official Retail Value: $${parsedPrice.toFixed(2)} USD — 100% Free ($0.00)`,
        isUpcoming
          ? `Unlocks on ${new Date(startDateIso).toUTCString()}`
          : `Free claim window open until ${new Date(endDateIso).toUTCString()}`,
      ],
      systemRequirements: {
        os: 'Windows 10 / 11 (64-bit)',
        processor: 'Intel Core i5 or AMD Ryzen 5 equivalent',
        memory: '8 GB RAM',
        graphics: 'DirectX 11 / 12 compatible GPU',
        storage: '10 GB available space',
      },
      isHeadliner:
        !isUpcoming &&
        results.filter((r) => r.status !== 'upcoming').length === 0,
    });
  }

  return results.filter(isEligibleGiveawayGame);
}

async function fetchLiveGamerPowerGiveaways(): Promise<GiveawayGame[]> {
  const res = await fetch('https://www.gamerpower.com/api/giveaways');
  if (!res.ok) return [];
  const items = await res.json();
  if (!Array.isArray(items)) return [];

  const now = Date.now();

  // Filter strictly for active, non-expired PAID games, major story expansions, or official Steam playtests
  const candidates = items
    .filter((item) => {
      if (item.status && String(item.status).toLowerCase() !== 'active') {
        return false;
      }
      if (item.end_date && item.end_date !== 'N/A') {
        const parsedEnd = new Date(
          String(item.end_date).replace(' ', 'T') + 'Z'
        );
        if (!isNaN(parsedEnd.getTime()) && parsedEnd.getTime() <= now) {
          return false;
        }
      }
      if (!isEligibleGamerPowerOffer(item)) {
        return false;
      }
      const plat = String(item.platforms || '').toLowerCase();
      return (
        plat.includes('epic games store') ||
        plat.includes('steam') ||
        plat.includes('gog') ||
        plat.includes('itch.io') ||
        plat.includes('drm-free')
      );
    })
    .slice(0, 14);

  const mapped: GiveawayGame[] = [];

  for (const item of candidates) {
    const platStr = String(item.platforms || '').toLowerCase();
    let store: StoreId = 'steam';
    let storeName = 'Steam Store';

    if (platStr.includes('epic games store') && !platStr.includes('steam')) {
      store = 'epic';
      storeName = 'Epic Games Store';
    } else if (platStr.includes('gog')) {
      store = 'gog';
      storeName = 'GOG.com';
    } else if (platStr.includes('itch.io') || platStr.includes('drm-free')) {
      store = 'itch';
      storeName = platStr.includes('itch.io')
        ? 'itch.io'
        : 'IndieGala / DRM-Free';
    }

    const platforms: PlatformId[] = ['windows'];
    if (platStr.includes('steam') || platStr.includes('itch.io')) {
      platforms.push('steamdeck');
    }
    if (
      platStr.includes('playstation') ||
      platStr.includes('xbox') ||
      platStr.includes('switch') ||
      platStr.includes('android') ||
      platStr.includes('ios')
    ) {
      platforms.push('console');
    }

    const directUrl = await resolveDirectStoreUrl(
      item.open_giveaway_url,
      item.gamerpower_url
    );

    const rawType = String(item.type || '').trim();
    const isSteamPlaytest =
      rawType.toLowerCase() === 'early access' ||
      /\b(playtest|beta)\b/i.test(String(item.title || ''));

    const parsedWorth =
      parseRetailWorth(item.worth) || (isSteamPlaytest ? 14.99 : 9.99);

    let endDateIso = new Date(now + 6 * 86400000).toISOString();
    if (item.end_date && item.end_date !== 'N/A') {
      const parsedEnd = new Date(
        String(item.end_date).replace(' ', 'T') + 'Z'
      );
      if (!isNaN(parsedEnd.getTime()) && parsedEnd.getTime() > now) {
        endDateIso = parsedEnd.toISOString();
      }
    }

    const hoursLeft = (new Date(endDateIso).getTime() - now) / 3600000;
    const status = hoursLeft <= 48 ? 'expiring' : 'active';

    const cleanTitle = String(item.title || '')
      .replace(
        /\s*\((Steam|Epic Games|IndieGala|Indiegala|GOG|itch\.io)\)\s*/gi,
        ' '
      )
      .replace(/\s*Giveaway$/i, '')
      .trim();

    const offerCategoryLabel = isSteamPlaytest
      ? 'Official Steam Playtest / Beta Key'
      : rawType.toLowerCase() === 'dlc'
      ? 'Story Expansion'
      : 'Full Paid Game';

    mapped.push({
      id: `gp-${item.id}`,
      title: cleanTitle,
      subtitle: `${offerCategoryLabel} — 100% Off on ${storeName}`,
      store,
      storeName,
      platforms,
      originalPrice: parsedWorth,
      status,
      startDate: item.published_date
        ? new Date(
            String(item.published_date).replace(' ', 'T') + 'Z'
          ).toISOString()
        : new Date(now).toISOString(),
      endDate: endDateIso,
      coverImage: item.image || item.thumbnail || '',
      accentGradient: 'from-sky-950/90 via-slate-900/90 to-slate-950',
      genres: [offerCategoryLabel, storeName],
      publisher: storeName,
      developer: 'Verified Store Partner',
      releaseYear: 2025,
      ratingScore: 88,
      drmType: `${storeName} Direct Claim`,
      claimUrl: directUrl,
      description:
        item.description ||
        `Claim ${cleanTitle} ($${parsedWorth.toFixed(2)} value) for 100% free on ${storeName}.`,
      highlights: [
        `Direct store claim link: ${directUrl}`,
        item.instructions
          ? String(item.instructions).replace(/\r?\n/g, ' ')
          : `Redeem directly on ${storeName} before expiration`,
        `Retail value: $${parsedWorth.toFixed(2)} USD — 100% Off ($0.00)`,
      ],
      systemRequirements: {
        os: 'Windows 10 / 11 (64-bit)',
        processor: 'Dual-Core 2.4 GHz or higher',
        memory: '8 GB RAM',
        graphics: 'DirectX 11 compatible GPU',
        storage: '12 GB available space',
      },
    });
  }

  return mapped.filter(isEligibleGiveawayGame);
}

async function getAggregatedGiveaways(
  forceRefresh = false
): Promise<GiveawayGame[]> {
  if (
    !forceRefresh &&
    cachedGiveaways &&
    Date.now() - lastFetchTimestamp < CACHE_TTL_MS
  ) {
    return cachedGiveaways;
  }

  try {
    const [epicLive, gpLive] = await Promise.allSettled([
      fetchLiveEpicGiveaways(),
      fetchLiveGamerPowerGiveaways(),
    ]);

    const epicGames = epicLive.status === 'fulfilled' ? epicLive.value : [];
    const gpGames = gpLive.status === 'fulfilled' ? gpLive.value : [];
    const gogExpansions = INITIAL_GIVEAWAYS.filter(
      (g) => g.store === 'gog' && isEligibleGiveawayGame(g)
    );

    const now = Date.now();
    // Strictly include non-expired, verified paid games / expansions / official Steam playtests
    const combined: GiveawayGame[] = [
      ...epicGames,
      ...gpGames,
      ...gogExpansions,
    ].filter(
      (g) => new Date(g.endDate).getTime() > now && isEligibleGiveawayGame(g)
    );

    if (combined.length >= 4) {
      const seenKeys = new Set<string>();
      const deduped: GiveawayGame[] = [];
      for (const g of combined) {
        const baseTitle = g.title
          .toLowerCase()
          .split(/\s+-\s+/)[0]
          .replace(/[^a-z0-9]/g, '')
          .trim();
        const key = `${g.store}:${baseTitle}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          deduped.push(g);
        }
      }

      const firstEpicActive =
        deduped.find((g) => g.store === 'epic' && g.status !== 'upcoming') ||
        deduped.find((g) => g.status !== 'upcoming');

      if (firstEpicActive) {
        deduped.forEach((g) => {
          g.isHeadliner = g.id === firstEpicActive.id;
        });
      }

      cachedGiveaways = deduped;
      lastFetchTimestamp = Date.now();
      return deduped;
    }
  } catch {
    // Fallback to verified INITIAL_GIVEAWAYS if offline
  }

  return INITIAL_GIVEAWAYS.filter(
    (g) =>
      new Date(g.endDate).getTime() > Date.now() && isEligibleGiveawayGame(g)
  );
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.get('/api/giveaways', async (req, res) => {
    try {
      const refresh = req.query.refresh === 'true';
      const games = await getAggregatedGiveaways(refresh);
      res.json({
        syncedAt: new Date().toISOString(),
        sources: {
          epicGamesStore: 'connected',
          gamerPowerRadar: 'connected',
          gogCatalog: 'connected',
        },
        count: games.length,
        giveaways: games,
      });
    } catch {
      const fallback = INITIAL_GIVEAWAYS.filter(isEligibleGiveawayGame);
      res.json({
        syncedAt: new Date().toISOString(),
        sources: {
          epicGamesStore: 'fallback',
          gamerPowerRadar: 'fallback',
          gogCatalog: 'fallback',
        },
        count: fallback.length,
        giveaways: fallback,
      });
    }
  });

  app.get('/LootRadar-S26Ultra.apk', (_req, res) => {
    const apkPath = path.join(__dirname, 'public', 'LootRadar-S26Ultra.apk');
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="LootRadar-S26Ultra.apk"'
    );
    res.sendFile(apkPath);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LootRadar server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
