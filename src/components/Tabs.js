import React from 'react';

/**
 * Composant Tabs — Onglets de fichiers ouverts style VS Code
 * Props :
 *   tabs        : [{ path, name, isDirty }]
 *   activeTab   : path du fichier actif
 *   onSelect    : (path) => void
 *   onClose     : (path) => void
 */
export default function Tabs({ tabs, activeTab, onSelect, onClose }) {
  if (!tabs || tabs.length === 0) return null;

  const getIcon = (name = '') => {
    const ext = name.split('.').pop();
    const icons = {
      js: '🟨', jsx: '🟨', ts: '🔷', tsx: '🔷',
      py: '🐍', html: '🌐', css: '🎨', json: '📋',
      md: '📝', png: '🖼️', jpg: '🖼️', svg: '🖼️',
    };
    return icons[ext] || '📄';
  };

  return (
    <div style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = tab.path === activeTab;
        return (
          <div
            key={tab.path}
            style={{
              ...styles.tab,
              background: isActive ? '#1e1e1e' : '#2d2d2d',
              borderTop: isActive ? '2px solid #7c3aed' : '2px solid transparent',
              color: isActive ? '#fff' : '#aaa',
            }}
            onClick={() => onSelect(tab.path)}
            title={tab.path}
          >
            <span style={{ fontSize: 12 }}>{getIcon(tab.name)}</span>
            <span style={styles.tabName}>
              {tab.isDirty && <span style={{ color: '#f59e0b', marginRight: 3 }}>●</span>}
              {tab.name}
            </span>
            <button
              style={styles.closeBtn}
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.path);
              }}
              title="Fermer"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  tabBar: {
    display: 'flex',
    flexDirection: 'row',
    background: '#2d2d2d',
    borderBottom: '1px solid #333',
    overflowX: 'auto',
    flexShrink: 0,
    scrollbarWidth: 'none',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 12px',
    height: 36,
    cursor: 'pointer',
    flexShrink: 0,
    fontSize: 13,
    userSelect: 'none',
    borderRight: '1px solid #333',
    minWidth: 100,
    maxWidth: 180,
    transition: 'background 0.15s',
  },
  tabName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 12,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    fontSize: 11,
    padding: '2px 4px',
    borderRadius: 3,
    lineHeight: 1,
    flexShrink: 0,
    transition: 'color 0.15s, background 0.15s',
  },
};
