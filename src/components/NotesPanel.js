import React, { useEffect, useRef } from 'react';

export default function NotesPanel({ isVisible, value, onChange, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!isVisible) return;
    setTimeout(() => ref.current?.focus(), 0);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      right: 24,
      bottom: 24,
      width: 360,
      height: 260,
      zIndex: 9997,
      background: '#1e1e2e',
      border: '1px solid #333',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}>
        <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
          📝 Notes
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid #444',
            color: '#aaa',
            borderRadius: 8,
            padding: '6px 10px',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Fermer
        </button>
      </div>

      <textarea
        ref={ref}
        value={value || ''}
        onChange={e => onChange?.(e.target.value)}
        placeholder="Écris ici... (Ctrl+N pour ouvrir/fermer)"
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          outline: 'none',
          resize: 'none',
          padding: 12,
          boxSizing: 'border-box',
          background: '#0f1220',
          color: '#fff',
          fontSize: 13,
          lineHeight: 1.5,
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}
