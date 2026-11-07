# Kukimeet — Discord Server Builder

Design your Discord server on your phone — roles, categories, channels, rules,
a welcome message, self-assign (reaction) roles, basic auto-moderation and
custom slash commands — then tap **Apply** and a bot builds it all for you
automatically.

It's a tiny self-hosted web app plus a Discord bot, in one Node process.

## Features

- 📱 **Phone-first web UI** — dark, Discord-style, works great on mobile.
- 🧩 **Templates** — start from a Community, Gaming Clan, Creator or Seller layout, then tweak.
- 👑 **Roles** — name, color, hoist, mentionable and permission toggles.
- 🗂️ **Categories & channels** — text / voice / announcement / forum / stage.
- 📜 **Rules message** — posted automatically (supports `<#channel-name>` links).
- 👋 **Welcome messages** — greets new members (`{user}` becomes a mention).
- 🎭 **Reaction roles** — members react to self-assign roles.
- 🎫 **Ticket system** — a button panel opens a private support/order channel between the member and your staff, with a Close button. One open ticket per member.
- 🛡️ **Auto-mod** — block invite links, block all links, banned-word filter (staff exempt).
- ⚡ **Slash commands** — built-in `/ping`, `/serverinfo`, `/membercount` + your own custom replies.
- ♻️ **Idempotent** — re-applying updates existing roles/channels instead of duplicating.

## Setup

### 1. Create a Discord bot
1. Go to <https://discord.com/developers/applications> → **New Application**.
2. **Bot** tab → **Reset Token** → copy the token.
3. Under **Privileged Gateway Intents**, enable **Server Members Intent** and
   **Message Content Intent** (needed for welcomes, reaction roles and auto-mod).
4. **OAuth2 → URL Generator**: scopes `bot` + `applications.commands`;
   bot permissions: **Administrator** (simplest) or at least Manage Roles,
   Manage Channels, Send Messages, Add Reactions, Kick Members. Open the
   generated URL and invite the bot to your server.

### 2. Run the app
```bash
cp .env.example .env     # then paste your token into DISCORD_TOKEN
npm install
npm start
```
Open the printed URL (default <http://localhost:3000>). If you didn't set
`ADMIN_PASSWORD`, a temporary one is printed in the console.

> **Phone access:** run it on a machine your phone can reach (home server, a
> small VPS, or a tunnel like Cloudflare Tunnel / Tailscale) and open that
> address in your phone's browser. Anyone with the admin password can change
> your server, so pick a strong one and use HTTPS if exposing it publicly.

### 3. Build your server
Log in → pick your server → edit the tabs → **Save** (keeps the config) →
**Apply to server** (makes the changes live).

## Ticket system

Enable it in the **Tickets** tab (the **Seller** template turns it on already).
On **Apply**, the bot posts a panel message with an "Open a ticket" button in
your chosen channel. When a member clicks it:

1. The bot creates a private channel under your **Tickets** category.
2. Only that member and your **support roles** can see it.
3. The ticket has a **Close** button (staff or the ticket owner can close it).

Each member can have one open ticket at a time. For the button to keep working,
the bot must stay online.

## Config storage
Each server's setup is saved as JSON in `data/guilds/<guildId>.json`, so you
can back it up, edit it by hand, or copy it between servers.

## Notes
- The bot must be **higher in the role list** than any role it needs to manage.
- Re-applying is safe: existing roles/channels are updated, not duplicated, and
  channels that already exist are left untouched.

## License
MIT
