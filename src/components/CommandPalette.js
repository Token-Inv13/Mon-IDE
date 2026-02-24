import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function CommandPalette({
  isVisible,
  onClose,
  items,
  placeholder = 'Rechercher un fichier ou une commande...',
  onSelect,
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isVisible) return;
    setQuery('');
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [isVisible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items
      .filter(it => {
        const hay = `${it.title} ${it.subtitle || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 50);
  }, [items, query]);

  useEffect(() => {
    if (selectedIndex >= filtered.length) setSelectedIndex(0);
  }, [filtered.length, selectedIndex]);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 9998,
        paddingTop: 80,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 640,
          background: '#1e1e2e',
          border: '1px solid #333',
          borderRadius: 12,
          boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 12, borderBottom: '1px solid #333' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
              if (e.key === 'Enter') {
                e.preventDefault();
                const item = filtered[selectedIndex];
                if (!item) return;
                onSelect(item);
                onClose();
              }
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #444',
              background: '#0f1220',
              color: '#fff',
              outline: 'none',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ marginTop: 8, color: '#666', fontSize: 11 }}>
            Entrée pour ouvrir • Esc pour fermer • ↑↓ pour naviguer
          </div>
        </div>

        <div style={{ maxHeight: 420, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 14, color: '#888', fontSize: 12 }}>
              Aucun résultat.
            </div>
          ) : (
            filtered.map((it, idx) => (
              <div
                key={it.id}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => { onSelect(it); onClose(); }}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  background: idx === selectedIndex ? '#2a2a3a' : 'transparent',
                  borderBottom: '1px solid #252535',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ color: it.color || '#7c3aed', fontSize: 14, width: 22, textAlign: 'center' }}>
                  {it.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {it.title}
                  </div>
                  {it.subtitle && (
                    <div style={{ color: '#777', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {it.subtitle}
                    </div>
                  )}
                </div>
                {it.hint && (
                  <div style={{ color: '#666', fontSize: 11 }}>
                    {it.hint}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
