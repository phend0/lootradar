import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { getAggregatedGiveaways, getSourceStatus } from './server/feed';
import { INITIAL_GIVEAWAYS } from './src/data/giveaways';
import {
  isEligibleGiveawayGame,
  withCurrentStatus,
} from './src/utils/gameEligibility';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.get('/api/giveaways', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const refresh = req.query.refresh === 'true';
      const games = await getAggregatedGiveaways(refresh);
      res.json({
        syncedAt: new Date().toISOString(),
        sources: getSourceStatus(),
        count: games.length,
        giveaways: games,
      });
    } catch {
      const fallback = withCurrentStatus(
        INITIAL_GIVEAWAYS.filter(isEligibleGiveawayGame),
        Date.now()
      );
      res.json({
        syncedAt: new Date().toISOString(),
        sources: {
          epicGamesStore: 'fallback',
          amazonLuna: 'fallback',
          gamerPowerRadar: 'fallback',
          gogCatalog: 'fallback',
        },
        count: fallback.length,
        giveaways: fallback,
      });
    }
  });

  const serveAndroidApk = (_req: express.Request, res: express.Response) => {
    const apkPath = path.join(__dirname, 'public', 'LootRadar.apk');
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="LootRadar.apk"'
    );
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(apkPath);
  };

  app.get('/LootRadar.apk', serveAndroidApk);
  app.get('/LootRadar-S26Ultra.apk', serveAndroidApk);

  app.get('/LootRadar-iOS.mobileconfig', (_req, res) => {
    const profilePath = path.join(__dirname, 'public', 'LootRadar-iOS.mobileconfig');
    res.setHeader('Content-Type', 'application/x-apple-aspen-config');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="LootRadar-iOS.mobileconfig"'
    );
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(profilePath);
  });

  app.get('/LootRadar-iOS.ipa', (_req, res) => {
    const ipaPath = path.join(__dirname, 'public', 'LootRadar-iOS.ipa');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="LootRadar-iOS.ipa"'
    );
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(ipaPath);
  });

  // `npm start` always serves the production build, on any OS.
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start';

  if (!isProduction) {
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
