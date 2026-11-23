import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { getAggregatedGiveaways, getSourceStatus } from '../server/feed';

// Writes the aggregated feed into dist/ for static hosting. Exits non-zero when
// the live sources are down so a deploy cannot replace good data with the
// static catalog.
const games = await getAggregatedGiveaways(true);
const sources = getSourceStatus();

if (
  sources.epicGamesStore !== 'connected' &&
  sources.gamerPowerRadar !== 'connected'
) {
  console.error('Refusing to publish: Epic and GamerPower are both unavailable.');
  process.exit(1);
}

const outputDir = path.resolve('dist');
mkdirSync(outputDir, { recursive: true });
writeFileSync(
  path.join(outputDir, 'giveaways.json'),
  JSON.stringify({
    syncedAt: new Date().toISOString(),
    sources,
    count: games.length,
    giveaways: games,
  })
);
console.log(`Published ${games.length} giveaways`, sources);
