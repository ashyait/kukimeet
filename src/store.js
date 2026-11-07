// Simple JSON-file persistence for server configurations.
// No database needed — one config file per Discord guild.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data', 'guilds');

function fileFor(guildId) {
  // guildId is validated by callers; keep only digits to be safe.
  const safe = String(guildId).replace(/[^0-9]/g, '');
  return path.join(DATA_DIR, `${safe}.json`);
}

export function emptyConfig() {
  return {
    serverName: '',
    roles: [],
    categories: [],
    rules: { channel: 'rules', title: 'Server Rules', content: '' },
    welcome: { channel: 'welcome', message: 'Welcome {user} to the server! 👋' },
    selfRoles: { channel: '', message: 'React to get a role:', options: [] },
    autoMod: { blockInvites: false, blockLinks: false, bannedWords: [] },
    commands: [],
    tickets: {
      enabled: false,
      panelChannel: 'support',
      panelTitle: '🎫 Support',
      panelMessage: 'Click the button below to open a ticket and a staff member will help you.',
      buttonLabel: 'Open a ticket',
      categoryName: 'Tickets',
      supportRoles: [],
      openMessage: 'Thanks {user}! A staff member will be with you shortly.',
    },
  };
}

export async function loadConfig(guildId) {
  try {
    const raw = await fs.readFile(fileFor(guildId), 'utf8');
    return { ...emptyConfig(), ...JSON.parse(raw) };
  } catch {
    return emptyConfig();
  }
}

export async function saveConfig(guildId, config) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const merged = { ...emptyConfig(), ...config };
  await fs.writeFile(fileFor(guildId), JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

export async function listGuilds() {
  try {
    const files = await fs.readdir(DATA_DIR);
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}
