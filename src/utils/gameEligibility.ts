import { GiveawayGame } from '../types';

export const COSMETIC_AND_NONGAME_BLOCKLIST_REGEX =
  /\b(skin|skins|outfit|outfits|costume|costumes|armor|armour|camo|camouflage|weapon\s*pack|weapons\s*pack|weapon\s*skins|starter\s*pack|gift\s*pack|gift\s*packs|welcome\s*bikes|welcome\s*pack|colour\s*picker|color\s*picker|syandana|signature\s*pack|aw-51\s*pack|game\s*pack|coupon\s*code|currency|coins|tokens|loot\s*box|avatar|avatars|sticker|stickers|emote|emotes|soundtrack|ost|wallpaper|wallpapers|artbook|booster\s*pack|gamerpower\s*mobile\s*app)\b/i;

const STORY_EXPANSION_ALLOWLIST_REGEX =
  /\b(expansion|story\s*expansion|campaign\s*expansion|full\s*expansion)\b/i;

export function parseRetailWorth(worthRaw: unknown): number {
  if (typeof worthRaw === 'number') {
    return Number.isFinite(worthRaw) && worthRaw > 0 ? worthRaw : 0;
  }
  const str = String(worthRaw || '').trim();
  if (!str || str.toUpperCase() === 'N/A') return 0;
  const cleaned = str.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function isEligibleGamerPowerOffer(item: {
  title?: string;
  description?: string;
  type?: string;
  worth?: string;
  platforms?: string;
}): boolean {
  const title = String(item.title || '').trim();
  const description = String(item.description || '').trim();
  const rawType = String(item.type || '').trim().toLowerCase();
  const platforms = String(item.platforms || '').trim().toLowerCase();

  if (!title) return false;

  // 1. Strictly block all skins, outfits, armor sets, weapon packs, starter packs, coupons, and cosmetics
  if (
    COSMETIC_AND_NONGAME_BLOCKLIST_REGEX.test(title) ||
    COSMETIC_AND_NONGAME_BLOCKLIST_REGEX.test(description)
  ) {
    return false;
  }

  const worth = parseRetailWorth(item.worth);

  // 2. Full Paid Games: must be type "game" and have a positive retail price (> $0.00)
  if (rawType === 'game') {
    return worth > 0;
  }

  // 3. DLC: only allow major paid story expansions (never generic packs/skins/unlocks)
  if (rawType === 'dlc') {
    return (
      worth > 0 &&
      (STORY_EXPANSION_ALLOWLIST_REGEX.test(title) ||
        STORY_EXPANSION_ALLOWLIST_REGEX.test(description))
    );
  }

  // 4. Official Steam Playtests & Beta Keys
  if (rawType === 'early access' || rawType === 'beta') {
    const isSteam = platforms.includes('steam') || /\bsteam\b/i.test(title);
    const isPlaytestOrBeta = /\b(playtest|beta)\b/i.test(title);
    return isSteam && isPlaytestOrBeta;
  }

  return false;
}

/** Drops ended giveaways and recomputes status, since feeds only set it at fetch time. */
export function withCurrentStatus(
  games: GiveawayGame[],
  nowMs: number
): GiveawayGame[] {
  return games
    .filter((game) => new Date(game.endDate).getTime() > nowMs)
    .map((game) => {
      const hoursLeft = (new Date(game.endDate).getTime() - nowMs) / 3600000;
      const status: GiveawayGame['status'] =
        new Date(game.startDate).getTime() > nowMs
          ? 'upcoming'
          : hoursLeft <= 48
          ? 'expiring'
          : 'active';
      return status === game.status ? game : { ...game, status };
    });
}

export function isEligibleGiveawayGame(game: GiveawayGame): boolean {
  if (!game || !game.title) return false;
  if (
    COSMETIC_AND_NONGAME_BLOCKLIST_REGEX.test(game.title) ||
    COSMETIC_AND_NONGAME_BLOCKLIST_REGEX.test(game.subtitle || '')
  ) {
    return false;
  }
  if (!Number.isFinite(game.originalPrice) || game.originalPrice <= 0) {
    return false;
  }
  return true;
}
