// Kukimeet front-end. Plain JS, no framework — small enough to read on a phone.
'use strict';

const PERMS = [
  'Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels', 'KickMembers',
  'BanMembers', 'ManageMessages', 'MuteMembers', 'MoveMembers', 'ManageNicknames',
  'ManageEmojisAndStickers', 'MentionEveryone', 'ViewAuditLog',
];
const CHANNEL_KINDS = ['text', 'voice', 'announcement', 'forum', 'stage'];

const state = {
  token: localStorage.getItem('km_token') || '',
  guildId: null,
  guildName: '',
  config: null,
};

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, kids = []) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  for (const k of [].concat(kids)) n.append(k);
  return n;
};

async function api(pathName, opts = {}) {
  const res = await fetch('/api' + pathName, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) { logout(); throw new Error('Session expired — log in again.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
  return data;
}

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
  $('#' + id).classList.remove('hidden');
}
function overlay(on, text) { $('#overlayText').textContent = text || 'Working…'; $('#overlay').classList.toggle('hidden', !on); }
function toast(msg, isErr) {
  const t = $('#toast');
  t.textContent = msg; t.classList.toggle('err', !!isErr); t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 3000);
}

function logout() {
  state.token = ''; localStorage.removeItem('km_token'); show('login');
}

/* ---------- Login ---------- */
async function doLogin() {
  const password = $('#password').value;
  $('#loginError').textContent = '';
  try {
    const { token } = await api('/login', { method: 'POST', body: JSON.stringify({ password }) });
    state.token = token; localStorage.setItem('km_token', token);
    $('#password').value = '';
    await openGuilds();
  } catch (e) {
    $('#loginError').textContent = e.message;
  }
}

/* ---------- Guilds ---------- */
async function openGuilds() {
  show('guilds');
  const list = $('#guildList'); list.innerHTML = '';
  $('#guildHint').textContent = '';
  try {
    const { guilds, botReady } = await api('/guilds');
    if (!botReady) { $('#guildHint').textContent = 'Bot is offline. Start it with a valid token, then refresh.'; return; }
    if (!guilds.length) { $('#guildHint').textContent = 'The bot is not in any server yet. Invite it, then refresh.'; return; }
    for (const g of guilds) {
      const avatar = g.icon
        ? el('img', { src: g.icon, alt: '' })
        : el('div', { className: 'avatar', textContent: (g.name[0] || '?').toUpperCase() });
      const card = el('div', { className: 'guild' }, [
        avatar,
        el('div', { className: 'meta' }, [el('div', { textContent: g.name }), el('small', { textContent: g.memberCount + ' members' })]),
        el('span', { textContent: '›' }),
      ]);
      card.onclick = () => openEditor(g.id, g.name);
      list.append(card);
    }
  } catch (e) { $('#guildHint').textContent = e.message; }
}

/* ---------- Editor ---------- */
async function openEditor(guildId, guildName) {
  state.guildId = guildId; state.guildName = guildName;
  overlay(true, 'Loading…');
  try {
    state.config = await api('/config/' + guildId);
    $('#editorTitle').textContent = guildName;
    await loadTemplateOptions();
    fillForm();
    switchTab('general');
    show('editor');
  } catch (e) { toast(e.message, true); }
  finally { overlay(false); }
}

async function loadTemplateOptions() {
  if (loadTemplateOptions._done) return;
  try {
    const templates = await api('/templates');
    const sel = $('#templatePick');
    for (const name of Object.keys(templates)) {
      sel.append(el('option', { value: name, textContent: name[0].toUpperCase() + name.slice(1) }));
    }
    loadTemplateOptions._templates = templates;
    loadTemplateOptions._done = true;
  } catch { /* non-fatal */ }
}

function switchTab(name) {
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('active', b.dataset.tab === name);
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('hidden', t.dataset.tab !== name);
}

/* ----- render config into the form ----- */
function fillForm() {
  const c = state.config;
  $('#serverName').value = c.serverName || '';
  // rules
  $('#rulesChannel').value = c.rules?.channel || '';
  $('#rulesTitle').value = c.rules?.title || '';
  $('#rulesContent').value = c.rules?.content || '';
  // welcome
  $('#welcomeChannel').value = c.welcome?.channel || '';
  $('#welcomeMessage').value = c.welcome?.message || '';
  // self roles
  $('#srChannel').value = c.selfRoles?.channel || '';
  $('#srMessage').value = c.selfRoles?.message || '';
  // automod
  $('#amInvites').checked = !!c.autoMod?.blockInvites;
  $('#amLinks').checked = !!c.autoMod?.blockLinks;
  $('#amWords').value = (c.autoMod?.bannedWords || []).join(', ');

  renderRoles(); renderChannels(); renderSelfRoles(); renderCommands();
}

