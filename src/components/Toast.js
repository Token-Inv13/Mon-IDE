import React, { useEffect, useState } from 'react';

/**
 * Système de notifications Toast
 * Usage : <ToastContainer toasts={toasts} onRemove={removeToast} />
 *
 * Helper hook : useToast()
 *   const { toasts, addToast, removeToast } = useToast();
 *   addToast('Fichier sauvegardé !', 'success');
 *   Types : 'success' | 'error' | 'info' | 'warning'
 */

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return { toasts, addToast, removeToast };
}

function Toast({ toast, onRemove }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animation d'entrée
    const timer = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const colors = {
    success: { bg: '#16a34a22', border: '#16a34a66', text: '#4ade80' },
    error: { bg: '#dc262622', border: '#dc262666', text: '#f87171' },
    warning: { bg: '#f59e0b22', border: '#f59e0b66', text: '#fbbf24' },
    info: { bg: '#7c3aed22', border: '#7c3aed66', text: '#a78bfa' },
  };

  const c = colors[toast.type] || colors.info;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 8,
        background: '#1e1e2e',
        border: `1px solid ${c.border}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        color: '#fff',
        fontSize: 13,
        minWidth: 220,
        maxWidth: 340,
        cursor: 'pointer',
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
      }}
      onClick={() => onRemove(toast.id)}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icons[toast.type] || 'ℹ️'}</span>
      <span style={{ flex: 1, lineHeight: 1.4, color: c.text }}>{toast.message}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(toast.id); }}
        style={{
          background: 'none', border: 'none', color: '#555',
          cursor: 'pointer', fontSize: 12, padding: 2, flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => (
        <div key={toast.id} style={{ pointerEvents: 'all' }}>
          <Toast toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}
