// Registers slash commands for a guild and handles them.
// Built-in commands + any custom text commands defined in the config.
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { loadConfig } from './store.js';

function customCommandBuilders(config) {
  const seen = new Set();
  const builders = [];
  for (const c of config.commands || []) {
    const name = String(c.name || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    builders.push(
      new SlashCommandBuilder()
        .setName(name)
        .setDescription((c.description || 'Custom command').slice(0, 100)),
    );
  }
  return builders;
}

const builtins = [
  new SlashCommandBuilder().setName('ping').setDescription('Check that the bot is alive'),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Show basic info about this server'),
  new SlashCommandBuilder().setName('membercount').setDescription('Show how many members are here'),
];

export async function registerCommands(client, guildId) {
  const config = await loadConfig(guildId);
  const commands = [...builtins, ...customCommandBuilders(config)].map((b) => b.toJSON());
  const rest = new REST({ version: '10' }).setToken(client.token);
  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
  return commands.length;
}

export async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand() || !interaction.guildId) return;
  const name = interaction.commandName;

  if (name === 'ping') {
    return interaction.reply(`🏓 Pong! (${Math.round(interaction.client.ws.ping)}ms)`);
  }
  if (name === 'serverinfo') {
    const g = interaction.guild;
    return interaction.reply(
      `**${g.name}**\nMembers: ${g.memberCount}\nChannels: ${g.channels.cache.size}\nRoles: ${g.roles.cache.size}\nCreated: <t:${Math.floor(g.createdTimestamp / 1000)}:D>`,
    );
  }
  if (name === 'membercount') {
    return interaction.reply(`👥 There are **${interaction.guild.memberCount}** members.`);
  }

  // Custom text command?
  const config = await loadConfig(interaction.guildId);
  const custom = (config.commands || []).find((c) => String(c.name || '').toLowerCase() === name);
  if (custom) {
    return interaction.reply(String(custom.response || '...').slice(0, 2000));
  }

  return interaction.reply({ content: 'Unknown command (try re-syncing from the app).', ephemeral: true });
}
