// Echo frontend main entry
import { initTheme, applyTheme, getEffectiveTheme, onThemeChange, cycleSetting, getSetting } from './theme.js';
import { createEditor } from './editor.js';
import { LANGUAGES, getLanguageFn } from './languages.js';
import { renderMarkdown, renderMermaidInElement, updateMermaidTheme } from './markdown.js';

// ---------- DOM refs ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const el = {
  loginView: $('#login-view'),
  chatView: $('#chat-view'),
  loginForm: $('#login-form'),
  loginPassword: $('#login-password'),
  loginError: $('#login-error'),
  loginSubmit: $('#login-submit'),

  messagesContainer: $('#messages-container'),
  messagesList: $('#messages-list'),
  loadMoreTop: $('#load-more-top'),
  loadMoreBtn: $('#load-more-btn'),
  scrollBottomAnchor: $('#scroll-bottom-anchor'),

  searchBar: $('#search-bar'),
  searchInput: $('#search-input'),
  searchBtn: $('#search-btn'),
  searchClose: $('#search-close'),
  searchClear: $('#search-clear'),

  batchBtn: $('#batch-btn'),
  batchBar: $('#batch-bar'),
  selectAllToggle: $('#select-all-toggle'),
  batchCount: $('#batch-count'),
  batchDeleteBtn: $('#batch-delete-btn'),
  batchCancelBtn: $('#batch-cancel-btn'),

  themeBtn: $('#theme-btn'),
  settingsBtn: $('#settings-btn'),

  editorHost: $('#editor-host'),
  sendBtn: $('#send-btn'),
  formatRadios: $$('input[name="format"]'),
  languageSelect: $('#language-select'),
  charCounter: $('#char-counter'),

  settingsModal: $('#settings-modal'),
  settingsClose: $('#settings-close'),
  changePasswordForm: $('#change-password-form'),
  cpCurrent: $('#cp-current'),
  cpNew: $('#cp-new'),
  cpConfirm: $('#cp-confirm'),
  cpMessage: $('#cp-message'),
  logoutBtn: $('#logout-btn'),
  settingThemeRadios: $$('input[name="setting-theme"]'),
  settingFontSize: $('#setting-font-size'),
  settingTabSize: $('#setting-tab-size'),
  settingDefaultFormatRadios: $$('input[name="setting-default-format"]'),
  settingDefaultLanguage: $('#setting-default-language'),
  settingInitialLimit: $('#setting-initial-limit'),
  settingLoadMoreLimit: $('#setting-load-more-limit'),
  settingPollInterval: $('#setting-poll-interval'),
  settingCollapseLines: $('#setting-collapse-lines'),
  settingMsgSize: $('#setting-msg-size'),

  editModal: $('#edit-modal'),
  editClose: $('#edit-close'),
  editSaveBtn: $('#edit-save-btn'),
  editEditorHost: $('#edit-editor-host'),
  editFormatRadios: $$('input[name="edit-format"]'),
  editLanguageSelect: $('#edit-language-select'),
  editCharCounter: $('#edit-char-counter'),

  toast: $('#toast'),
};

// ---------- Settings defaults ----------
const DEFAULT_SETTINGS = {
  theme: 'auto',
  fontSize: 16,
  tabSize: 4,
  defaultFormat: 'plain',
  defaultLanguage: 'javascript',
  initialLimit: 10,
  loadMoreLimit: 30,
  pollInterval: 3,
  collapseLines: 20,
  msgSize: 16,
};

const MAX_BYTES = 600 * 1024;

let settings = { ...DEFAULT_SETTINGS };

function clampInt(v, min, max, def) {
  v = parseInt(v, 10);
  if (isNaN(v)) return def;
  return Math.max(min, Math.min(max, v));
}

async function loadSettings() {
  try {
    const r = await api('/api/settings');
    if (r && r.settings) {
      settings = { ...DEFAULT_SETTINGS, ...r.settings };
    }
  } catch { /* first run, use defaults */ }
  applySettingsToUI();
  applySettingsToRuntime();
}

async function saveSettings() {
  try {
    await api('/api/settings', { method: 'POST', body: JSON.stringify(settings) });
  } catch (e) { console.warn('save settings failed', e); }
}

function applySettingsToUI() {
  // Theme
  el.settingThemeRadios.forEach(r => r.checked = (r.value === (settings.theme || 'auto')));
  el.settingFontSize.value = settings.fontSize;
  el.settingTabSize.value = settings.tabSize;
  el.settingDefaultFormatRadios.forEach(r => r.checked = (r.value === settings.defaultFormat));
  el.settingDefaultLanguage.value = settings.defaultLanguage || 'javascript';
  el.settingInitialLimit.value = settings.initialLimit;
  el.settingLoadMoreLimit.value = settings.loadMoreLimit;
  el.settingPollInterval.value = settings.pollInterval;
  el.settingCollapseLines.value = settings.collapseLines;
  el.settingMsgSize.value = settings.msgSize;
}