function renderRoles() {
  const wrap = $('#rolesList'); wrap.innerHTML = '';
  (state.config.roles || []).forEach((role, i) => {
    const permGrid = el('div', { className: 'perm-grid' },
      PERMS.map((p) => {
        const cb = el('input', { type: 'checkbox', checked: (role.permissions || []).includes(p) });
        cb.onchange = () => {
          role.permissions = role.permissions || [];
          if (cb.checked) role.permissions.push(p);
          else role.permissions = role.permissions.filter((x) => x !== p);
        };
        return el('label', {}, [cb, document.createTextNode(p)]);
      }));

    const nameInput = el('input', { value: role.name || '', placeholder: 'Role name' });
    nameInput.oninput = () => { role.name = nameInput.value; };
    const color = el('input', { type: 'color', className: 'swatch', value: role.color || '#99aab5' });
    color.oninput = () => { role.color = color.value; };
    const hoist = el('input', { type: 'checkbox', checked: !!role.hoist }); hoist.onchange = () => { role.hoist = hoist.checked; };
    const ment = el('input', { type: 'checkbox', checked: !!role.mentionable }); ment.onchange = () => { role.mentionable = ment.checked; };
    const del = el('button', { className: 'danger tiny', textContent: 'Delete' });
    del.onclick = () => { state.config.roles.splice(i, 1); renderRoles(); };

    wrap.append(el('div', { className: 'item' }, [
      el('div', { className: 'item-head' }, [el('strong', { textContent: 'Role' }), del]),
      el('div', { className: 'inline' }, [color, nameInput]),
      el('label', { className: 'checkrow' }, [hoist, document.createTextNode('Show separately')]),
      el('label', { className: 'checkrow' }, [ment, document.createTextNode('Allow @mention')]),
      el('label', { textContent: 'Permissions' }),
      permGrid,
    ]));
  });
}

function renderChannels() {
  const wrap = $('#catList'); wrap.innerHTML = '';
  (state.config.categories || []).forEach((cat, ci) => {
    const catName = el('input', { value: cat.name || '', placeholder: 'Category name' });
    catName.oninput = () => { cat.name = catName.value; };
    const delCat = el('button', { className: 'danger tiny', textContent: 'Delete' });
    delCat.onclick = () => { state.config.categories.splice(ci, 1); renderChannels(); };

    const chWrap = el('div', {});
    (cat.channels || []).forEach((ch, chi) => {
      const n = el('input', { value: ch.name || '', placeholder: 'channel-name' });
      n.oninput = () => { ch.name = n.value; };
      const type = el('select', {},
        CHANNEL_KINDS.map((k) => el('option', { value: k, textContent: k, selected: (ch.type || 'text') === k })));
      type.onchange = () => { ch.type = type.value; };
      const rm = el('button', { className: 'danger tiny', textContent: '✕' });
      rm.onclick = () => { cat.channels.splice(chi, 1); renderChannels(); };
      chWrap.append(el('div', { className: 'chanrow' }, [n, type, rm]));
    });

    const addCh = el('button', { className: 'ghost tiny', textContent: '+ channel' });
    addCh.onclick = () => { cat.channels = cat.channels || []; cat.channels.push({ name: '', type: 'text' }); renderChannels(); };

    wrap.append(el('div', { className: 'item' }, [
      el('div', { className: 'item-head' }, [el('strong', { textContent: 'Category' }), delCat]),
      catName, chWrap, addCh,
    ]));
  });
}

function renderSelfRoles() {
  const wrap = $('#srList'); wrap.innerHTML = '';
  const sr = (state.config.selfRoles = state.config.selfRoles || { options: [] });
  sr.options = sr.options || [];
  sr.options.forEach((o, i) => {
    const emoji = el('input', { value: o.emoji || '', placeholder: '👍', maxLength: 40 });
    emoji.oninput = () => { o.emoji = emoji.value; };
    const roleName = el('input', { value: o.roleName || '', placeholder: 'Role name' });
    roleName.oninput = () => { o.roleName = roleName.value; };
    const label = el('input', { value: o.label || '', placeholder: 'Label (optional)' });
    label.oninput = () => { o.label = label.value; };
    const rm = el('button', { className: 'danger tiny', textContent: 'Delete' });
    rm.onclick = () => { sr.options.splice(i, 1); renderSelfRoles(); };
    wrap.append(el('div', { className: 'item' }, [
      el('div', { className: 'item-head' }, [el('strong', { textContent: 'Reaction role' }), rm]),
      el('div', { className: 'chanrow' }, [emoji, roleName]),
      label,
    ]));
  });
}

