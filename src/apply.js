// Takes a saved config and makes a Discord guild match it.
// Idempotent-by-name: re-running updates existing roles/channels instead of duplicating.
import {
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
} from 'discord.js';

const CHANNEL_TYPES = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  announcement: ChannelType.GuildAnnouncement,
  forum: ChannelType.GuildForum,
  stage: ChannelType.GuildStageVoice,
};

function resolvePermissions(names = []) {
  const bits = [];
  for (const name of names) {
    const flag = PermissionFlagsBits[name];
    if (flag !== undefined) bits.push(flag);
  }
  return bits;
}

function normalizeColor(color) {
  if (!color) return null;
  if (typeof color === 'number') return color;
  const hex = String(color).replace('#', '').trim();
  const n = parseInt(hex, 16);
  return Number.isNaN(n) ? null : n;
}

// Replace <#channel-name> mentions with real <#id> links once channels exist.
function linkChannels(text, channelsByName) {
  if (!text) return text;
  return text.replace(/<#([a-z0-9\-]+)>/gi, (match, name) => {
    const ch = channelsByName.get(name.toLowerCase());
    return ch ? `<#${ch.id}>` : match;
  });
}

export async function applyConfig(guild, config, log = () => {}) {
  const result = { rolesCreated: 0, rolesUpdated: 0, channelsCreated: 0, categoriesCreated: 0, messagesPosted: 0, warnings: [] };

  // 1. Server name
  if (config.serverName && guild.name !== config.serverName) {
    try {
      await guild.setName(config.serverName);
      log(`Renamed server to "${config.serverName}"`);
    } catch (e) {
      result.warnings.push(`Could not rename server: ${e.message}`);
    }
  }

  // 2. Roles
  const rolesByName = new Map();
  await guild.roles.fetch();
  for (const role of guild.roles.cache.values()) rolesByName.set(role.name.toLowerCase(), role);

  for (const roleDef of config.roles || []) {
    if (!roleDef.name) continue;
    const key = roleDef.name.toLowerCase();
    const data = {
      name: roleDef.name,
      color: normalizeColor(roleDef.color) ?? undefined,
      hoist: !!roleDef.hoist,
      mentionable: !!roleDef.mentionable,
      permissions: resolvePermissions(roleDef.permissions),
    };
    try {
      if (rolesByName.has(key)) {
        const role = rolesByName.get(key);
        if (role.managed || role.id === guild.id) continue; // skip bot/@everyone managed roles
        await role.edit(data);
        result.rolesUpdated++;
      } else {
        const role = await guild.roles.create(data);
        rolesByName.set(key, role);
        result.rolesCreated++;
        log(`Created role ${roleDef.name}`);
      }
    } catch (e) {
      result.warnings.push(`Role "${roleDef.name}": ${e.message}`);
    }
  }

  // 3. Categories + channels
  await guild.channels.fetch();
  const channelsByName = new Map();
  const categoriesByName = new Map();
  for (const ch of guild.channels.cache.values()) {
    if (ch.type === ChannelType.GuildCategory) categoriesByName.set(ch.name.toLowerCase(), ch);
    else channelsByName.set(ch.name.toLowerCase(), ch);
  }

  for (const catDef of config.categories || []) {
    let category = catDef.name ? categoriesByName.get(catDef.name.toLowerCase()) : null;
    try {
      if (catDef.name && !category) {
        category = await guild.channels.create({ name: catDef.name, type: ChannelType.GuildCategory });
        categoriesByName.set(catDef.name.toLowerCase(), category);
        result.categoriesCreated++;
        log(`Created category ${catDef.name}`);
      }
    } catch (e) {
      result.warnings.push(`Category "${catDef.name}": ${e.message}`);
      continue;
    }

    for (const chDef of catDef.channels || []) {
      if (!chDef.name) continue;
      const key = chDef.name.toLowerCase();
      if (channelsByName.has(key)) continue; // already exists, leave contents alone
      const type = CHANNEL_TYPES[chDef.type] ?? ChannelType.GuildText;

      // Optional private channel: lock to specific roles.
      let permissionOverwrites;
      if (Array.isArray(chDef.allowedRoles) && chDef.allowedRoles.length) {
        permissionOverwrites = [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role },
          ...chDef.allowedRoles
            .map((rn) => rolesByName.get(String(rn).toLowerCase()))
            .filter(Boolean)
            .map((role) => ({ id: role.id, allow: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role })),
        ];
      }

      try {
        const created = await guild.channels.create({
          name: chDef.name,
          type,
          parent: category ? category.id : undefined,
          topic: type === ChannelType.GuildText || type === ChannelType.GuildAnnouncement ? chDef.topic || undefined : undefined,
          rateLimitPerUser: chDef.slowmode || undefined,
          nsfw: !!chDef.nsfw,
          permissionOverwrites,
        });
        channelsByName.set(key, created);
        result.channelsCreated++;
        log(`Created channel ${chDef.name}`);
      } catch (e) {
        result.warnings.push(`Channel "${chDef.name}": ${e.message}`);
      }
    }
  }

  // 4. Rules message
  if (config.rules && config.rules.content) {
    const ch = channelsByName.get((config.rules.channel || 'rules').toLowerCase());
    if (ch && ch.isTextBased?.()) {
      try {
        const body = `**${config.rules.title || 'Server Rules'}**\n\n${linkChannels(config.rules.content, channelsByName)}`;
        await ch.send(body.slice(0, 2000));
        result.messagesPosted++;
        log('Posted rules');
      } catch (e) {
        result.warnings.push(`Rules message: ${e.message}`);
      }
    } else {
      result.warnings.push(`Rules channel "${config.rules.channel}" not found`);
    }
  }

  // 5. Self-assign roles message (reaction roles handled by the bot at runtime)
  if (config.selfRoles && config.selfRoles.channel && (config.selfRoles.options || []).length) {
    const ch = channelsByName.get(config.selfRoles.channel.toLowerCase());
    if (ch && ch.isTextBased?.()) {
      try {
        const lines = config.selfRoles.options.map((o) => `${o.emoji} — ${o.label || o.roleName}`).join('\n');
        const msg = await ch.send(`${config.selfRoles.message || 'React to get a role:'}\n\n${lines}`.slice(0, 2000));
        for (const o of config.selfRoles.options) {
          try { await msg.react(o.emoji); } catch { /* invalid emoji */ }
        }
        result.messagesPosted++;
        log('Posted self-role message');
      } catch (e) {
        result.warnings.push(`Self-roles message: ${e.message}`);
      }
    }
  }

  return result;
}