function applySettingsToRuntime() {
  // Apply theme
  applyTheme(settings.theme || 'auto');
  // Apply CSS var for msg font size
  document.documentElement.style.setProperty('--msg-font-size', settings.msgSize + 'px');
  // Apply editor font size + tab size to existing editors
  if (state.mainEditor) state.mainEditor.setFontSize(settings.fontSize);
  if (state.editEditor) state.editEditor.setFontSize(settings.fontSize);
  // Apply default format/language to main editor (only if user hasn't typed yet)
  if (state.mainEditor && state.mainEditor.getDoc() === '') {
    setSelectedFormat(el.formatRadios, settings.defaultFormat);
    onMainFormatChange();
  }
  // Restart polling with new interval
  if (state.pollTimer !== undefined) startPolling();
}

// ---------- State ----------
const state = {
  messages: [],          // ascending order (oldest first), newest at end
  renderedIds: new Set(),
  oldestId: null,        // smallest id rendered
  newestId: null,        // largest id rendered
  hasMore: true,
  loading: false,
  searchMode: false,
  searchQuery: '',
  selectedIds: new Set(),
  batchMode: false,
  editingMessage: null,
  mainEditor: null,
  editEditor: null,
  pollTimer: null,
  pollIntervalMs: 3000,
  draftSaveTimer: null,
  initialLoadDone: false,
};

// ---------- Utilities ----------
const toastTimers = [];
function toast(msg, type = '') {
  el.toast.textContent = msg;
  el.toast.className = 'toast ' + (type || '');
  toastTimers.forEach(t => clearTimeout(t));
  toastTimers.push(setTimeout(() => { el.toast.classList.add('hidden'); }, 2400));
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function bytesOf(s) { return new TextEncoder().encode(s).length; }

function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KiB';
  return (n / 1024 / 1024).toFixed(2) + ' MiB';
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  let rel;
  if (diff < 60) rel = '刚刚';
  else if (diff < 3600) rel = Math.floor(diff/60) + ' 分钟前';
  else if (diff < 86400) rel = Math.floor(diff/3600) + ' 小时前';
  else if (diff < 86400 * 7) rel = Math.floor(diff/86400) + ' 天前';
  else rel = d.toLocaleDateString();
  const full = d.toLocaleString();
  return { rel, full };
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const err = new Error(data?.error || ('HTTP ' + res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---------- Auth ----------
async function checkAuth() {
  try {
    const r = await api('/api/status');
    return r.authenticated;
  } catch { return false; }
}

async function doLogin(password) {
  await api('/api/login', { method: 'POST', body: JSON.stringify({ password }) });
}

async function doLogout() {
  try { await api('/api/logout', { method: 'POST' }); } catch {}
  location.reload();
}

async function changePassword(current, next, confirm) {
  return api('/api/password', { method: 'POST', body: JSON.stringify({ current, next, confirm }) });
}

// ---------- Messages rendering ----------
function messageNode(m) {
  const node = document.createElement('div');
  node.className = 'msg';
  node.dataset.id = m.id;

  const { rel, full } = formatTime(m.created_at);
  const formatBadge = m.format === 'code'
    ? `<span class="msg-format-badge code">${escapeHtml(m.language || 'code')}</span>`
    : m.format === 'markdown'
      ? `<span class="msg-format-badge markdown">MD</span>`
      : '';
  const editedBadge = m.is_edited ? '<span class="msg-edited-badge">(已编辑)</span>' : '';

  node.innerHTML = `
    <input type="checkbox" class="msg-checkbox" data-id="${m.id}" />
    <div class="msg-header">
      ${formatBadge}
      ${editedBadge}
      <span class="msg-time" title="${escapeHtml(full)}">${escapeHtml(rel)}</span>
      <div class="msg-actions">
        <button class="icon-btn btn-copy" title="复制">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="icon-btn btn-edit" title="编辑">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        </button>
        <button class="icon-btn btn-delete" title="删除">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>
    <div class="msg-content ${m.format === 'code' ? 'code' : m.format === 'markdown' ? 'markdown' : 'plain'}"></div>
  `;

  const contentEl = node.querySelector('.msg-content');

  // Render content
  if (m.format === 'markdown') {
    renderMarkdown(m.content).then(html => {
      contentEl.innerHTML = html;
      applyCollapse(contentEl);
      renderMermaidInElement(contentEl);
    });
  } else if (m.format === 'code') {
    contentEl.textContent = m.content;
    import('highlight.js').then(({ default: hljs }) => {
      try {
        const lang = m.language;
        let result;
        if (lang && hljs.getLanguage(lang)) {
          result = hljs.highlight(m.content, { language: lang });
        } else {
          result = hljs.highlightAuto(m.content);
        }
        contentEl.innerHTML = result.value;
        contentEl.classList.add('hljs');
      } catch (e) { console.warn('hljs failed', e); }
      applyCollapse(contentEl);
    });
  } else {
    contentEl.textContent = m.content;
    applyCollapse(contentEl);
  }

  // Buttons
  node.querySelector('.btn-copy').addEventListener('click', (e) => {
    e.stopPropagation();
    copyText(m.content);
  });
  node.querySelector('.btn-edit').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditModal(m);
  });
  node.querySelector('.btn-delete').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm('确定删除这条消息？')) return;
    try {
      await api(`/api/messages/${m.id}`, { method: 'DELETE' });
      removeMessageNode(m.id);
      toast('已删除', 'ok');
    } catch (err) { toast('删除失败: ' + err.message, 'err'); }
  });

  // Long-press / checkbox
  node.querySelector('.msg-checkbox').addEventListener('change', (e) => {
    const id = parseInt(e.target.dataset.id, 10);
    if (e.target.checked) state.selectedIds.add(id);
    else state.selectedIds.delete(id);
    updateBatchCount();
  });

  // Long-press (mobile) to enter batch mode and select
  let pressTimer;
  node.addEventListener('touchstart', () => {
    pressTimer = setTimeout(() => {
      if (!state.batchMode) enterBatchMode();
      const cb = node.querySelector('.msg-checkbox');
      if (cb) {
        cb.checked = true;
        state.selectedIds.add(parseInt(cb.dataset.id, 10));
        updateBatchCount();
      }
    }, 500);
  }, { passive: true });
  node.addEventListener('touchend', () => { clearTimeout(pressTimer); });
  node.addEventListener('touchmove', () => { clearTimeout(pressTimer); }, { passive: true });

  return node;
}

