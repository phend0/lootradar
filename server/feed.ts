import { INITIAL_GIVEAWAYS } from '../src/data/giveaways';
import { GiveawayGame, PlatformId, StoreId } from '../src/types';
import {
  OPEN_ENDED_DATE,
  COSMETIC_AND_NONGAME_BLOCKLIST_REGEX,
  isEligibleGamerPowerOffer,
  isEligibleGiveawayGame,
  parseRetailWorth,
  withCurrentStatus,
} from '../src/utils/gameEligibility';
import { enrichWithSteamMetadata } from './steamMetadata';

let cachedGiveaways: GiveawayGame[] | null = null;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const redirectUrlCache = new Map<string, string>();

type SourceState = 'connected' | 'unavailable' | 'static';
let sourceStatus: Record<
  'epicGamesStore' | 'amazonLuna' | 'gamerPowerRadar' | 'gogCatalog',
  SourceState
> = {
  epicGamesStore: 'unavailable',
  amazonLuna: 'unavailable',
  gamerPowerRadar: 'unavailable',
  gogCatalog: 'static',
};

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
    const rawPriceStr = item?.price?.totalPrice?.fmtPrice?.originalPrice;
    // A zero price means free-to-play, which is not a giveaway.
    const parsedPrice =
      parseRetailWorth(rawPriceStr) ||
      (originalPriceCents > 0 ? originalPriceCents / 100 : 0);

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
      isHeadliner:
        !isUpcoming &&
        results.filter((r) => r.status !== 'upcoming').length === 0,
    });
  }

  return results.filter(isEligibleGiveawayGame);
}

