const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const configPath = path.join(app.getPath('userData'), 'config.json');
const logPath = path.join(app.getPath('userData'), 'main.log');
const conversationsPath = path.join(app.getPath('userData'), 'conversations.json');
const projectMemoryPath = path.join(app.getPath('userData'), 'project_memory.json');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_LOG_BACKUPS = 5;

function log(line) {
  try {
    const out = `[${new Date().toISOString()}] ${String(line)}\n`;

    try {
      // Rotate if too large
      if (fs.existsSync(logPath)) {
        const st = fs.statSync(logPath);
        if (st.size >= MAX_LOG_SIZE) {
          // Rotate backups: main.log.4 -> main.log.5, etc.
          for (let i = MAX_LOG_BACKUPS - 1; i >= 1; i--) {
            const src = `${logPath}.${i}`;
            const dst = `${logPath}.${i + 1}`;
            if (fs.existsSync(src)) {
              try { fs.renameSync(src, dst); } catch (e) { /* ignore */ }
            }
          }
          // Move current to .1
          try { fs.renameSync(logPath, `${logPath}.1`); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      // ignore rotation errors
    }

    fs.appendFileSync(logPath, out, 'utf-8');
    // Also echo to console for live debugging
    try { console.log(out.trim()); } catch (e) {}
  } catch (e) {}
}

// Audit log from renderer: level, message, optional meta
ipcMain.handle('audit-log', (event, level, message, meta) => {
  try {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    log(`[AUDIT] ${level || 'info'}: ${message}${metaStr}`);
    return true;
  } catch (e) {
    log(`audit-log error: ${e?.message || e}`);
    return false;
  }
});

function getConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {}
  return {};
}

function saveConfig(data) {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
}

function readConversationsStore() {
  try {
    if (!fs.existsSync(conversationsPath)) {
      return { version: 1, conversations: {} };
    }
    const raw = fs.readFileSync(conversationsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { version: 1, conversations: {} };
    if (!parsed.conversations || typeof parsed.conversations !== 'object') parsed.conversations = {};
    if (!parsed.version) parsed.version = 1;
    return parsed;
  } catch (e) {
    return { version: 1, conversations: {} };
  }
}

function writeConversationsStore(store) {
  try {
    fs.writeFileSync(conversationsPath, JSON.stringify(store || { version: 1, conversations: {} }, null, 2), 'utf-8');
  } catch (e) {
    log(`writeConversationsStore error: ${e?.message || e}`);
  }
}

function readProjectMemoryStore() {
  try {
    if (!fs.existsSync(projectMemoryPath)) {
      return { version: 1, memories: {} };
    }
    const raw = fs.readFileSync(projectMemoryPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { version: 1, memories: {} };
    if (!parsed.memories || typeof parsed.memories !== 'object') parsed.memories = {};
    if (!parsed.version) parsed.version = 1;
    return parsed;
  } catch (e) {
    return { version: 1, memories: {} };
  }
}

function writeProjectMemoryStore(store) {
  try {
    fs.writeFileSync(projectMemoryPath, JSON.stringify(store || { version: 1, memories: {} }, null, 2), 'utf-8');
  } catch (e) {
    log(`writeProjectMemoryStore error: ${e?.message || e}`);
  }
}

function normalizeProjectKey(projectPath) {
  return (projectPath || '').toString();
}

function ensureProjectBucket(store, projectKey) {
  if (!store.conversations[projectKey]) {
    store.conversations[projectKey] = { byId: {}, order: [] };
  }
  if (!store.conversations[projectKey].byId) store.conversations[projectKey].byId = {};
  if (!Array.isArray(store.conversations[projectKey].order)) store.conversations[projectKey].order = [];
  return store.conversations[projectKey];
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#1e1e1e',
    show: false,
    icon: path.join(__dirname, 'public', 'icon.ico')
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    log(`did-fail-load code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
  });

  win.webContents.on('render-process-gone', (event, details) => {
    log(`render-process-gone reason=${details?.reason} exitCode=${details?.exitCode}`);
  });

  win.webContents.on('unresponsive', () => {
    log('renderer unresponsive');
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    const indexPath = path.join(app.getAppPath(), 'build', 'index.html');
    log(`loading index.html from: ${indexPath}`);
    win.loadFile(indexPath);
  }

  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(createWindow);

process.on('uncaughtException', (err) => {
  log(`uncaughtException: ${err?.stack || err}`);
});

process.on('unhandledRejection', (reason) => {
  log(`unhandledRejection: ${reason?.stack || reason}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Clé API Claude ────────────────────────────────────────
ipcMain.handle('get-api-key', () => {
  return getConfig().apiKey || '';
});

ipcMain.handle('save-api-key', (event, key) => {
  const config = getConfig();
  config.apiKey = key;
  saveConfig(config);
  return true;
});

// ── Clés multi-API ────────────────────────────────────────
ipcMain.handle('get-all-keys', () => {
  const config = getConfig();
  return {
    claude: config.apiKey || '',
    openai: config.openaiKey || '',
    grok: config.grokKey || ''
  };
});

ipcMain.handle('save-all-keys', (event, keys) => {
  const config = getConfig();
  if (keys.claude) config.apiKey = keys.claude;
  if (keys.openai) config.openaiKey = keys.openai;
  if (keys.grok) config.grokKey = keys.grok;
  saveConfig(config);
  return true;
});

// ── UI state (dernier projet, onglets, provider/model, etc.) ─
ipcMain.handle('get-ui-state', () => {
  const config = getConfig();
  return config.uiState || {};
});

ipcMain.handle('save-ui-state', (event, uiState) => {
  const config = getConfig();
  config.uiState = uiState || {};
  saveConfig(config);
  return true;
});

// ── Conversations (historique local par projet) ───────────
ipcMain.handle('list-conversations', (event, projectPath) => {
  const store = readConversationsStore();
  const projectKey = normalizeProjectKey(projectPath);
  const bucket = store.conversations?.[projectKey];
  if (!bucket) return [];
  const list = (bucket.order || [])
    .map(id => bucket.byId?.[id])
    .filter(Boolean)
    .map(c => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      provider: c.provider,
      model: c.model,
    }));
  return list;
});

ipcMain.handle('get-conversation', (event, projectPath, id) => {
  const store = readConversationsStore();
  const projectKey = normalizeProjectKey(projectPath);
  const bucket = store.conversations?.[projectKey];
  const convo = bucket?.byId?.[id];
  return convo || null;
});

ipcMain.handle('save-conversation', (event, projectPath, convo) => {
  const store = readConversationsStore();
  const projectKey = normalizeProjectKey(projectPath);
  const bucket = ensureProjectBucket(store, projectKey);

  const now = Date.now();
  const id = (convo?.id || '').toString() || `c_${now}_${Math.random().toString(16).slice(2)}`;
  const existing = bucket.byId[id];
  const createdAt = existing?.createdAt || convo?.createdAt || now;
  const updatedAt = now;

  bucket.byId[id] = {
    id,
    title: (convo?.title || existing?.title || 'Conversation').toString().slice(0, 120),
    createdAt,
    updatedAt,
    provider: convo?.provider || existing?.provider || null,
    model: convo?.model || existing?.model || null,
    summary: convo?.summary || existing?.summary || '',
    messages: Array.isArray(convo?.messages) ? convo.messages : (existing?.messages || []),
  };

  bucket.order = (bucket.order || []).filter(x => x !== id);
  bucket.order.unshift(id);
  bucket.order = bucket.order.slice(0, 200);

  writeConversationsStore(store);
  return { id };
});

ipcMain.handle('rename-conversation', (event, projectPath, id, title) => {
  const store = readConversationsStore();
  const projectKey = normalizeProjectKey(projectPath);
  const bucket = store.conversations?.[projectKey];
  if (!bucket?.byId?.[id]) return false;
  bucket.byId[id].title = (title || '').toString().slice(0, 120) || 'Conversation';
  bucket.byId[id].updatedAt = Date.now();
  writeConversationsStore(store);
  return true;
});

ipcMain.handle('delete-conversation', (event, projectPath, id) => {
  const store = readConversationsStore();
  const projectKey = normalizeProjectKey(projectPath);
  const bucket = store.conversations?.[projectKey];
  if (!bucket) return false;
  if (bucket.byId) delete bucket.byId[id];
  if (Array.isArray(bucket.order)) bucket.order = bucket.order.filter(x => x !== id);
  writeConversationsStore(store);
  return true;
});
ipcMain.handle('get-project-memory', (event, projectPath) => {
  const store = readProjectMemoryStore();
  const projectKey = normalizeProjectKey(projectPath);
  const item = store.memories?.[projectKey];
  return item || { text: '', updatedAt: null };
});

ipcMain.handle('save-project-memory', (event, projectPath, payload) => {
  const store = readProjectMemoryStore();
  const projectKey = normalizeProjectKey(projectPath);
  const now = Date.now();
  const prev = store.memories?.[projectKey];
  store.memories[projectKey] = {
    text: (payload?.text || '').toString(),
    updatedAt: now,
    createdAt: prev?.createdAt || payload?.createdAt || now,
  };
  writeProjectMemoryStore(store);
  return true;
});

// ── Fichiers ──────────────────────────────────────────────
ipcMain.handle('open-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('read-directory', (event, dirPath) => {
  function readDir(currentPath) {
    try {
      const items = fs.readdirSync(currentPath, { withFileTypes: true });
      return items.map(item => {
        const fullPath = path.join(currentPath, item.name);
        return {
          name: item.name,
          path: fullPath,
          isDirectory: item.isDirectory(),
          children: item.isDirectory() ? readDir(fullPath) : null
        };
      });
    } catch (e) {
      return [];
    }
  }
  return readDir(dirPath);
});

ipcMain.handle('read-file', (event, filePath) => {
  return fs.readFileSync(filePath, 'utf-8');
});

ipcMain.handle('write-file', (event, filePath, content) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.tmp-${Date.now()}-${path.basename(filePath)}`);
    fs.writeFileSync(tmp, content, 'utf-8');
    fs.renameSync(tmp, filePath);
    return true;
  } catch (e) {
    log(`write-file error: ${e?.message || e}`);
    throw e;
  }
});

ipcMain.handle('create-file', (event, filePath) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.tmp-${Date.now()}-${path.basename(filePath)}`);
    fs.writeFileSync(tmp, '', 'utf-8');
    fs.renameSync(tmp, filePath);
    return true;
  } catch (e) {
    log(`create-file error: ${e?.message || e}`);
    throw e;
  }
});