function applyCollapse(contentEl) {
  const threshold = settings.collapseLines || 20;
  if (threshold <= 0) return;
  // Approximate line count: count lines in text content + count block elements
  const textLines = contentEl.textContent.split('\n').length;
  const blockEls = contentEl.querySelectorAll('p, li, pre, h1, h2, h3, h4, h5, h6, div, tr');
  const effectiveLines = Math.max(textLines, blockEls.length);
  if (effectiveLines > threshold) {
    contentEl.classList.add('collapsed');
    const toggleWrap = document.createElement('div');
    toggleWrap.className = 'msg-collapse-wrap';
    const toggle = document.createElement('button');
    toggle.className = 'msg-collapse-toggle';
    toggle.type = 'button';
    toggle.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg> 展开全部';
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      contentEl.classList.toggle('collapsed');
      if (contentEl.classList.contains('collapsed')) {
        toggle.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg> 展开全部';
      } else {
        toggle.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg> 收起';
      }
    });
    toggleWrap.appendChild(toggle);
    contentEl.parentElement.appendChild(toggleWrap);
  }
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(
    () => toast('已复制', 'ok'),
    () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast('已复制', 'ok'); }
      catch { toast('复制失败', 'err'); }
      document.body.removeChild(ta);
    }
  );
}

function removeMessageNode(id) {
  const node = el.messagesList.querySelector(`.msg[data-id="${id}"]`);
  if (node) node.remove();
  state.messages = state.messages.filter(m => m.id !== id);
  state.renderedIds.delete(id);
  // Update bounds
  if (state.messages.length) {
    state.oldestId = Math.min(...state.messages.map(m => m.id));
    state.newestId = Math.max(...state.messages.map(m => m.id));
  } else {
    showEmpty();
  }
}

// Insert message in DOM ordered ASCENDING by id (oldest at top, newest at bottom)
function insertMessageNode(m) {
  // Replace if exists
  const existing = el.messagesList.querySelector(`.msg[data-id="${m.id}"]`);
  if (existing) {
    const updated = messageNode(m);
    existing.replaceWith(updated);
    const idx = state.messages.findIndex(x => x.id === m.id);
    if (idx >= 0) state.messages[idx] = m;
    return;
  }
  // Hide empty state if visible
  hideEmpty();

  // Find insertion point — after all nodes with smaller id
  const nodes = el.messagesList.querySelectorAll('.msg');
  let inserted = false;
  for (const n of nodes) {
    if (parseInt(n.dataset.id, 10) > m.id) {
      el.messagesList.insertBefore(messageNode(m), n);
      inserted = true;
      break;
    }
  }
  if (!inserted) {
    el.messagesList.appendChild(messageNode(m));
  }
  state.messages.push(m);
  state.renderedIds.add(m.id);
  if (!state.oldestId || m.id < state.oldestId) state.oldestId = m.id;
  if (!state.newestId || m.id > state.newestId) state.newestId = m.id;
}

