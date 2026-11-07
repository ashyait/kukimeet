// The Discord bot: welcome messages, reaction roles, auto-mod and slash commands.
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} from 'discord.js';
import { loadConfig } from './store.js';
import { registerCommands, handleCommand } from './commands.js';

let client = null;

export function getClient() {
  return client;
}

// Find the role a reaction maps to, for a given message in the self-roles channel.
async function selfRoleFor(reaction, guildId) {
  const config = await loadConfig(guildId);
  const sr = config.selfRoles;
  if (!sr || !(sr.options || []).length) return null;
  const emoji = reaction.emoji.name;
  const opt = sr.options.find((o) => o.emoji === emoji || o.emoji === reaction.emoji.toString());
  if (!opt) return null;
  const guild = reaction.message.guild;
  return guild.roles.cache.find((r) => r.name.toLowerCase() === String(opt.roleName).toLowerCase()) || null;
}

const INVITE_RE = /(discord\.gg|discord(app)?\.com\/invite)\/\S+/i;
const LINK_RE = /https?:\/\/\S+/i;

export async function startBot(token) {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });

  client.once(Events.ClientReady, async (c) => {
    console.log(`Bot logged in as ${c.user.tag}`);
    for (const guild of c.guilds.cache.values()) {
      try {
        const n = await registerCommands(c, guild.id);
        console.log(`Registered ${n} commands in ${guild.name}`);
      } catch (e) {
        console.warn(`Command sync failed for ${guild.name}: ${e.message}`);
      }
    }
  });

  // Welcome new members
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const config = await loadConfig(member.guild.id);
      const w = config.welcome;
      if (!w || !w.channel || !w.message) return;
      const channel = member.guild.channels.cache.find(
        (c) => c.name.toLowerCase() === w.channel.toLowerCase() && c.isTextBased?.(),
      );
      if (channel) {
        await channel.send(w.message.replace(/\{user\}/g, `<@${member.id}>`).slice(0, 2000));
      }
    } catch (e) {
      console.warn(`Welcome failed: ${e.message}`);
    }
  });

  // Reaction roles
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    try {
      if (reaction.partial) await reaction.fetch();
      const role = await selfRoleFor(reaction, reaction.message.guildId);
      if (!role) return;
      const member = await reaction.message.guild.members.fetch(user.id);
      await member.roles.add(role);
    } catch (e) {
      console.warn(`Add reaction role failed: ${e.message}`);
    }
  });

  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (user.bot) return;
    try {
      if (reaction.partial) await reaction.fetch();
      const role = await selfRoleFor(reaction, reaction.message.guildId);
      if (!role) return;
      const member = await reaction.message.guild.members.fetch(user.id);
      await member.roles.remove(role);
    } catch (e) {
      console.warn(`Remove reaction role failed: ${e.message}`);
    }
  });

  // Basic auto-moderation
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    try {
      const config = await loadConfig(message.guild.id);
      const am = config.autoMod || {};
      const perms = message.member?.permissions;
      if (perms?.has('ManageMessages')) return; // don't moderate staff

      const content = message.content || '';
      let offending = null;
      if (am.blockInvites && INVITE_RE.test(content)) offending = 'invite links are not allowed';
      else if (am.blockLinks && LINK_RE.test(content)) offending = 'links are not allowed here';
      else if ((am.bannedWords || []).some((w) => w && content.toLowerCase().includes(String(w).toLowerCase())))
        offending = 'that word is not allowed';

      if (offending) {
        await message.delete().catch(() => {});
        const warn = await message.channel.send(`<@${message.author.id}>, ${offending}.`).catch(() => null);
        if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
      }
    } catch (e) {
      console.warn(`Automod error: ${e.message}`);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      await handleCommand(interaction);
    } catch (e) {
      console.warn(`Command error: ${e.message}`);
      if (interaction.isRepliable() && !interaction.replied) {
        interaction.reply({ content: 'Something went wrong.', ephemeral: true }).catch(() => {});
      }
    }
  });

  await client.login(token);
  return client;
}
