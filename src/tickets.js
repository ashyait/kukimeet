// Support/order ticket system.
// A panel message with a button; clicking it opens a private channel between
// the member and your staff. Each ticket has a Close button.
import {
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { loadConfig } from './store.js';

export const OPEN_ID = 'km_ticket_open';
export const CLOSE_ID = 'km_ticket_close';

function panelRow(label) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(OPEN_ID).setLabel(label || 'Open a ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫'),
  );
}

function closeRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CLOSE_ID).setLabel('Close ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
  );
}

// Post (or re-post) the ticket panel. Skips if an identical panel already exists.
export async function postPanel(guild, config, channelsByName) {
  const t = config.tickets;
  if (!t || !t.enabled || !t.panelChannel) return { posted: false };
  const channel =
    channelsByName?.get(t.panelChannel.toLowerCase()) ||
    guild.channels.cache.find((c) => c.name.toLowerCase() === t.panelChannel.toLowerCase() && c.isTextBased?.());
  if (!channel) return { posted: false, warning: `Ticket panel channel "${t.panelChannel}" not found` };

  try {
    const recent = await channel.messages.fetch({ limit: 25 });
    const exists = recent.some(
      (m) => m.author.id === guild.members.me?.id && m.components?.[0]?.components?.some((c) => c.customId === OPEN_ID),
    );
    if (exists) return { posted: false, already: true };
  } catch { /* fetch may fail; just try to post */ }

  const body = `**${t.panelTitle || '🎫 Support'}**\n\n${t.panelMessage || 'Click the button below to open a ticket.'}`;
  await channel.send({ content: body.slice(0, 2000), components: [panelRow(t.buttonLabel)] });
  return { posted: true };
}

function memberCanClose(interaction, config) {
  const member = interaction.member;
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.ManageChannels)) return true;
  const supportRoles = (config.tickets?.supportRoles || []).map((r) => String(r).toLowerCase());
  for (const role of member.roles?.cache?.values?.() || []) {
    if (supportRoles.includes(role.name.toLowerCase())) return true;
  }
  // The person who opened it can also close it.
  if (interaction.channel?.topic?.includes(`opener:${interaction.user.id}`)) return true;
  return false;
}

export async function handleButton(interaction) {
  if (!interaction.isButton() || !interaction.guildId) return false;
  const config = await loadConfig(interaction.guildId);

  if (interaction.customId === OPEN_ID) {
    await openTicket(interaction, config);
    return true;
  }
  if (interaction.customId === CLOSE_ID) {
    if (!memberCanClose(interaction, config)) {
      await interaction.reply({ content: 'Only staff or the ticket owner can close this.', ephemeral: true });
      return true;
    }
    await interaction.reply({ content: '🔒 Closing this ticket in 5 seconds…' });
    const ch = interaction.channel;
    setTimeout(() => ch?.delete().catch(() => {}), 5000);
    return true;
  }
  return false;
}

async function openTicket(interaction, config) {
  const guild = interaction.guild;
  const t = config.tickets || {};
  const opener = interaction.user;

  // One open ticket per member.
  const existing = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.topic?.includes(`opener:${opener.id}`),
  );
  if (existing) {
    return interaction.reply({ content: `You already have an open ticket: <#${existing.id}>`, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  // Ensure the ticket category.
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === (t.categoryName || 'tickets').toLowerCase(),
  );
  if (!category) {
    category = await guild.channels.create({ name: t.categoryName || 'Tickets', type: ChannelType.GuildCategory }).catch(() => null);
  }

  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role },
    {
      id: opener.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
      type: OverwriteType.Member,
    },
  ];
  for (const rn of t.supportRoles || []) {
    const role = guild.roles.cache.find((r) => r.name.toLowerCase() === String(rn).toLowerCase());
    if (role) overwrites.push({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory], type: OverwriteType.Role });
  }

  const safeName = ('ticket-' + opener.username).toLowerCase().replace(/[^a-z0-9\-]/g, '').slice(0, 90) || `ticket-${opener.id}`;
  let channel;
  try {
    channel = await guild.channels.create({
      name: safeName,
      type: ChannelType.GuildText,
      parent: category?.id,
      topic: `opener:${opener.id}`,
      permissionOverwrites: overwrites,
    });
  } catch (e) {
    return interaction.editReply({ content: `Could not create a ticket channel: ${e.message}` });
  }

  const ping = (t.supportRoles || [])
    .map((rn) => guild.roles.cache.find((r) => r.name.toLowerCase() === String(rn).toLowerCase()))
    .filter(Boolean)
    .map((r) => `<@&${r.id}>`)
    .join(' ');
  const welcome = (t.openMessage || 'Thanks {user}! A staff member will be with you shortly.').replace(/\{user\}/g, `<@${opener.id}>`);
  await channel.send({ content: `${welcome}\n${ping}`.trim().slice(0, 2000), components: [closeRow()] }).catch(() => {});

  return interaction.editReply({ content: `✅ Ticket opened: <#${channel.id}>` });
}