// ---------- Loading ----------
async function loadInitial() {
  state.loading = true;
  try {
    const limit = settings.initialLimit;
    const url = state.searchMode
      ? `/api/search?q=${encodeURIComponent(state.searchQuery)}&limit=${limit}`
      : `/api/messages?limit=${limit}`;
    const data = await api(url);
    // data.messages is DESC (newest first); we want ascending render (oldest at top)
    const ascending = data.messages.slice().reverse();
    state.messages = ascending.slice();
    state.renderedIds = new Set(ascending.map(m => m.id));
    state.oldestId = ascending.length ? ascending[0].id : null;
    state.newestId = ascending.length ? ascending[ascending.length - 1].id : null;
    state.hasMore = data.hasMore;

    el.messagesList.innerHTML = '';
    ascending.forEach(m => el.messagesList.appendChild(messageNode(m)));

    if (!ascending.length) showEmpty();
    else hideEmpty();

    if (state.hasMore) el.loadMoreTop.classList.remove('hidden');
    else el.loadMoreTop.classList.add('hidden');

    // Scroll to bottom (newest is at bottom)
    requestAnimationFrame(() => scrollToBottom());
  } catch (err) {
    toast('加载失败: ' + err.message, 'err');
  } finally {
    state.loading = false;
    state.initialLoadDone = true;
  }
}

async function loadMore() {
  if (state.loading || !state.hasMore) return;
  state.loading = true;
  try {
    const limit = settings.loadMoreLimit;
    const url = state.searchMode
      ? `/api/search?q=${encodeURIComponent(state.searchQuery)}&before=${state.oldestId}&limit=${limit}`
      : `/api/messages?before=${state.oldestId}&limit=${limit}`;
    const data = await api(url);
    if (!data.messages.length) { state.hasMore = false; el.loadMoreTop.classList.add('hidden'); return; }
    // data.messages is DESC; oldest at end
    const ascending = data.messages.slice().reverse();
    state.messages = ascending.concat(state.messages);
    state.oldestId = ascending[0].id;
    state.hasMore = data.hasMore;

    // Preserve scroll position: insert at top
    const prevHeight = el.messagesContainer.scrollHeight;
    const prevTop = el.messagesContainer.scrollTop;

    const frag = document.createDocumentFragment();
    ascending.forEach(m => {
      frag.appendChild(messageNode(m));
      state.renderedIds.add(m.id);
    });
    el.messagesList.insertBefore(frag, el.messagesList.firstChild);

    // Restore scroll
    const newHeight = el.messagesContainer.scrollHeight;
    el.messagesContainer.scrollTop = prevTop + (newHeight - prevHeight);

    if (!state.hasMore) el.loadMoreTop.classList.add('hidden');
  } catch (err) {
    toast('加载更多失败: ' + err.message, 'err');
  } finally {
    state.loading = false;
  }
}

async function pollForNew() {
  if (state.searchMode || state.batchMode) return;
  if (!state.initialLoadDone) return;
  try {
    // Fetch latest N (more than enough to cover what we don't have yet)
    const data = await api(`/api/messages?limit=100`);
    let newCount = 0;
    // data.messages is DESC; iterate in ascending order for insertion
    const ascending = data.messages.slice().reverse();
    for (const m of ascending) {
      if (!state.renderedIds.has(m.id)) {
        // New message — append to bottom
        insertMessageNode(m);
        newCount++;
      } else {
        // Check if edited
        const existing = state.messages.find(x => x.id === m.id);
        if (existing && (existing.updated_at !== m.updated_at || existing.content !== m.content || existing.is_edited !== m.is_edited)) {
          insertMessageNode(m);
        }
      }
    }
    if (newCount > 0) {
      const container = el.messagesContainer;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
      if (isNearBottom) scrollToBottom();
    }
  } catch (err) {
    console.warn('Poll failed', err);
  }
}

function showEmpty() {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.id = 'empty-state';
  empty.innerHTML = '<span class="emoji">📭</span>暂无消息<br/>在下方编辑框发送第一条消息吧';
  el.messagesList.appendChild(empty);
}
function hideEmpty() {
  const e = $('#empty-state');
  if (e) e.remove();
}

function scrollToBottom() {
  if (el.scrollBottomAnchor) {
    el.scrollBottomAnchor.scrollIntoView({ behavior: 'auto', block: 'end' });
  } else {
    el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
  }
}

