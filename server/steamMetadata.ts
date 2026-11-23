import { GiveawayGame, SystemRequirements } from '../src/types';

const REQUEST_TIMEOUT_MS = 8000;
const MAX_CONCURRENT_LOOKUPS = 4;

interface SteamMetadata {
  ratingScore?: number;
  systemRequirements?: SystemRequirements;
}

const metadataByTitle = new Map<string, SteamMetadata>();

const normalizeTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]/g, '');

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Steam request failed: ${res.status}`);
  return res.json();
}

function parseRequirement(html: string, labels: string): string | undefined {
  const match = html.match(
    new RegExp(`<strong>\\s*(?:${labels})[^<]*:?\\s*</strong>(.*?)(?:<br|</li>|$)`, 'is')
  );
  const value = match?.[1]
    ?.replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return value || undefined;
}

function parseRequirements(html: unknown): SystemRequirements | undefined {
  if (typeof html !== 'string' || !html) return undefined;
  const os = parseRequirement(html, 'OS');
  const processor = parseRequirement(html, 'Processor');
  const memory = parseRequirement(html, 'Memory');
  const graphics = parseRequirement(html, 'Graphics|Video Card');
  const storage = parseRequirement(html, 'Storage|Hard Drive|Hard Disk Space');
  if (!os && !processor && !memory && !graphics && !storage) return undefined;
  const notListed = 'Not listed';
  return {
    os: os || notListed,
    processor: processor || notListed,
    memory: memory || notListed,
    graphics: graphics || notListed,
    storage: storage || notListed,
  };
}

async function lookupSteamMetadata(title: string): Promise<SteamMetadata> {
  const search = await fetchJson(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
      title
    )}&l=english&cc=US`
  );
  // Exact titles only: showing another game's rating is worse than showing none.
  const wanted = normalizeTitle(title);
  const match = (search?.items || []).find(
    (item: { name?: string; type?: string }) =>
      item.type === 'app' && normalizeTitle(String(item.name || '')) === wanted
  );
  if (!match?.id) return {};

  const details = await fetchJson(
    `https://store.steampowered.com/api/appdetails?appids=${match.id}&l=english`
  );
  const app = details?.[match.id];
  if (!app?.success) return {};

  const metadata: SteamMetadata = {
    systemRequirements: parseRequirements(app.data?.pc_requirements?.minimum),
  };
  const metacritic = Number(app.data?.metacritic?.score);
  if (metacritic > 0) metadata.ratingScore = metacritic;
  return metadata;
}

/** Adds Metacritic scores and requirements from Steam. Unmatched games keep neither. */
export async function enrichWithSteamMetadata(
  games: GiveawayGame[]
): Promise<GiveawayGame[]> {
  const enriched = [...games];
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < games.length) {
      const index = nextIndex++;
      const game = games[index];
      const key = normalizeTitle(game.title);
      try {
        let metadata = metadataByTitle.get(key);
        if (!metadata) {
          metadata = await lookupSteamMetadata(game.title);
          metadataByTitle.set(key, metadata);
        }
        enriched[index] = { ...game, ...metadata };
      } catch {
        // A failed lookup leaves the fields empty and is retried next refresh.
      }
    }
  };

  await Promise.all(
    Array.from({ length: MAX_CONCURRENT_LOOKUPS }, () => worker())
  );
  return enriched;
}