ipcMain.handle('delete-file', (event, filePath) => {
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    fs.rmSync(filePath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(filePath);
  }
  return true;
});

// ── NOUVEAU : Renommer un fichier ou dossier ──────────────
ipcMain.handle('rename-file', (event, oldPath, newPath) => {
  fs.renameSync(oldPath, newPath);
  return true;
});

// ── NOUVEAU : Créer un dossier ────────────────────────────
ipcMain.handle('create-folder', (event, folderPath) => {
  fs.mkdirSync(folderPath, { recursive: true });
  return true;
});

// ── Terminal ──────────────────────────────────────────────
const os = require('os');

if (process.platform === 'win32') {
  process.env.NODE_PTY_DISABLE_CONPTY = '1';
}

const pty = require('node-pty');

let ptyProcess = null;

ipcMain.handle('terminal-start', (event, projectPath) => {
  const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

  ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: projectPath || process.env.HOME || process.env.USERPROFILE,
    env: process.env,
    useConpty: false
  });

  ptyProcess.onData((data) => {
    event.sender.send('terminal-data', data);
  });

  return true;
});

ipcMain.handle('terminal-input', (event, data) => {
  if (ptyProcess) ptyProcess.write(data);
});

ipcMain.handle('terminal-resize', (event, cols, rows) => {
  if (ptyProcess) ptyProcess.resize(cols, rows);
});

ipcMain.handle('terminal-kill', () => {
  if (ptyProcess) { ptyProcess.kill(); ptyProcess = null; }
});