// ---------- Send / Edit ----------
function getSelectedFormat(radios) {
  for (const r of radios) if (r.checked) return r.value;
  return 'plain';
}

function setSelectedFormat(radios, value) {
  for (const r of radios) r.checked = (r.value === value);
}

function populateLanguageSelect(sel) {
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  for (const lang of LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = lang.id;
    opt.textContent = lang.label;
    sel.appendChild(opt);
  }
}

function updateCharCounter(text, counter) {
  const bytes = bytesOf(text);
  counter.textContent = `${formatBytes(bytes)} / 600 KiB`;
  counter.classList.toggle('warn', bytes > MAX_BYTES);
}

function getCurrentEditorState(radios, langSel) {
  return {
    format: getSelectedFormat(radios),
    language: getSelectedFormat(radios) === 'code' ? (langSel.value || 'plaintext') : null,
  };
}

async function sendMessage() {
  if (!state.mainEditor) return;
  const content = state.mainEditor.getDoc();
  if (!content.trim()) return;
  if (bytesOf(content) > MAX_BYTES) { toast('消息超过 600 KiB', 'err'); return; }
  const { format, language } = getCurrentEditorState(el.formatRadios, el.languageSelect);

  el.sendBtn.disabled = true;
  try {
    const data = await api('/api/messages', { method: 'POST', body: JSON.stringify({ content, format, language }) });
    insertMessageNode(data.message);
    // Clear draft + editor
    state.mainEditor.setDoc('');
    updateCharCounter('', el.charCounter);
    saveDraft(true); // clear
    requestAnimationFrame(() => scrollToBottom());
  } catch (err) {
    toast('发送失败: ' + err.message, 'err');
  } finally {
    el.sendBtn.disabled = false;
  }
}

function openEditModal(m) {
  state.editingMessage = m;
  if (!state.editEditor) {
    state.editEditor = createEditor(el.editEditorHost, {
      initialDoc: '',
      language: null,
      tabSize: settings.tabSize,
      fontSize: settings.fontSize,
      onChange: (text) => updateCharCounter(text, el.editCharCounter),
      onSend: () => saveEdit(),
    });
    populateLanguageSelect(el.editLanguageSelect);
    el.editFormatRadios.forEach(r => r.addEventListener('change', () => onEditFormatChange()));
    el.editLanguageSelect.addEventListener('change', () => {
      if (state.editEditor) state.editEditor.setLanguage(el.editLanguageSelect.value === 'plaintext' ? null : el.editLanguageSelect.value);
    });
  }
  state.editEditor.setDoc(m.content);
  setSelectedFormat(el.editFormatRadios, m.format);
  if (m.format === 'code') {
    el.editLanguageSelect.value = m.language || 'plaintext';
    el.editLanguageSelect.classList.remove('hidden');
    state.editEditor.setLanguage(m.language || null);
  } else {
    el.editLanguageSelect.classList.add('hidden');
    state.editEditor.setLanguage(m.format === 'markdown' ? 'markdown' : null);
  }
  updateCharCounter(m.content, el.editCharCounter);
  el.editModal.classList.remove('hidden');
  setTimeout(() => state.editEditor && state.editEditor.focus(), 50);
}

function onEditFormatChange() {
  const fmt = getSelectedFormat(el.editFormatRadios);
  if (fmt === 'code') {
    el.editLanguageSelect.classList.remove('hidden');
    if (el.editLanguageSelect.value === 'plaintext' || !el.editLanguageSelect.value) {
      el.editLanguageSelect.value = settings.defaultLanguage || 'javascript';
    }
    state.editEditor.setLanguage(el.editLanguageSelect.value);
  } else if (fmt === 'markdown') {
    el.editLanguageSelect.classList.add('hidden');
    state.editEditor.setLanguage('markdown');
  } else {
    el.editLanguageSelect.classList.add('hidden');
    state.editEditor.setLanguage(null);
  }
}

async function saveEdit() {
  if (!state.editEditor || !state.editingMessage) return;
  const content = state.editEditor.getDoc();
  if (!content) { toast('内容不能为空', 'err'); return; }
  if (bytesOf(content) > MAX_BYTES) { toast('消息超过 600 KiB', 'err'); return; }
  const { format, language } = getCurrentEditorState(el.editFormatRadios, el.editLanguageSelect);

  el.editSaveBtn.disabled = true;
  try {
    const data = await api(`/api/messages/${state.editingMessage.id}`, { method: 'PUT', body: JSON.stringify({ content, format, language }) });
    insertMessageNode(data.message);
    closeEditModal();
    toast('已更新', 'ok');
  } catch (err) {
    toast('保存失败: ' + err.message, 'err');
  } finally {
    el.editSaveBtn.disabled = false;
  }
}

