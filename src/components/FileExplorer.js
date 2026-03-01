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

function TextPromptModal({ title, defaultValue, onCancel, onSubmit }) {
  const [value, setValue] = useState((defaultValue || '').toString());

  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.getElementById('monide-text-prompt-input-explorer');
      el && el.focus && el.focus();
      el && el.select && el.select();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 460, background: '#1e1e2e', border: '1px solid #333', borderRadius: 12, padding: 18, boxShadow: '0 12px 40px rgba(0,0,0,0.65)' }}>
        <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 14, marginBottom: 10 }}>{title}</div>
        <input
          id="monide-text-prompt-input-explorer"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel?.();
            if (e.key === 'Enter') onSubmit?.(value);
          }}
          style={{ width: '100%', background: '#151515', border: '1px solid #333', color: '#ddd', borderRadius: 8, padding: '10px 12px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
          <button onClick={() => onCancel?.()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #444', background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: 12 }}>
            Annuler
          </button>
          <button onClick={() => onSubmit?.(value)} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function FileItem({ item, onFileClick, activeFile, selectedPath, onSelectItem, projectPath, onLoadChildren, depth = 0, onRefresh, dirtyPaths = [], addToast }) {
  const [isOpen, setIsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(item.name);
  const renameInputRef = useRef(null);

  const [textPrompt, setTextPrompt] = useState({
    isOpen: false,
    title: '',
    defaultValue: '',
    resolve: null,
  });

  const askText = (title, defaultValue = '') => {
    return new Promise((resolve) => {
      setTextPrompt({ isOpen: true, title, defaultValue, resolve });
    });
  };

  const closePrompt = (value) => {
    setTextPrompt(prev => {
      try {
        if (typeof prev.resolve === 'function') prev.resolve(value);
      } catch (e) {}
      return { isOpen: false, title: '', defaultValue: '', resolve: null };
    });
  };

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
      if (window.electron?.trashFile && window.electron?.restoreFile && projectPath) {
        const res = await window.electron.trashFile(projectPath, item.path);
        addToast?.(`« ${item.name} » déplacé vers la corbeille`, 'warning', 6500, {
          label: 'Annuler',
          onClick: async () => {
            await window.electron.restoreFile(res.trashedPath, res.originalPath);
            onRefresh?.();
          }
        });
      } else {
        await window.electron.deleteFile(item.path);
        addToast?.(`« ${item.name} » supprimé`, 'warning');
      }
      onRefresh?.();
    } catch (err) {
      addToast?.(`Erreur : ${err.message}`, 'error');
    }
  };

  const handleNewFile = async () => {
    const name = ((await askText('Nom du nouveau fichier :')) || '').toString().trim();
    if (!name) return;
    const newPath = item.path + '\\' + name;
    try {
      await window.electron.createFile(newPath);
      addToast?.(`Fichier « ${name} » créé`, 'success');
      onRefresh?.();
    } catch (err) {
      addToast?.(`Erreur : ${err.message}`, 'error');
    }
  };

  const handleNewFolder = async () => {
    const name = ((await askText('Nom du nouveau dossier :')) || '').toString().trim();
    if (!name) return;
    const newPath = item.path + '\\' + name;
    try {
      await window.electron.createFolder(newPath);
      addToast?.(`Dossier « ${name} » créé`, 'success');
      onRefresh?.();
    } catch (err) {
      addToast?.(`Erreur : ${err.message}`, 'error');
    }
  };

  return (
    <div>
      {textPrompt.isOpen && (
        <TextPromptModal
          title={textPrompt.title}
          defaultValue={textPrompt.defaultValue}
          onCancel={() => closePrompt(null)}
          onSubmit={(val) => closePrompt(val)}
        />
      )}
      <div
        onContextMenu={handleRightClick}
        onClick={async () => {
          if (isRenaming) return;
          onSelectItem?.(item);
          if (item.isDirectory) {
            const nextOpen = !isOpen;
            setIsOpen(nextOpen);
            if (nextOpen) {
              await onLoadChildren?.(item);
            }
          }
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
              projectPath={projectPath}
              onLoadChildren={onLoadChildren}
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

export default function FileExplorer({ files, onFileClick, activeFile, onRefresh, dirtyPaths = [], addToast, projectPath, selectedItem, onSelectItem, onLoadChildren }) {
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
            projectPath={projectPath}
            onLoadChildren={onLoadChildren}
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
