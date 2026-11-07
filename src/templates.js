// Ready-made starting points for common, legitimate community servers.
// Pick one in the web UI, then tweak everything before applying.

export const templates = {
  community: {
    serverName: 'My Community',
    roles: [
      { name: 'Admin', color: '#e74c3c', hoist: true, mentionable: true, permissions: ['Administrator'] },
      { name: 'Moderator', color: '#3498db', hoist: true, mentionable: true, permissions: ['KickMembers', 'ManageMessages', 'MuteMembers'] },
      { name: 'Member', color: '#2ecc71', hoist: false, mentionable: true, permissions: [] },
    ],
    categories: [
      {
        name: 'Information',
        channels: [
          { name: 'rules', type: 'text', topic: 'Read before posting', slowmode: 0 },
          { name: 'announcements', type: 'announcement', topic: 'Server news' },
          { name: 'welcome', type: 'text', topic: 'New members land here' },
        ],
      },
      {
        name: 'General',
        channels: [
          { name: 'general', type: 'text', topic: 'Talk about anything' },
          { name: 'off-topic', type: 'text', topic: 'Everything else' },
          { name: 'media', type: 'text', topic: 'Images and clips' },
          { name: 'General Voice', type: 'voice' },
        ],
      },
    ],
    rules: {
      channel: 'rules',
      title: '📜 Server Rules',
      content:
        '1. Be respectful to everyone.\n2. No spam or self-promotion without permission.\n3. Keep content appropriate for all ages.\n4. No harassment, hate speech or discrimination.\n5. Listen to the staff team.',
    },
    welcome: { channel: 'welcome', message: 'Welcome {user}! Check out <#rules> and say hi in <#general>. 🎉' },
    selfRoles: { channel: '', message: '', options: [] },
    autoMod: { blockInvites: true, blockLinks: false, bannedWords: [] },
    commands: [
      { name: 'hello', description: 'Say hello', response: 'Hey there! 👋' },
      { name: 'rules', description: 'Show the rules channel', response: 'Please read the rules in <#rules>.' },
    ],
  },

  gaming: {
    serverName: 'Gaming Clan',
    roles: [
      { name: 'Owner', color: '#f1c40f', hoist: true, mentionable: true, permissions: ['Administrator'] },
      { name: 'Captain', color: '#9b59b6', hoist: true, mentionable: true, permissions: ['ManageMessages', 'MuteMembers', 'MoveMembers'] },
      { name: 'Member', color: '#1abc9c', hoist: false, mentionable: true, permissions: [] },
    ],
    categories: [
      {
        name: 'Info',
        channels: [
          { name: 'rules', type: 'text', topic: 'Clan rules' },
          { name: 'announcements', type: 'announcement', topic: 'Clan news' },
          { name: 'welcome', type: 'text', topic: 'New recruits' },
        ],
      },
      {
        name: 'Lounge',
        channels: [
          { name: 'general', type: 'text', topic: 'General chat' },
          { name: 'looking-for-group', type: 'text', topic: 'Find teammates' },
          { name: 'clips', type: 'text', topic: 'Share your best plays' },
          { name: 'Team Voice 1', type: 'voice' },
          { name: 'Team Voice 2', type: 'voice' },
        ],
      },
    ],
    rules: {
      channel: 'rules',
      title: '🎮 Clan Rules',
      content:
        '1. Respect your teammates.\n2. No cheating, hacking or exploiting — it gets you removed.\n3. No toxicity or rage in voice chat.\n4. Represent the clan with good sportsmanship.',
    },
    welcome: { channel: 'welcome', message: 'GG {user}, welcome to the clan! Grab a role and jump in <#looking-for-group>.' },
    selfRoles: { channel: '', message: '', options: [] },
    autoMod: { blockInvites: true, blockLinks: false, bannedWords: [] },
    commands: [{ name: 'lfg', description: 'How to find a group', response: 'Post in <#looking-for-group> to find teammates!' }],
  },

  creator: {
    serverName: 'Creator Hub',
    roles: [
      { name: 'Creator', color: '#e67e22', hoist: true, mentionable: true, permissions: ['Administrator'] },
      { name: 'Mod', color: '#3498db', hoist: true, mentionable: true, permissions: ['ManageMessages', 'MuteMembers'] },
      { name: 'Subscriber', color: '#e91e63', hoist: false, mentionable: true, permissions: [] },
      { name: 'Viewer', color: '#95a5a6', hoist: false, mentionable: true, permissions: [] },
    ],
    categories: [
      {
        name: 'Start Here',
        channels: [
          { name: 'rules', type: 'text', topic: 'Community guidelines' },
          { name: 'announcements', type: 'announcement', topic: 'Uploads & streams' },
          { name: 'welcome', type: 'text', topic: 'Say hello' },
        ],
      },
      {
        name: 'Community',
        channels: [
          { name: 'general', type: 'text', topic: 'Hang out' },
          { name: 'content-feedback', type: 'text', topic: 'Suggest ideas' },
          { name: 'fan-art', type: 'text', topic: 'Share your creations' },
          { name: 'Hangout Voice', type: 'voice' },
        ],
      },
    ],
    rules: {
      channel: 'rules',
      title: '✨ Community Guidelines',
      content:
        '1. Be kind and welcoming.\n2. Keep spoilers in the right channels.\n3. No spam or advertising.\n4. Follow Discord\'s Terms of Service.',
    },
    welcome: { channel: 'welcome', message: 'Welcome {user}! Thanks for being here — check <#announcements> for the latest. 💜' },
    selfRoles: { channel: '', message: '', options: [] },
    autoMod: { blockInvites: true, blockLinks: false, bannedWords: [] },
    commands: [{ name: 'socials', description: 'Where to follow', response: 'Follow the latest in <#announcements>!' }],
  },
};

export function templateNames() {
  return Object.keys(templates);
}
