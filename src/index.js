// Entry point: start the Discord bot and the web app together.
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startBot } from './bot.js';
import { startWeb } from './web.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tiny .env loader (no dependency needed).
async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(__dirname, '..', '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* no .env file — rely on real environment variables */
  }
}

async function main() {
  await loadEnv();

  const token = process.env.DISCORD_TOKEN;
  const port = parseInt(process.env.PORT || '3000', 10);
  let password = process.env.ADMIN_PASSWORD;

  if (!token) {
    console.error('\n❌ DISCORD_TOKEN is not set.');
    console.error('   Copy .env.example to .env and paste your bot token.');
    console.error('   Get one at https://discord.com/developers/applications\n');
    process.exit(1);
  }

  if (!password) {
    password = crypto.randomBytes(6).toString('hex');
    console.log('\n🔑 No ADMIN_PASSWORD set — generated a temporary one for this run:');
    console.log(`   ${password}`);
    console.log('   (Set ADMIN_PASSWORD in .env to keep it fixed.)\n');
  }

  await startWeb(port, password);

  try {
    await startBot(token);
  } catch (e) {
    console.error(`\n❌ Could not log the bot in: ${e.message}`);
    console.error('   Check that DISCORD_TOKEN is correct and the bot is invited to your server.\n');
    // Web app still runs so the UI loads, but applying will report the bot is offline.
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