function closeEditModal() {
  el.editModal.classList.add('hidden');
  state.editingMessage = null;
}

// ---------- Search ----------
function openSearch() {
  state.searchMode = true;
  el.searchBar.classList.remove('hidden');
  el.searchInput.value = state.searchQuery || '';
  el.searchInput.focus();
}

function closeSearch() {
  state.searchMode = false;
  state.searchQuery = '';
  el.searchBar.classList.add('hidden');
  el.searchInput.value = '';
  loadInitial();
}

async function doSearch(q) {
  state.searchQuery = q;
  state.oldestId = null;
  state.newestId = null;
  state.hasMore = true;
  await loadInitial();
}

// ---------- Batch ----------
function enterBatchMode() {
  state.batchMode = true;
  document.body.classList.add('batch-mode');
  el.batchBar.classList.remove('hidden');
  el.batchBtn.classList.add('active');
  updateBatchCount();
}

function exitBatchMode() {
  state.batchMode = false;
  state.selectedIds.clear();
  document.body.classList.remove('batch-mode');
  el.batchBar.classList.add('hidden');
  el.batchBtn.classList.remove('active');
  el.selectAllToggle.checked = false;
  $$('.msg-checkbox').forEach(cb => { cb.checked = false; });
  updateBatchCount();
}

function updateBatchCount() {
  el.batchCount.textContent = `已选 ${state.selectedIds.size} 条`;
  el.batchDeleteBtn.disabled = state.selectedIds.size === 0;
}

async function batchDelete() {
  if (!state.selectedIds.size) return;
  if (!confirm(`确定删除选中的 ${state.selectedIds.size} 条消息？`)) return;
  const ids = Array.from(state.selectedIds);
  try {
    await api('/api/messages/batch-delete', { method: 'POST', body: JSON.stringify({ ids }) });
    ids.forEach(id => removeMessageNode(id));
    state.selectedIds.clear();
    updateBatchCount();
    toast(`已删除 ${ids.length} 条`, 'ok');
    if (state.messages.length === 0) showEmpty();
  } catch (err) {
    toast('删除失败: ' + err.message, 'err');
  }
}

// ---------- Draft (cross-device sync) ----------
async function loadDraft() {
  try {
    const r = await api('/api/draft');
    if (r && r.draft && r.draft.content) {
      state.mainEditor.setDoc(r.draft.content);
      setSelectedFormat(el.formatRadios, r.draft.format || 'plain');
      onMainFormatChange();
      if (r.draft.format === 'code' && r.draft.language) {
        el.languageSelect.value = r.draft.language;
        state.mainEditor.setLanguage(r.draft.language);
      }
      updateCharCounter(r.draft.content, el.charCounter);
    } else {
      // Apply default format
      setSelectedFormat(el.formatRadios, settings.defaultFormat);
      onMainFormatChange();
    }
  } catch { /* ignore */ }
}

let draftSaving = false;
async function saveDraft(clear = false) {
  if (!state.mainEditor) return;
  const content = clear ? '' : state.mainEditor.getDoc();
  const { format, language } = getCurrentEditorState(el.formatRadios, el.languageSelect);
  if (draftSaving) return;
  draftSaving = true;
  try {
    if (clear || !content) {
      await api('/api/draft', { method: 'DELETE' });
    } else {
      await api('/api/draft', { method: 'POST', body: JSON.stringify({ content, format, language }) });
    }
  } catch (e) {
    console.warn('draft save failed', e);
  } finally {
    draftSaving = false;
  }
}

function scheduleDraftSave() {
  clearTimeout(state.draftSaveTimer);
  state.draftSaveTimer = setTimeout(() => saveDraft(false), 800);
}

// ---------- Settings ----------
function openSettings() {
  // Sync UI with current settings
  applySettingsToUI();
  el.settingsModal.classList.remove('hidden');
}

function closeSettings() {
  el.settingsModal.classList.add('hidden');
  el.cpMessage.textContent = '';
  el.cpMessage.className = 'form-message';
  el.changePasswordForm.reset();
}

