const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Clé API Claude
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  saveApiKey: (key) => ipcRenderer.invoke('save-api-key', key),

  // Multi-API
  getAllKeys: () => ipcRenderer.invoke('get-all-keys'),
  saveAllKeys: (keys) => ipcRenderer.invoke('save-all-keys', keys),

  // UI state
  getUiState: () => ipcRenderer.invoke('get-ui-state'),
  saveUiState: (uiState) => ipcRenderer.invoke('save-ui-state', uiState),

  // Conversations
  listConversations: (projectPath) => ipcRenderer.invoke('list-conversations', projectPath),
  getConversation: (projectPath, id) => ipcRenderer.invoke('get-conversation', projectPath, id),
  saveConversation: (projectPath, convo) => ipcRenderer.invoke('save-conversation', projectPath, convo),
  renameConversation: (projectPath, id, title) => ipcRenderer.invoke('rename-conversation', projectPath, id, title),
  deleteConversation: (projectPath, id) => ipcRenderer.invoke('delete-conversation', projectPath, id),
  getProjectMemory: (projectPath) => ipcRenderer.invoke('get-project-memory', projectPath),
  saveProjectMemory: (projectPath, payload) => ipcRenderer.invoke('save-project-memory', projectPath, payload),

  // Dossiers et fichiers
  openFolder: () => ipcRenderer.invoke('open-folder'),
  readDirectory: (path) => ipcRenderer.invoke('read-directory', path),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
  createFile: (path) => ipcRenderer.invoke('create-file', path),
  deleteFile: (path) => ipcRenderer.invoke('delete-file', path),

  // Audit logging from renderer
  auditLog: (level, message, meta) => ipcRenderer.invoke('audit-log', level, message, meta),

  // NOUVEAU : Renommer & créer dossier
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  createFolder: (folderPath) => ipcRenderer.invoke('create-folder', folderPath),

  // Terminal
  terminalStart: (projectPath) => ipcRenderer.invoke('terminal-start', projectPath),
  terminalInput: (data) => ipcRenderer.invoke('terminal-input', data),
  terminalResize: (cols, rows) => ipcRenderer.invoke('terminal-resize', cols, rows),
  terminalKill: () => ipcRenderer.invoke('terminal-kill'),
  onTerminalData: (callback) => ipcRenderer.on('terminal-data', (event, data) => callback(data)),
  removeTerminalListeners: () => ipcRenderer.removeAllListeners('terminal-data'),
});
