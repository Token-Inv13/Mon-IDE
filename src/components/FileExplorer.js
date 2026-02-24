import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * FileExplorer amélioré :
 * - Clic droit pour menu contextuel (renommer, supprimer, nouveau fichier/dossier)
 * - Indicateur de fichier modifié (dirty)
 * - Animation d'ouverture des dossiers
 */

function ContextMenu({ x, y, item, onRename, onDelete, onNewFile, onNewFolder, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const menuItems = item.isDirectory
    ? [
        { icon: '📄', label: 'Nouveau fichier', action: onNewFile },
        { icon: '📁', label: 'Nouveau dossier', action: onNewFolder },
        null,
        { icon: '✏️', label: 'Renommer', action: onRename },
        { icon: '🗑️', label: 'Supprimer', action: onDelete, danger: true },
      ]
    : [
        { icon: '✏️', label: 'Renommer', action: onRename },
        { icon: '🗑️', label: 'Supprimer', action: onDelete, danger: true },
      ];

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: y,
        left: x,
        background: '#2d2d3d',
        border: '1px solid #444',
        borderRadius: 8,
        overflow: 'hidden',
        zIndex: 9000,
        minWidth: 170,
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ padding: '6px 12px', color: '#666', fontSize: 10, borderBottom: '1px solid #333', background: '#252535' }}>
        {item.name}
      </div>
      {menuItems.map((mi, i) => {
        if (!mi) return <div key={i} style={{ height: 1, background: '#333', margin: '2px 0' }} />;
        return (
          <div
            key={i}
            onClick={() => { mi.action(); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px', cursor: 'pointer', fontSize: 13,
              color: mi.danger ? '#f87171' : '#ccc',
            }}
            onMouseEnter={e => e.currentTarget.style.background = mi.danger ? '#f8717122' : '#3a3a4a'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span>{mi.icon}</span>
            <span>{mi.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function FileItem({ item, onFileClick, activeFile, selectedPath, onSelectItem, depth = 0, onRefresh, dirtyPaths = [], addToast }) {
  const [isOpen, setIsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(item.name);
  const renameInputRef = useRef(null);

  const isActive = activeFile && activeFile.path === item.path;
  const isSelected = selectedPath && selectedPath === item.path;
  const isDirty = dirtyPaths.includes(item.path);

  useEffect(() => {
    if (isRenaming) renameInputRef.current?.focus();
  }, [isRenaming]);

  const getIcon = () => {
    if (item.isDirectory) return isOpen ? '📂' : '📁';
    const ext = item.name.split('.').pop();
    const icons = {
      js: '🟨', jsx: '🟨', ts: '🔷', tsx: '🔷',
      py: '🐍', html: '🌐', css: '🎨', json: '📋',
      md: '📝', png: '🖼️', jpg: '🖼️', svg: '🖼️',
      sh: '⚙️', bat: '⚙️', yml: '⚙️', yaml: '⚙️',
    };
    return icons[ext] || '📄';
  };

  const handleRightClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectItem?.(item);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRename = async () => {
    if (!newName.trim() || newName === item.name) {
      setIsRenaming(false);
      return;
    }
    const parentPath = item.path.substring(0, item.path.lastIndexOf('\\')) ||
                       item.path.substring(0, item.path.lastIndexOf('/'));
    const newPath = parentPath + '\\' + newName.trim();
    try {
      await window.electron.renameFile(item.path, newPath);
      addToast?.(`Renommé en « ${newName.trim()} »`, 'success');
      onRefresh?.();
    } catch (err) {
      addToast?.(`Erreur : ${err.message}`, 'error');
    }
    setIsRenaming(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Supprimer « ${item.name} » ?`)) return;
    try {
      await window.electron.deleteFile(item.path);
      addToast?.(`« ${item.name} » supprimé`, 'warning');
      onRefresh?.();
    } catch (err) {
      addToast?.(`Erreur : ${err.message}`, 'error');
    }
  };

  const handleNewFile = async () => {
    const name = window.prompt('Nom du nouveau fichier :');
    if (!name?.trim()) return;
    const newPath = item.path + '\\' + name.trim();
    try {
      await window.electron.createFile(newPath);
      addToast?.(`Fichier « ${name.trim()} » créé`, 'success');
      onRefresh?.();
    } catch (err) {
      addToast?.(`Erreur : ${err.message}`, 'error');
    }
  };

  const handleNewFolder = async () => {
    const name = window.prompt('Nom du nouveau dossier :');
    if (!name?.trim()) return;
    const newPath = item.path + '\\' + name.trim();
    try {
      await window.electron.createFolder(newPath);
      addToast?.(`Dossier « ${name.trim()} » créé`, 'success');
      onRefresh?.();
    } catch (err) {
      addToast?.(`Erreur : ${err.message}`, 'error');
    }
  };

  return (
    <div>
      <div
        onContextMenu={handleRightClick}
        onClick={() => {
          if (isRenaming) return;
          onSelectItem?.(item);
          if (item.isDirectory) setIsOpen(!isOpen);
          else onFileClick(item);
        }}
        style={{
          padding: '4px 8px',
          paddingLeft: 8 + depth * 16,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: isActive ? '#fff' : '#ccc',
          background: isActive ? '#37373d' : isSelected ? '#2b2340' : 'transparent',
          borderRadius: 4,
          userSelect: 'none',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#2a2d2e'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isSelected ? '#2b2340' : 'transparent'; }}
      >
        <span style={{ fontSize: 13 }}>{getIcon()}</span>

        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') { setIsRenaming(false); setNewName(item.name); }
            }}
            onBlur={handleRename}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1, background: '#1e1e1e', border: '1px solid #7c3aed',
              color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 13,
              outline: 'none',
            }}
          />
        ) : (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {isDirty && <span style={{ color: '#f59e0b', marginRight: 3, fontSize: 10 }}>●</span>}
            {item.name}
          </span>
        )}
      </div>

      {item.isDirectory && isOpen && item.children && (
        <div>
          {item.children.map((child, i) => (
            <FileItem
              key={i}
              item={child}
              onFileClick={onFileClick}
              activeFile={activeFile}
              selectedPath={selectedPath}
              onSelectItem={onSelectItem}
              depth={depth + 1}
              onRefresh={onRefresh}
              dirtyPaths={dirtyPaths}
              addToast={addToast}
            />
          ))}
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={item}
          onRename={() => { setIsRenaming(true); setNewName(item.name); }}
          onDelete={handleDelete}
          onNewFile={handleNewFile}
          onNewFolder={handleNewFolder}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

export default function FileExplorer({ files, onFileClick, activeFile, onRefresh, dirtyPaths = [], addToast, selectedItem, onSelectItem }) {
  const selectedPath = selectedItem?.path || null;
  return (
    <div style={{ padding: '8px 4px', height: '100%', overflow: 'auto' }}>
      <div style={{
        color: '#888', fontSize: 11, padding: '4px 8px',
        textTransform: 'uppercase', letterSpacing: 1,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Explorateur</span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Actualiser"
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12 }}
          >
            🔄
          </button>
        )}
      </div>

      {files.length === 0 ? (
        <div style={{ color: '#555', fontSize: 12, padding: '16px 8px', textAlign: 'center' }}>
          Ouvre un dossier pour commencer
        </div>
      ) : (
        files.map((file, i) => (
          <FileItem
            key={i}
            item={file}
            onFileClick={onFileClick}
            activeFile={activeFile}
            selectedPath={selectedPath}
            onSelectItem={onSelectItem}
            onRefresh={onRefresh}
            dirtyPaths={dirtyPaths}
            addToast={addToast}
          />
        ))
      )}
    </div>
  );
}

FileExplorer.propTypes = {
  files: PropTypes.arrayOf(PropTypes.object),
  onFileClick: PropTypes.func,
  activeFile: PropTypes.object,
  onRefresh: PropTypes.func,
  dirtyPaths: PropTypes.arrayOf(PropTypes.string),
  addToast: PropTypes.func,
  selectedItem: PropTypes.object,
  onSelectItem: PropTypes.func,
};

FileExplorer.defaultProps = {
  files: [],
  onFileClick: null,
  activeFile: null,
  onRefresh: null,
  dirtyPaths: [],
  addToast: null,
  selectedItem: null,
  onSelectItem: null,
};