function readSettingsFromUI() {
  const next = { ...settings };
  next.theme = (el.settingThemeRadios.find(r => r.checked) || {}).value || 'auto';
  next.fontSize = clampInt(el.settingFontSize.value, 12, 32, 16);
  next.tabSize = clampInt(el.settingTabSize.value, 2, 8, 4);
  next.defaultFormat = (el.settingDefaultFormatRadios.find(r => r.checked) || {}).value || 'plain';
  next.defaultLanguage = el.settingDefaultLanguage.value || 'javascript';
  next.initialLimit = clampInt(el.settingInitialLimit.value, 5, 100, 10);
  next.loadMoreLimit = clampInt(el.settingLoadMoreLimit.value, 5, 100, 30);
  next.pollInterval = clampInt(el.settingPollInterval.value, 0, 60, 3);
  next.collapseLines = clampInt(el.settingCollapseLines.value, 0, 500, 20);
  next.msgSize = clampInt(el.settingMsgSize.value, 12, 24, 16);
  return next;
}

// Wire up settings live-preview + save on change
function wireSettingsInputs() {
  const inputs = [
    el.settingFontSize, el.settingTabSize, el.settingInitialLimit,
    el.settingLoadMoreLimit, el.settingPollInterval, el.settingCollapseLines,
    el.settingMsgSize, el.settingDefaultLanguage,
  ];
  for (const inp of inputs) {
    inp.addEventListener('change', async () => {
      settings = readSettingsFromUI();
      applySettingsToRuntime();
      await saveSettings();
      toast('设置已保存', 'ok');
    });
  }
  // Theme radios
  el.settingThemeRadios.forEach(r => r.addEventListener('change', async () => {
    if (r.checked) {
      settings.theme = r.value;
      applyTheme(r.value);
      await saveSettings();
    }
  }));
  // Default format radios
  el.settingDefaultFormatRadios.forEach(r => r.addEventListener('change', async () => {
    if (r.checked) {
      settings.defaultFormat = r.value;
      await saveSettings();
    }
  }));
}

// ---------- Editor setup ----------
function setupMainEditor() {
  state.mainEditor = createEditor(el.editorHost, {
    initialDoc: '',
    language: null,
    placeholder: '在此输入要传输的文本…（草稿自动同步到云端）',
    tabSize: settings.tabSize,
    fontSize: settings.fontSize,
    onSend: sendMessage,
    onChange: (text) => {
      updateCharCounter(text, el.charCounter);
      scheduleDraftSave();
    },
  });
  populateLanguageSelect(el.languageSelect);
  el.formatRadios.forEach(r => r.addEventListener('change', () => {
    onMainFormatChange();
    scheduleDraftSave(); // language/format change also saves draft
  }));
  el.languageSelect.addEventListener('change', () => {
    if (state.mainEditor) state.mainEditor.setLanguage(el.languageSelect.value === 'plaintext' ? null : el.languageSelect.value);
    scheduleDraftSave();
  });
}

function onMainFormatChange() {
  const fmt = getSelectedFormat(el.formatRadios);
  if (fmt === 'code') {
    el.languageSelect.classList.remove('hidden');
    if (el.languageSelect.value === 'plaintext' || !el.languageSelect.value) {
      el.languageSelect.value = settings.defaultLanguage || 'javascript';
    }
    state.mainEditor.setLanguage(el.languageSelect.value);
  } else if (fmt === 'markdown') {
    el.languageSelect.classList.add('hidden');
    state.mainEditor.setLanguage('markdown');
  } else {
    el.languageSelect.classList.add('hidden');
    state.mainEditor.setLanguage(null);
  }
}

// ---------- Polling ----------
function startPolling() {
  stopPolling();
  const sec = settings.pollInterval || 0;
  if (sec <= 0) return; // disabled
  state.pollIntervalMs = sec * 1000;
  state.pollTimer = setInterval(pollForNew, state.pollIntervalMs);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('focus', onWindowFocus);
  window.addEventListener('blur', onWindowBlur);
}

function stopPolling() {
  if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('focus', onWindowFocus);
  window.removeEventListener('blur', onWindowBlur);
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    pollForNew();
    if (!state.pollTimer && settings.pollInterval > 0) {
      state.pollTimer = setInterval(pollForNew, settings.pollInterval * 1000);
    }
  } else {
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
  }
}

function onWindowFocus() {
  pollForNew();
  if (!state.pollTimer && settings.pollInterval > 0) {
    state.pollTimer = setInterval(pollForNew, settings.pollInterval * 1000);
  }
}

function onWindowBlur() {
  if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
}

// ---------- Init ----------
async function showChatView() {
  el.loginView.classList.add('hidden');
  el.chatView.classList.remove('hidden');
  setupMainEditor();
  await loadInitial();
  await loadDraft(); // load cross-device draft after editor is set up
  startPolling();
}

