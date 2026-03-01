import React, { useState, useEffect, useRef } from 'react';
import FileExplorer from './components/FileExplorer';
import Chat from './components/Chat';
import ActionPanel from './components/ActionPanel';
import TerminalComponent from './components/Terminal';
import Settings from './components/Settings';
import Tabs from './components/Tabs';
import ToastContainer, { useToast } from './components/Toast';
import CommandPalette from './components/CommandPalette';
import FileUpdatePreviewModal from './components/FileUpdatePreviewModal';
import NotesPanel from './components/NotesPanel';
import FileControlPanel from './components/FileControlPanel';

export default function App() {

  const getLanguage = (filename) => {
    const ext = (filename || '').toLowerCase().split('.').pop();
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'css': 'css',
      'html': 'html',
      'xml': 'xml',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'dockerfile': 'dockerfile',
      'vue': 'vue',
      'svelte': 'svelte',
      'dart': 'dart',
      'kotlin': 'kotlin',
      'swift': 'swift',
      'scala': 'scala',
      'r': 'r',
      'm': 'objective-c',
      'mm': 'objective-c',
    };
    return languageMap[ext] || 'plaintext';
  };

  const [apiKey, setApiKey] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [apiKeys, setApiKeys] = useState({ claude: '', codex: '', openai: '', grok: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [projectPath, setProjectPath] = useState(null);
  const [files, setFiles] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [dirtyPaths, setDirtyPaths] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [showPalette, setShowPalette] = useState(false);
  const [pendingFileUpdate, setPendingFileUpdate] = useState(null);
  const [chatProvider, setChatProvider] = useState('codex');
  const [chatModel, setChatModel] = useState('gpt-5-codex');
  const [chatBudget, setChatBudget] = useState(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const chatRef = useRef(null);
  const { toasts, addToast, removeToast } = useToast();

  const uiSaveTimerRef = useRef(null);

  useEffect(() => {
    if (window.electron?.getAllKeys) {
      window.electron.getAllKeys().then(keys => {
        if (keys?.claude) {
          setApiKey(keys.claude);
          setApiKeySaved(true);
        }
        setApiKeys(keys || { claude: '', codex: '', openai: '', grok: '' });
      }).catch(err => {
        console.error('Error loading API keys:', err);
        setApiKeys({ claude: '', codex: '', openai: '', grok: '' });
      });
      return;
    }

    try {
      const stored = localStorage.getItem('apiKeys');
      const keys = stored ? JSON.parse(stored) : null;
      if (keys?.claude) {
        setApiKey(keys.claude);
        setApiKeySaved(true);
      }
      setApiKeys(keys || { claude: '', codex: '', openai: '', grok: '' });
    } catch (e) {
      setApiKeys({ claude: '', codex: '', openai: '', grok: '' });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        let uiState = null;
        if (window.electron?.getUiState) {
          uiState = await window.electron.getUiState();
        } else {
          const stored = localStorage.getItem('uiState');
          uiState = stored ? JSON.parse(stored) : null;
        }
        if (cancelled || !uiState) return;

        if (uiState.showTerminal != null) setShowTerminal(!!uiState.showTerminal);
        if (uiState.showActions != null) setShowActions(!!uiState.showActions);
        if (uiState.terminalHeight != null) setTerminalHeight(uiState.terminalHeight);
        if (uiState.provider) setChatProvider(uiState.provider);
        if (uiState.model) setChatModel(uiState.model);
        if (uiState.budget) setChatBudget(uiState.budget);
        if (uiState.showNotes != null) setShowNotes(!!uiState.showNotes);
        if (uiState.notesText != null) setNotesText(uiState.notesText);

        if (Array.isArray(uiState.tabs)) setTabs(uiState.tabs);

        if (uiState.projectPath && window.electron?.readDirectory) {
          setProjectPath(uiState.projectPath);
          const tree = window.electron.readDirectoryV2
            ? await window.electron.readDirectoryV2(uiState.projectPath, { maxDepth: 1 })
            : await window.electron.readDirectory(uiState.projectPath);
          setFiles(tree);
        }

        if (uiState.activeTabPath && Array.isArray(uiState.tabs) && window.electron?.readFile) {
          const tab = uiState.tabs.find(t => t.path === uiState.activeTabPath);
          if (tab) {
            const content = await window.electron.readFile(tab.path);
            if (!cancelled) {
              setActiveFile({ path: tab.path, name: tab.name, isDirectory: false });
              setFileContent(content);
            }
          }
        }
      } catch (e) {
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (uiSaveTimerRef.current) clearTimeout(uiSaveTimerRef.current);
    uiSaveTimerRef.current = setTimeout(async () => {
      try {
        const uiState = {
          projectPath,
          tabs,
          activeTabPath: activeFile?.path || null,
          showTerminal,
          showActions,
          terminalHeight,
          provider: chatProvider,
          model: chatModel,
          budget: chatBudget,
          showNotes,
          notesText,
        };

        if (window.electron?.saveUiState) {
          await window.electron.saveUiState(uiState);
        } else {
          localStorage.setItem('uiState', JSON.stringify(uiState));
        }
      } catch (e) {
      }
    }, 250);

    return () => {
      if (uiSaveTimerRef.current) clearTimeout(uiSaveTimerRef.current);
    };
  }, [projectPath, tabs, activeFile?.path, showTerminal, showActions, terminalHeight, chatProvider, chatModel, chatBudget, showNotes, notesText]);

  const handleSaveApiKey = async () => {
    const next = { ...apiKeys, claude: apiKey };
    if (window.electron?.saveAllKeys) {
      await window.electron.saveAllKeys(next);
    } else {
      localStorage.setItem('apiKeys', JSON.stringify(next));
    }
    setApiKeys(next);
    setApiKeySaved(true);
  };

  const handleOpenFolder = async () => {
    if (!window.electron?.openFolder) {
      addToast('Electron n\'est pas disponible', 'error');
      return;
    }
    try {
      const path = await window.electron.openFolder();
      if (path) {
        setProjectPath(path);
        const tree = window.electron.readDirectoryV2
          ? await window.electron.readDirectoryV2(path, { maxDepth: 1 })
          : await window.electron.readDirectory(path);
        setFiles(tree);
      }
    } catch (err) {
      addToast(`Erreur: ${err.message}`, 'error');
    }
  };

  const flattenFiles = (items, acc = []) => {
    for (const it of items || []) {
      if (it.isDirectory) {
        if (it.children) flattenFiles(it.children, acc);
      } else {
        acc.push(it);
      }
    }
    return acc;
  };

  const refreshTree = async () => {
    if (!projectPath) return;
    const tree = window.electron.readDirectoryV2
      ? await window.electron.readDirectoryV2(projectPath, { maxDepth: 1 })
      : await window.electron.readDirectory(projectPath);
    setFiles(tree);
  };

  const updateTreeNode = (items, targetPath, updater) => {
    return (items || []).map(it => {
      if (it.path === targetPath) return updater(it);
      if (it.isDirectory && it.children && it.children.length > 0) {
        return { ...it, children: updateTreeNode(it.children, targetPath, updater) };
      }
      return it;
    });
  };

  const loadChildren = async (dirItem) => {
    if (!dirItem?.isDirectory) return;
    if (!projectPath) return;
    if (!window.electron?.readDirectoryV2) return;
    if (dirItem.childrenLoaded) return;
    try {
      const children = await window.electron.readDirectoryV2(dirItem.path, { maxDepth: 1 });
      setFiles(prev => updateTreeNode(prev, dirItem.path, (node) => ({ ...node, children, childrenLoaded: true })));
    } catch (e) {
      addToast(`Erreur: ${e?.message || e}`, 'error');
    }
  };

  useEffect(() => {
    const handler = (e) => {
      const tag = (e.target?.tagName || '').toString().toLowerCase();
      const isTypingTarget = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
      if (isTypingTarget) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSaveFile();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setShowPalette(true);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setShowNotes(v => !v);
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        if (e.shiftKey) {
          setTabs([]);
          setDirtyPaths([]);
          setActiveFile(null);
          setFileContent('');
          return;
        }
        const pathToClose = activeFile?.path;
        if (!pathToClose) return;
        const remaining = tabs.filter(t => t.path !== pathToClose);
        setTabs(remaining);
        setDirtyPaths(prev => prev.filter(p => p !== pathToClose));
        if (remaining.length > 0) {
          const next = remaining[Math.max(0, remaining.length - 1)];
          openFile({ path: next.path, name: next.name, isDirectory: false });
        } else {
          setActiveFile(null);
          setFileContent('');
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
        if (!tabs || tabs.length < 2) return;
        e.preventDefault();
        const idx = Math.max(0, tabs.findIndex(t => t.path === activeFile?.path));
        const delta = e.shiftKey ? -1 : 1;
        const nextIdx = (idx + delta + tabs.length) % tabs.length;
        const next = tabs[nextIdx];
        if (!next) return;
        openFile({ path: next.path, name: next.name, isDirectory: false });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeFile, fileContent, tabs, dirtyPaths]);

  const paletteItems = React.useMemo(() => {
    const result = [];
    if (projectPath) {
      const flat = flattenFiles(files);
      for (const f of flat) {
        result.push({
          id: `file:${f.path}`,
          type: 'file',
          icon: '📄',
          color: '#7c3aed',
          title: f.name,
          subtitle: f.path,
          data: f,
        });
      }
    }

    result.unshift(
      { id: 'cmd:open_folder', type: 'command', icon: '📁', color: '#7c3aed', title: 'Ouvrir un dossier', hint: 'Cmd' },
      { id: 'cmd:save', type: 'command', icon: '💾', color: '#16a34a', title: 'Sauvegarder le fichier actif', hint: 'Ctrl+S' },
      { id: 'cmd:toggle_actions', type: 'command', icon: '⚡', color: '#7c3aed', title: showActions ? 'Masquer Actions' : 'Afficher Actions' },
      { id: 'cmd:toggle_terminal', type: 'command', icon: '🖥️', color: '#888', title: showTerminal ? 'Masquer Terminal' : 'Afficher Terminal' },
      { id: 'cmd:open_settings', type: 'command', icon: '🔑', color: '#aaa', title: 'Configurer les APIs' },
      { id: 'cmd:toggle_notes', type: 'command', icon: '📝', color: '#aaa', title: showNotes ? 'Masquer Notes' : 'Afficher Notes' },
    );

    return result;
  }, [files, projectPath, showActions, showTerminal, showNotes]);

  const handlePaletteSelect = async (item) => {
    if (!item) return;
    if (item.type === 'file') {
      await openFile({ ...item.data, isDirectory: false });
      return;
    }
    switch (item.id) {
      case 'cmd:open_folder':
        await handleOpenFolder();
        break;
      case 'cmd:save':
        await handleSaveFile();
        break;
      case 'cmd:toggle_actions':
        setShowActions(v => !v);
        break;
      case 'cmd:toggle_terminal':
        setShowTerminal(v => !v);
        break;
      case 'cmd:open_settings':
        setShowSettings(true);
        break;
      case 'cmd:toggle_notes':
        setShowNotes(v => !v);
        break;
      default:
        break;
    }
  };

  const handleAction = (prompt, label) => {
    setTimeout(() => {
      if (chatRef.current) chatRef.current.sendExternalMessage(prompt, label);
    }, 100);
  };

  async function handleSaveFile() {
    if (activeFile) {
      await window.electron.writeFile(activeFile.path, fileContent);
      setDirtyPaths(prev => prev.filter(p => p !== activeFile.path));
      setTabs(prev => prev.map(t => t.path === activeFile.path ? { ...t, isDirty: false } : t));
      addToast('Fichier sauvegardé', 'success');
    }
  }

  const openFile = async (file) => {
    const content = await window.electron.readFile(file.path);
    setActiveFile(file);
    setFileContent(content);
    setSelectedItem(file);
    setTabs(prev => {
      if (prev.some(t => t.path === file.path)) return prev;
      return [...prev, { path: file.path, name: file.name, isDirty: dirtyPaths.includes(file.path) }];
    });
  };

  const handleFileClick = async (file) => {
    if (!file.isDirectory) {
      await openFile(file);
    }
  };

  if (!apiKeySaved) {
    return (
      <div style={styles.setupScreen}>
        <div style={styles.setupCard}>
          <h1 style={styles.setupTitle}>🤖 Mon IDE Claude</h1>
          <p style={styles.setupSubtitle}>Entre ta clé API Anthropic pour commencer</p>
          <input
            style={styles.setupInput}
            type="password"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveApiKey()}
          />
          <button style={styles.setupButton} onClick={handleSaveApiKey}>
            Démarrer →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>

      {/* Barre du haut */}
      <div style={styles.topBar}>
        <span style={styles.logo}>🤖 Mon IDE Claude</span>

        <button style={styles.openButton} onClick={handleOpenFolder}>
          📁 Ouvrir un dossier
        </button>

        {activeFile && (
          <button style={styles.saveButton} onClick={handleSaveFile}>
            💾 Sauvegarder
          </button>
        )}

        <div style={styles.separator} />

        <button
          style={{
            ...styles.iconButton,
            background: showActions ? '#7c3aed33' : 'transparent',
            borderColor: showActions ? '#7c3aed' : '#444'
          }}
          onClick={() => setShowActions(!showActions)}
        >
          ⚡ Actions
        </button>

        <button
          style={{
            ...styles.iconButton,
            background: showNotes ? '#33333d' : 'transparent'
          }}
          onClick={() => setShowNotes(!showNotes)}
        >
          📝 Notes
        </button>

        <button
          style={{
            ...styles.iconButton,
            background: showSettings ? '#33333d' : 'transparent'
          }}
          onClick={() => setShowSettings(true)}
        >
          🔑 APIs
        </button>

        <button
          style={{
            ...styles.iconButton,
            background: showTerminal ? '#33333d' : 'transparent'
          }}
          onClick={() => setShowTerminal(!showTerminal)}
        >
          🖥️ Terminal
        </button>

        <span style={styles.filePath}>
          {activeFile ? activeFile.path : projectPath ? projectPath : 'Aucun fichier ouvert'}
        </span>
      </div>

      <NotesPanel
        isVisible={showNotes}
        value={notesText}
        onChange={setNotesText}
        onClose={() => setShowNotes(false)}
      />

      <CommandPalette
        isVisible={showPalette}
        onClose={() => setShowPalette(false)}
        items={paletteItems}
        onSelect={handlePaletteSelect}
      />

      <FileUpdatePreviewModal
        isVisible={!!pendingFileUpdate}
        filePath={pendingFileUpdate?.path}
        originalContent={pendingFileUpdate?.originalContent}
        proposedContent={pendingFileUpdate?.content}
        onCancel={() => setPendingFileUpdate(null)}
        onApply={async () => {
          if (!pendingFileUpdate) return;
          const { path, content } = pendingFileUpdate;
          try {
            if (window.electron?.writeFile) {
              await window.electron.writeFile(path, content);
            }
            if (activeFile?.path === path) {
              setFileContent(content);
            }
            setDirtyPaths(prev => prev.filter(p => p !== path));
            setTabs(prev => prev.map(t => t.path === path ? { ...t, isDirty: false } : t));
            addToast('Modification appliquée', 'success');
            setPendingFileUpdate(null);
            refreshTree();
          } catch (err) {
            addToast(`Erreur : ${err.message}`, 'error');
          }
        }}
      />

      {/* Corps principal */}
      <div style={styles.body}>

        <Settings
          isVisible={showSettings}
          onClose={() => setShowSettings(false)}
          currentSettings={{ keys: apiKeys, budget: chatBudget }}
          onSave={async (payload) => {
            const nextKeys = payload?.keys || payload || { claude: '', codex: '', openai: '', grok: '' };
            const nextBudget = payload?.budget || null;

            if (window.electron?.saveAllKeys) {
              await window.electron.saveAllKeys(nextKeys);
            } else {
              localStorage.setItem('apiKeys', JSON.stringify(nextKeys));
            }

            setApiKeys(nextKeys);
            setChatBudget(nextBudget);
            if (nextKeys?.claude) {
              setApiKey(nextKeys.claude);
              setApiKeySaved(true);
            }
          }}
        />

        {/* Panneau d'actions */}
        <ActionPanel
          isVisible={showActions}
          onToggle={() => setShowActions(false)}
          onAction={handleAction}
        />

        {/* Sidebar fichiers */}
        <div style={styles.sidebar}>
          <FileControlPanel
            projectPath={projectPath}
            selectedItem={selectedItem}
            onOpenFile={openFile}
            onRefresh={refreshTree}
            addToast={addToast}
          />
          <FileExplorer
            files={files}
            onFileClick={handleFileClick}
            activeFile={activeFile}
            onRefresh={refreshTree}
            dirtyPaths={dirtyPaths}
            addToast={addToast}
            projectPath={projectPath}
            selectedItem={selectedItem}
            onSelectItem={(it) => setSelectedItem(it)}
            onLoadChildren={loadChildren}
          />
        </div>

        {/* Zone centrale : éditeur + terminal */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Tabs
            tabs={tabs.map(t => ({ ...t, isDirty: dirtyPaths.includes(t.path) }))}
            activeTab={activeFile?.path}
            onSelect={async (path) => {
              const tab = tabs.find(t => t.path === path);
              if (!tab) return;
              await openFile({ path: tab.path, name: tab.name, isDirectory: false });
            }}
            onClose={(path) => {
              setTabs(prev => prev.filter(t => t.path !== path));
              setDirtyPaths(prev => prev.filter(p => p !== path));
              if (activeFile?.path === path) {
                const remaining = tabs.filter(t => t.path !== path);
                if (remaining.length > 0) {
                  const last = remaining[remaining.length - 1];
                  openFile({ path: last.path, name: last.name, isDirectory: false });
                } else {
                  setActiveFile(null);
                  setFileContent('');
                }
              }
            }}
          />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeFile ? (
              <textarea
                value={fileContent}
                onChange={e => {
                  const nextVal = e.target.value ?? '';
                  setFileContent(nextVal);
                  if (activeFile) {
                    setDirtyPaths(prev => prev.includes(activeFile.path) ? prev : [...prev, activeFile.path]);
                    setTabs(prev => prev.map(t => t.path === activeFile.path ? { ...t, isDirty: true } : t));
                  }
                }}
                spellCheck={false}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box',
                  padding: 12,
                  background: '#1e1e1e',
                  color: '#d4d4d4',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: 14,
                  lineHeight: 1.5,
                  whiteSpace: 'pre',
                }}
                aria-label={`Éditeur ${getLanguage(activeFile.name)}`}
              />
            ) : (
              <div style={styles.emptyEditor}>
                <p style={{ fontSize: 48, marginBottom: 16 }}>🤖</p>
                <p style={{ fontSize: 18, marginBottom: 8, color: '#666' }}>Mon IDE Claude</p>
                <p style={{ fontSize: 13, color: '#444' }}>Ouvre un dossier pour commencer</p>
              </div>
            )}
          </div>

          {/* Terminal */}
          {showTerminal && (
            <div style={{
              height: terminalHeight,
              borderTop: '2px solid #7c3aed',
              flexShrink: 0,
              position: 'relative'
            }}>
              <div
                style={{
                  position: 'absolute', top: -4, left: 0, right: 0,
                  height: 8, cursor: 'ns-resize', zIndex: 10
                }}
                onMouseDown={(e) => {
                  const startY = e.clientY;
                  const startH = terminalHeight;
                  const onMove = (ev) => setTerminalHeight(Math.max(100, startH - (ev.clientY - startY)));
                  const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
              />
              <TerminalComponent
                isVisible={showTerminal}
                projectPath={projectPath}
              />
            </div>
          )}
        </div>

        {/* Panneau droit — Chat avec mode Agent intégré */}
        <div style={styles.rightPanel}>
          <Chat
            ref={chatRef}
            apiKeys={apiKeys}
            initialProvider={chatProvider}
            initialModel={chatModel}
            budgetOverrides={chatBudget || undefined}
            onProviderModelChange={({ provider, model }) => {
              if (provider) setChatProvider(provider);
              if (model) setChatModel(model);
            }}

            activeFile={activeFile}
            fileContent={fileContent}
            projectPath={projectPath}
            onFileUpdate={(newContent) => setFileContent(newContent)}
            onProposeFileUpdate={async ({ path, content }) => {
              try {
                let originalContent = '';
                if (activeFile?.path === path) {
                  originalContent = fileContent;
                } else if (window.electron?.readFile) {
                  originalContent = await window.electron.readFile(path);
                }
                setPendingFileUpdate({ path, content, originalContent });
              } catch (e) {
                setPendingFileUpdate({ path, content, originalContent: '' });
              }
            }}
          />
        </div>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

const styles = {
  setupScreen: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#1e1e1e'
  },
  setupCard: {
    background: '#2d2d2d', borderRadius: 12, padding: 40,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: 400
  },
  setupTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  setupSubtitle: { color: '#aaa', fontSize: 14 },
  setupInput: {
    width: '100%', padding: '12px 16px', borderRadius: 8,
    border: '1px solid #444', background: '#1e1e1e',
    color: '#fff', fontSize: 14, outline: 'none'
  },
  setupButton: {
    width: '100%', padding: '12px 0', borderRadius: 8,
    background: '#7c3aed', border: 'none', color: '#fff',
    fontSize: 16, fontWeight: 'bold', cursor: 'pointer'
  },
  container: {
    display: 'flex', flexDirection: 'column',
    height: '100vh', background: '#1e1e1e'
  },
  topBar: {
    height: 48, background: '#2d2d2d', display: 'flex',
    alignItems: 'center', padding: '0 16px', gap: 8,
    borderBottom: '1px solid #444', flexShrink: 0
  },
  logo: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginRight: 4 },
  openButton: {
    padding: '6px 14px', borderRadius: 6, background: '#7c3aed',
    border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13
  },
  saveButton: {
    padding: '6px 14px', borderRadius: 6, background: '#16a34a',
    border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13
  },
  iconButton: {
    padding: '6px 14px', borderRadius: 6, border: '1px solid #444',
    color: '#fff', cursor: 'pointer', fontSize: 13, background: 'transparent'
  },
  separator: { width: 1, height: 24, background: '#444', margin: '0 4px' },
  filePath: {
    color: '#888', fontSize: 12, marginLeft: 8, flex: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: {
    width: 200, background: '#252526',
    borderRight: '1px solid #333', overflow: 'auto', flexShrink: 0
  },
  rightPanel: {
    width: 380, background: '#252526',
    borderLeft: '1px solid #333', display: 'flex',
    flexDirection: 'column', flexShrink: 0
  },
  emptyEditor: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', height: '100%', color: '#555'
  }
};