async function fetchLiveAmazonLunaGiveaways(): Promise<GiveawayGame[]> {
  try {
    const pageRes = await fetch('https://luna.amazon.com/claims', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
    });
    if (!pageRes.ok) return [];
    const html = await pageRes.text();
    const cookies =
      typeof pageRes.headers.getSetCookie === 'function'
        ? pageRes.headers
            .getSetCookie()
            .map((c) => c.split(';')[0])
            .join('; ')
        : '';
    const csrfMatch = html.match(/name=['"]csrf-key['"]\s+value=['"]([^'"]+)/);
    const csrfToken = csrfMatch?.[1];
    if (!csrfToken) return [];

    const gqlRes = await fetch('https://luna.amazon.com/graphql', {
      method: 'POST',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'csrf-token': csrfToken,
        Cookie: cookies,
        Origin: 'https://luna.amazon.com',
        Referer: 'https://luna.amazon.com/claims/home',
      },
      body: JSON.stringify({
        query: `query {
          games: items(collectionType: FREE_GAMES, pageSize: 30) {
            items {
              id
              isFGWP
              category
              assets {
                id
                title
                shortformDescription
                externalClaimLink
                cardMedia {
                  defaultMedia {
                    src1x
                    src2x
                  }
                }
              }
              offers {
                id
                startTime
                endTime
              }
              game {
                id
                assets {
                  title
                }
              }
            }
          }
        }`,
      }),
    });

    if (!gqlRes.ok) return [];
    const gqlJson = await gqlRes.json();
    const rawItems = gqlJson?.data?.games?.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) return [];

    const now = Date.now();
    const knownRetailPrices: Record<string, number> = {
      'high on life': 39.99,
      'ad infinitum': 34.99,
      'caravan sandwitch': 24.99,
      'vampire: the masquerade - swansong': 49.99,
      "five nights at freddy's: into the pit": 19.99,
      doom: 19.99,
      'zoria: age of shattering': 24.99,
      conarium: 19.99,
      havendock: 19.99,
      hue: 14.99,
      weakless: 19.99,
      warbreeds: 9.99,
      'time travel: escape room game': 9.99,
      'the da vinci cryptex': 9.99,
    };

    const results: GiveawayGame[] = [];

    for (const item of rawItems) {
      if (item?.category && item.category !== 'FULL_GAME') continue;
      const title = String(
        item?.assets?.title || item?.game?.assets?.title || ''
      ).trim();
      if (!title || COSMETIC_AND_NONGAME_BLOCKLIST_REGEX.test(title)) continue;

      const offer = item?.offers?.[0];
      const startDateIso = offer?.startTime || new Date(now).toISOString();
      const endDateIso =
        offer?.endTime || new Date(now + 14 * 86400000).toISOString();

      if (new Date(endDateIso).getTime() <= now) continue;

      const rawLink = String(item?.assets?.externalClaimLink || '');
      const claimUrl = rawLink
        ? rawLink.replace(
            /^https?:\/\/gaming\.amazon\.com/,
            'https://luna.amazon.com/claims'
          )
        : 'https://luna.amazon.com/claims/home';

      let drmLabel = 'Amazon Games App / Luna Direct Claim (Keep Forever)';
      let badgeTag = 'Amazon Luna Freebie';
      if (/-epic\/dp\//i.test(rawLink)) {
        drmLabel = 'Amazon Luna Claim → Epic Games Store (Keep Forever)';
        badgeTag = 'Epic Redemption';
      } else if (/-gog\/dp\//i.test(rawLink)) {
        drmLabel = 'Amazon Luna Claim → 100% DRM-Free GOG.com Code';
        badgeTag = 'DRM-Free GOG Key';
      } else if (/-legacy\/dp\//i.test(rawLink)) {
        drmLabel = 'Amazon Luna Claim → Legacy Games Key (Keep Forever)';
        badgeTag = 'Legacy Games Key';
      }

      const price =
        knownRetailPrices[title.toLowerCase()] || 19.99;

      const hoursLeft = (new Date(endDateIso).getTime() - now) / 3600000;
      const status =
        new Date(startDateIso).getTime() > now
          ? 'upcoming'
          : hoursLeft <= 48
          ? 'expiring'
          : 'active';

      const coverImg =
        item?.assets?.cardMedia?.defaultMedia?.src2x ||
        item?.assets?.cardMedia?.defaultMedia?.src1x ||
        '';

      const shortId = String(item?.id || title)
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .slice(-36);

      results.push({
        id: `luna-${shortId}`,
        title,
        subtitle: `Full Paid Game — 100% Off on Amazon Games (Luna)`,
        store: 'prime',
        storeName: 'Amazon Games (Luna)',
        platforms: ['windows', 'steamdeck'],
        originalPrice: price,
        status,
        startDate: startDateIso,
        endDate: endDateIso,
        coverImage: coverImg,
        accentGradient: 'from-teal-950/90 via-slate-900/90 to-slate-950',
        genres: ['Full Game', badgeTag, 'Amazon Luna'],
        publisher: 'Amazon Games (Luna)',
        developer: 'Verified Partner Studio',
        releaseYear: 2024,
        drmType: drmLabel,
        claimUrl,
        description:
          item?.assets?.shortformDescription ||
          `Claim ${title} ($${price.toFixed(2)} retail value) for free with Prime on Amazon Games (luna.amazon.com) and keep it forever.`,
        highlights: [
          `Direct Amazon Luna claim page: ${claimUrl}`,
          `Official Retail Value: $${price.toFixed(2)} USD — 100% Free on luna.amazon.com`,
          `Redemption: ${drmLabel}`,
        ],
      });
    }

    return results.filter(isEligibleGiveawayGame);
  } catch {
    return [];
  }
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
      const titleLower = String(item.title || '').toLowerCase();
      return (
        plat.includes('epic games store') ||
        plat.includes('steam') ||
        plat.includes('gog') ||
        plat.includes('itch.io') ||
        plat.includes('drm-free') ||
        plat.includes('prime') ||
        plat.includes('amazon') ||
        plat.includes('luna') ||
        titleLower.includes('prime gaming') ||
        titleLower.includes('amazon')
      );
    });

  const directUrls = await Promise.all(
    candidates.map((item) =>
      resolveDirectStoreUrl(item.open_giveaway_url, item.gamerpower_url)
    )
  );

  const mapped: GiveawayGame[] = [];

  for (const [index, item] of candidates.entries()) {
    const platStr = String(item.platforms || '').toLowerCase();
    const titleLower = String(item.title || '').toLowerCase();
    let store: StoreId = 'steam';
    let storeName = 'Steam Store';

    if (
      platStr.includes('prime') ||
      platStr.includes('amazon') ||
      platStr.includes('luna') ||
      titleLower.includes('prime gaming') ||
      titleLower.includes('amazon')
    ) {
      store = 'prime';
      storeName = 'Amazon Games (Luna)';
    } else if (platStr.includes('epic games store') && !platStr.includes('steam')) {
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

    const directUrl = directUrls[index];

    const rawType = String(item.type || '').trim();
    const isSteamPlaytest =
      rawType.toLowerCase() === 'early access' ||
      /\b(playtest|beta)\b/i.test(String(item.title || ''));

    const parsedWorth =
      parseRetailWorth(item.worth) || (isSteamPlaytest ? 14.99 : 9.99);

    let endDateIso = OPEN_ENDED_DATE;
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
        /\s*\((Steam|Epic Games|IndieGala|Indiegala|GOG|itch\.io|Prime Gaming|Amazon|Luna)\)\s*/gi,
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
    });
  }

  return mapped.filter(isEligibleGiveawayGame);
}