async function init() {
  initTheme();

  // Listen for theme changes -> re-render mermaid + update CodeMirror themes
  onThemeChange((effective) => {
    updateMermaidTheme(effective);
    if (state.mainEditor) state.mainEditor.setTheme(effective);
    if (state.editEditor) state.editEditor.setTheme(effective);
    renderMermaidInElement(el.messagesList);
  });

  // Populate language selects up-front
  populateLanguageSelect(el.languageSelect);
  populateLanguageSelect(el.editLanguageSelect);
  populateLanguageSelect(el.settingDefaultLanguage);
  el.settingDefaultLanguage.value = settings.defaultLanguage;

  // Login form
  el.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = el.loginPassword.value;
    el.loginError.textContent = '';
    el.loginSubmit.disabled = true;
    try {
      await doLogin(pw);
      await loadSettings();
      await showChatView();
    } catch (err) {
      el.loginError.textContent = err.message || '登录失败';
    } finally {
      el.loginSubmit.disabled = false;
    }
  });

  // Send button
  el.sendBtn.addEventListener('click', sendMessage);

  // Theme cycle button (top bar)
  el.themeBtn.addEventListener('click', async () => {
    cycleSetting();
    // persist to settings too
    settings.theme = getSetting();
    el.settingThemeRadios.forEach(r => r.checked = (r.value === settings.theme));
    await saveSettings();
    const eff = getEffectiveTheme();
    toast(`主题: ${settings.theme === 'auto' ? '跟随系统' : settings.theme === 'dark' ? '深色' : '浅色'} (${eff === 'dark' ? '深色' : '浅色'})`);
  });

  // Settings modal
  el.settingsBtn.addEventListener('click', openSettings);
  el.settingsClose.addEventListener('click', closeSettings);
  el.settingsModal.querySelector('.modal-backdrop').addEventListener('click', closeSettings);
  el.logoutBtn.addEventListener('click', doLogout);
  wireSettingsInputs();

  // Change password
  el.changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.cpMessage.textContent = '';
    el.cpMessage.className = 'form-message';
    const current = el.cpCurrent.value;
    const next = el.cpNew.value;
    const confirmPw = el.cpConfirm.value;
    try {
      await changePassword(current, next, confirmPw);
      el.cpMessage.textContent = '密码已更新';
      el.cpMessage.className = 'form-message ok';
      el.changePasswordForm.reset();
    } catch (err) {
      el.cpMessage.textContent = err.message || '修改失败';
      el.cpMessage.className = 'form-message err';
    }
  });

  // Edit modal
  el.editClose.addEventListener('click', closeEditModal);
  el.editSaveBtn.addEventListener('click', saveEdit);
  el.editModal.querySelector('.modal-backdrop').addEventListener('click', closeEditModal);

  // Search
  el.searchBtn.addEventListener('click', () => {
    if (state.searchMode) closeSearch();
    else openSearch();
  });
  el.searchClose.addEventListener('click', closeSearch);
  el.searchClear.addEventListener('click', async () => {
    el.searchInput.value = '';
    state.searchQuery = '';
    state.searchMode = false;
    await loadInitial();
  });
  let searchDebounce;
  el.searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
      const q = el.searchInput.value.trim();
      if (!q) {
        // Empty input -> exit search mode
        if (state.searchMode) {
          state.searchMode = false;
          state.searchQuery = '';
          await loadInitial();
        }
        return;
      }
      if (q === state.searchQuery && state.searchMode) return;
      state.searchMode = true;
      await doSearch(q);
    }, 250);
  });
  // Enter key on search input -> immediate search
  el.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchDebounce);
      const q = el.searchInput.value.trim();
      if (!q) return;
      state.searchMode = true;
      doSearch(q);
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  });

  // Batch mode toggle button (top bar)
  el.batchBtn.addEventListener('click', () => {
    if (state.batchMode) exitBatchMode();
    else enterBatchMode();
  });
  el.batchCancelBtn.addEventListener('click', exitBatchMode);
  el.batchDeleteBtn.addEventListener('click', batchDelete);
  el.selectAllToggle.addEventListener('change', () => {
    const checked = el.selectAllToggle.checked;
    $$('.msg-checkbox').forEach(cb => {
      cb.checked = checked;
      const id = parseInt(cb.dataset.id, 10);
      if (checked) state.selectedIds.add(id);
      else state.selectedIds.delete(id);
    });
    updateBatchCount();
  });

  // Load more button + infinite scroll to top
  el.loadMoreBtn.addEventListener('click', loadMore);
  el.messagesContainer.addEventListener('scroll', () => {
    if (el.messagesContainer.scrollTop < 50 && state.hasMore && !state.loading) {
      loadMore();
    }
  });

  // Check auth and show appropriate view
  try {
    const authed = await checkAuth();
    if (authed) {
      await loadSettings();
      await showChatView();
    } else {
      el.loginView.classList.remove('hidden');
    }
  } catch {
    el.loginView.classList.remove('hidden');
  }
}

init();
