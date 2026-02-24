import React, { useMemo, useState } from 'react';

export default function FileControlPanel({
  projectPath,
  selectedItem,
  onOpenFile,
  onRefresh,
  addToast,
}) {
  const [customPath, setCustomPath] = useState('');

  const effectivePath = useMemo(() => {
    const p = (customPath || '').trim();
    if (p) return p;
    return selectedItem?.path || '';
  }, [customPath, selectedItem?.path]);

  const canOperate = !!effectivePath;

  const normalize = (p) => (p || '').toString();

  const isSelectedDirectory = !!selectedItem?.isDirectory && normalize(selectedItem?.path) === normalize(effectivePath);

  const parentForNew = () => {
    if (isSelectedDirectory) return effectivePath;
    if (selectedItem?.path) {
      const raw = normalize(selectedItem.path);
      const idx1 = raw.lastIndexOf('\\');
      const idx2 = raw.lastIndexOf('/');
      const idx = Math.max(idx1, idx2);
      if (idx >= 0) return raw.slice(0, idx);
    }
    return projectPath || '';
  };

  const askNewName = (label) => {
    const name = window.prompt(label);
    return (name || '').toString().trim();
  };

  const handleNewFile = async () => {
    const baseDir = parentForNew();
    if (!baseDir) return;
    const name = askNewName('Nom du nouveau fichier :');
    if (!name) return;
    const full = baseDir + '\\' + name;
    try {
      await window.electron.createFile(full);
      addToast?.(`Fichier créé: ${name}`, 'success');
      onRefresh?.();
    } catch (e) {
      addToast?.(`Erreur: ${e?.message || e}`, 'error');
    }
  };

  const handleNewFolder = async () => {
    const baseDir = parentForNew();
    if (!baseDir) return;
    const name = askNewName('Nom du nouveau dossier :');
    if (!name) return;
    const full = baseDir + '\\' + name;
    try {
      await window.electron.createFolder(full);
      addToast?.(`Dossier créé: ${name}`, 'success');
      onRefresh?.();
    } catch (e) {
      addToast?.(`Erreur: ${e?.message || e}`, 'error');
    }
  };

  const handleRename = async () => {
    if (!selectedItem?.path) return;
    const name = askNewName('Nouveau nom :');
    if (!name) return;

    const raw = normalize(selectedItem.path);
    const idx1 = raw.lastIndexOf('\\');
    const idx2 = raw.lastIndexOf('/');
    const idx = Math.max(idx1, idx2);
    const parent = idx >= 0 ? raw.slice(0, idx) : '';
    const nextPath = parent ? (parent + '\\' + name) : name;

    try {
      await window.electron.renameFile(raw, nextPath);
      addToast?.('Renommé', 'success');
      setCustomPath('');
      onRefresh?.();
    } catch (e) {
      addToast?.(`Erreur: ${e?.message || e}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedItem?.path) return;
    const ok = window.confirm(`Supprimer « ${selectedItem.name} » ?`);
    if (!ok) return;
    try {
      await window.electron.deleteFile(selectedItem.path);
      addToast?.('Supprimé', 'warning');
      setCustomPath('');
      onRefresh?.();
    } catch (e) {
      addToast?.(`Erreur: ${e?.message || e}`, 'error');
    }
  };

  const handleDuplicate = async () => {
    if (!selectedItem?.path || selectedItem?.isDirectory) {
      addToast?.('Dupliquer: sélectionne un fichier', 'error');
      return;
    }

    const raw = normalize(selectedItem.path);
    const idx1 = raw.lastIndexOf('\\');
    const idx2 = raw.lastIndexOf('/');
    const idx = Math.max(idx1, idx2);
    const parent = idx >= 0 ? raw.slice(0, idx) : '';
    const baseName = idx >= 0 ? raw.slice(idx + 1) : raw;

    const suggested = baseName.includes('.')
      ? baseName.replace(/\.(?!.*\.)/, ' - copie.')
      : (baseName + ' - copie');

    const name = window.prompt('Nom de la copie :', suggested);
    const finalName = (name || '').toString().trim();
    if (!finalName) return;

    const dest = parent ? (parent + '\\' + finalName) : finalName;

    try {
      const content = await window.electron.readFile(raw);
      await window.electron.writeFile(dest, content);
      addToast?.('Copie créée', 'success');
      onRefresh?.();
    } catch (e) {
      addToast?.(`Erreur: ${e?.message || e}`, 'error');
    }
  };

  const handleMove = async () => {
    if (!selectedItem?.path) return;
    const dest = window.prompt('Chemin de destination (complet) :', selectedItem.path);
    const finalDest = (dest || '').toString().trim();
    if (!finalDest || finalDest === selectedItem.path) return;

    try {
      await window.electron.renameFile(selectedItem.path, finalDest);
      addToast?.('Déplacé', 'success');
      setCustomPath('');
      onRefresh?.();
    } catch (e) {
      addToast?.(`Erreur: ${e?.message || e}`, 'error');
    }
  };

  const handleOpenSelected = async () => {
    if (!selectedItem || selectedItem.isDirectory) return;
    await onOpenFile?.(selectedItem);
  };

  return (
    <div style={{
      padding: 10,
      borderBottom: '1px solid #333',
      background: '#202022',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ color: '#ddd', fontSize: 12, fontWeight: 'bold' }}>Contrôle fichiers</div>
        <button
          onClick={() => onRefresh?.()}
          style={{
            background: 'transparent',
            border: '1px solid #444',
            color: '#aaa',
            borderRadius: 8,
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >🔄</button>
      </div>

      <div style={{ marginTop: 8 }}>
        <input
          value={customPath}
          onChange={(e) => setCustomPath(e.target.value)}
          placeholder={selectedItem?.path ? selectedItem.path : (projectPath ? projectPath : 'Chemin...')}
          style={{
            width: '100%',
            background: '#151515',
            border: '1px solid #333',
            color: '#ddd',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
            outline: 'none',
          }}
        />
        <div style={{ marginTop: 6, color: '#777', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedItem
            ? `${selectedItem.isDirectory ? '📁' : '📄'} ${selectedItem.name}`
            : (projectPath ? 'Sélectionne un fichier/dossier' : 'Ouvre un dossier')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        <button disabled={!projectPath} onClick={handleNewFile} style={btnStyle(!projectPath)}>📄 Nouveau</button>
        <button disabled={!projectPath} onClick={handleNewFolder} style={btnStyle(!projectPath)}>📁 Dossier</button>
        <button disabled={!selectedItem?.path} onClick={handleRename} style={btnStyle(!selectedItem?.path)}>✏️ Renommer</button>
        <button disabled={!selectedItem?.path} onClick={handleMove} style={btnStyle(!selectedItem?.path)}>📦 Déplacer</button>
        <button disabled={!selectedItem?.path || !!selectedItem?.isDirectory} onClick={handleDuplicate} style={btnStyle(!selectedItem?.path || !!selectedItem?.isDirectory)}>🧬 Dupliquer</button>
        <button disabled={!selectedItem?.path} onClick={handleDelete} style={{ ...btnStyle(!selectedItem?.path), borderColor: '#7f1d1d', color: '#fca5a5' }}>🗑️ Supprimer</button>
        <button disabled={!selectedItem?.path || !!selectedItem?.isDirectory} onClick={handleOpenSelected} style={btnStyle(!selectedItem?.path || !!selectedItem?.isDirectory)}>📝 Ouvrir</button>
      </div>

      <div style={{ marginTop: 8, color: canOperate ? '#666' : '#7c3aed', fontSize: 11 }}>
        {canOperate ? 'Astuce: tu peux coller un chemin dans le champ pour opérer ailleurs.' : ''}
      </div>
    </div>
  );
}

function btnStyle(disabled) {
  return {
    background: disabled ? '#1a1a1a' : '#2a2a2a',
    border: '1px solid #444',
    color: disabled ? '#555' : '#ddd',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
  };
}