export async function getAggregatedGiveaways(
  forceRefresh = false
): Promise<GiveawayGame[]> {
  if (
    !forceRefresh &&
    cachedGiveaways &&
    Date.now() - lastFetchTimestamp < CACHE_TTL_MS
  ) {
    return withCurrentStatus(cachedGiveaways, Date.now());
  }

  try {
    const [epicLive, lunaLive, gpLive] = await Promise.allSettled([
      fetchLiveEpicGiveaways(),
      fetchLiveAmazonLunaGiveaways(),
      fetchLiveGamerPowerGiveaways(),
    ]);

    const epicGames = epicLive.status === 'fulfilled' ? epicLive.value : [];
    const lunaGames =
      lunaLive.status === 'fulfilled' && lunaLive.value.length > 0
        ? lunaLive.value
        : INITIAL_GIVEAWAYS.filter(
            (g) => g.store === 'prime' && isEligibleGiveawayGame(g)
          );
    const gpGames = gpLive.status === 'fulfilled' ? gpLive.value : [];
    const gogExpansions = INITIAL_GIVEAWAYS.filter(
      (g) => g.store === 'gog' && isEligibleGiveawayGame(g)
    );

    const stateOf = (result: PromiseSettledResult<GiveawayGame[]>): SourceState =>
      result.status === 'fulfilled' && result.value.length > 0
        ? 'connected'
        : 'unavailable';
    sourceStatus = {
      epicGamesStore: stateOf(epicLive),
      amazonLuna: stateOf(lunaLive),
      gamerPowerRadar: stateOf(gpLive),
      gogCatalog: 'static',
    };

    const now = Date.now();
    // Strictly include non-expired, verified paid games / expansions / official Steam playtests
    const combined: GiveawayGame[] = [
      ...epicGames,
      ...lunaGames,
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

      const enriched = await enrichWithSteamMetadata(deduped);
      cachedGiveaways = enriched;
      lastFetchTimestamp = Date.now();
      return enriched;
    }
  } catch {
    // Fallback to verified INITIAL_GIVEAWAYS if offline
  }

  // Last good live result beats the static catalog during an upstream outage.
  if (cachedGiveaways) {
    const lastGood = withCurrentStatus(cachedGiveaways, Date.now());
    if (lastGood.length > 0) return lastGood;
  }

  return withCurrentStatus(
    INITIAL_GIVEAWAYS.filter(isEligibleGiveawayGame),
    Date.now()
  );
}

export function getSourceStatus() {
  return sourceStatus;
}
