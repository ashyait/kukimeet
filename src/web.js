// Phone-friendly web app to edit configs and apply them to your server.
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, saveConfig } from './store.js';
import { applyConfig } from './apply.js';
import { registerCommands } from './commands.js';
import { getClient } from './bot.js';
import { templates } from './templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Very small in-memory session store. Tokens live until restart.
const sessions = new Set();

function makeApp(adminPassword) {
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  function authed(req, res, next) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (token && sessions.has(token)) return next();
    return res.status(401).json({ error: 'Not authorized. Please log in.' });
  }

  // Timing-safe password check.
  function passwordOk(input) {
    const a = Buffer.from(String(input || ''));
    const b = Buffer.from(String(adminPassword));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  app.post('/api/login', (req, res) => {
    if (!passwordOk(req.body?.password)) {
      return res.status(401).json({ error: 'Wrong password.' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    sessions.add(token);
    res.json({ token });
  });

  app.get('/api/templates', authed, (req, res) => {
    res.json(templates);
  });

  // Guilds the bot is currently in.
  app.get('/api/guilds', authed, (req, res) => {
    const client = getClient();
    if (!client || !client.isReady()) return res.json({ guilds: [], botReady: false });
    const guilds = [...client.guilds.cache.values()].map((g) => ({
      id: g.id,
      name: g.name,
      memberCount: g.memberCount,
      icon: g.iconURL?.({ size: 64 }) || null,
    }));
    res.json({ guilds, botReady: true });
  });

  app.get('/api/config/:guildId', authed, async (req, res) => {
    const config = await loadConfig(req.params.guildId);
    res.json(config);
  });

  app.post('/api/config/:guildId', authed, async (req, res) => {
    try {
      const saved = await saveConfig(req.params.guildId, req.body || {});
      res.json({ ok: true, config: saved });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Apply the saved config to the live server.
  app.post('/api/apply/:guildId', authed, async (req, res) => {
    const client = getClient();
    if (!client || !client.isReady()) return res.status(503).json({ error: 'Bot is not connected.' });
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Bot is not in that server.' });

    try {
      if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) {
        await saveConfig(req.params.guildId, req.body);
      }
      const config = await loadConfig(req.params.guildId);
      const logs = [];
      const result = await applyConfig(guild, config, (m) => logs.push(m));
      let commandCount = 0;
      try {
        commandCount = await registerCommands(client, guild.id);
      } catch (e) {
        result.warnings.push(`Command sync: ${e.message}`);
      }
      res.json({ ok: true, result, logs, commandCount });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/health', (req, res) => {
    const client = getClient();
    res.json({ ok: true, botReady: !!(client && client.isReady()) });
  });

  return app;
}

export function startWeb(port, adminPassword) {
  const app = makeApp(adminPassword);
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Web app listening on http://localhost:${port}`);
      resolve(server);
    });
  });
}