function renderCommands() {
  const wrap = $('#cmdList'); wrap.innerHTML = '';
  (state.config.commands || []).forEach((cmd, i) => {
    const name = el('input', { value: cmd.name || '', placeholder: 'command (no slash)' });
    name.oninput = () => { cmd.name = name.value; };
    const desc = el('input', { value: cmd.description || '', placeholder: 'Short description' });
    desc.oninput = () => { cmd.description = desc.value; };
    const resp = el('textarea', { value: cmd.response || '', rows: 3, placeholder: 'Reply the bot sends' });
    resp.oninput = () => { cmd.response = resp.value; };
    const rm = el('button', { className: 'danger tiny', textContent: 'Delete' });
    rm.onclick = () => { state.config.commands.splice(i, 1); renderCommands(); };
    wrap.append(el('div', { className: 'item' }, [
      el('div', { className: 'item-head' }, [el('strong', { textContent: '/' + (cmd.name || 'command') }), rm]),
      name, desc, resp,
    ]));
  });
}

/* ----- read the form back into config ----- */
function collectForm() {
  const c = state.config;
  c.serverName = $('#serverName').value.trim();
  c.rules = { channel: $('#rulesChannel').value.trim(), title: $('#rulesTitle').value, content: $('#rulesContent').value };
  c.welcome = { channel: $('#welcomeChannel').value.trim(), message: $('#welcomeMessage').value };
  c.selfRoles = c.selfRoles || { options: [] };
  c.selfRoles.channel = $('#srChannel').value.trim();
  c.selfRoles.message = $('#srMessage').value;
  c.autoMod = {
    blockInvites: $('#amInvites').checked,
    blockLinks: $('#amLinks').checked,
    bannedWords: $('#amWords').value.split(',').map((w) => w.trim()).filter(Boolean),
  };
  return c;
}

async function save() {
  collectForm();
  overlay(true, 'Saving…');
  try {
    await api('/config/' + state.guildId, { method: 'POST', body: JSON.stringify(state.config) });
    toast('Saved ✓');
  } catch (e) { toast(e.message, true); }
  finally { overlay(false); }
}

async function applyToServer() {
  collectForm();
  if (!confirm('Apply this setup to "' + state.guildName + '"? This will create roles, channels and post messages.')) return;
  overlay(true, 'Building your server…');
  try {
    const { result, commandCount } = await api('/apply/' + state.guildId, { method: 'POST', body: JSON.stringify(state.config) });
    let msg = 'Done! +' + result.channelsCreated + ' channels, +' + result.rolesCreated + ' roles, ' + commandCount + ' commands.';
    if (result.warnings?.length) msg += ' (' + result.warnings.length + ' warnings)';
    toast(msg);
    if (result.warnings?.length) console.warn('Apply warnings:', result.warnings);
  } catch (e) { toast(e.message, true); }
  finally { overlay(false); }
}

/* ---------- wire up ---------- */
function init() {
  $('#loginBtn').onclick = doLogin;
  $('#password').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  $('#refreshGuilds').onclick = openGuilds;
  $('#backBtn').onclick = openGuilds;
  $('#saveBtn').onclick = save;
  $('#applyBtn').onclick = applyToServer;

  for (const b of document.querySelectorAll('#tabs button')) b.onclick = () => switchTab(b.dataset.tab);

  $('#addRole').onclick = () => { state.config.roles = state.config.roles || []; state.config.roles.push({ name: '', color: '#99aab5', permissions: [] }); renderRoles(); };
  $('#addCat').onclick = () => { state.config.categories = state.config.categories || []; state.config.categories.push({ name: '', channels: [] }); renderChannels(); };
  $('#addSr').onclick = () => { state.config.selfRoles = state.config.selfRoles || { options: [] }; state.config.selfRoles.options.push({ emoji: '', roleName: '', label: '' }); renderSelfRoles(); };
  $('#addCmd').onclick = () => { state.config.commands = state.config.commands || []; state.config.commands.push({ name: '', description: '', response: '' }); renderCommands(); };

  $('#applyTemplate').onclick = () => {
    const name = $('#templatePick').value;
    const tpl = loadTemplateOptions._templates?.[name];
    if (!tpl) { toast('Pick a template first', true); return; }
    if (!confirm('Replace everything with the "' + name + '" template?')) return;
    state.config = JSON.parse(JSON.stringify(tpl));
    fillForm();
    toast('Template loaded — remember to Apply');
  };

  // Auto-login if we already have a token.
  if (state.token) openGuilds().catch(() => logout());
  else show('login');
}

init();
