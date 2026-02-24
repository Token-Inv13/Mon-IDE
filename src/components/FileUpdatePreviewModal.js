import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function FileUpdatePreviewModal({
  isVisible,
  filePath,
  originalContent,
  proposedContent,
  onApply,
  onCancel,
}) {
  const [view, setView] = useState('diff');
  const originalRef = useRef(null);

  useEffect(() => {
    if (!isVisible) return;
    setView('diff');
    setTimeout(() => originalRef.current?.scrollIntoView({ block: 'nearest' }), 0);
  }, [isVisible]);

  const stats = useMemo(() => {
    const a = (originalContent || '').split('\n').length;
    const b = (proposedContent || '').split('\n').length;
    return { a, b };
  }, [originalContent, proposedContent]);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 24,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          width: 'min(1200px, 96vw)',
          height: 'min(720px, 92vh)',
          background: '#1e1e2e',
          border: '1px solid #333',
          borderRadius: 12,
          boxShadow: '0 10px 50px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ✅ Confirmer la modification
            {filePath ? ` — ${filePath}` : ''}
          </div>
          <div style={{ color: '#777', fontSize: 11 }}>
            {stats.a} → {stats.b} lignes
          </div>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', border: '1px solid #444', color: '#aaa', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}
          >
            Annuler
          </button>
          <button
            onClick={onApply}
            style={{ background: '#16a34a', border: 'none', color: '#fff', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
          >
            Appliquer
          </button>
        </div>

        <div style={{ padding: 12, borderBottom: '1px solid #333', display: 'flex', gap: 8 }}>
          {[
            { id: 'diff', label: 'Avant / Après' },
            { id: 'after', label: 'Après uniquement' },
            { id: 'before', label: 'Avant uniquement' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              style={{
                background: view === t.id ? '#7c3aed33' : 'transparent',
                border: '1px solid #444',
                color: view === t.id ? '#fff' : '#aaa',
                borderRadius: 8,
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {(view === 'diff' || view === 'before') && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: view === 'diff' ? '1px solid #333' : 'none' }}>
              <div style={{ padding: '8px 12px', color: '#888', fontSize: 11, borderBottom: '1px solid #2a2a2a' }}>
                Avant
              </div>
              <pre
                ref={originalRef}
                style={{
                  margin: 0,
                  padding: 12,
                  overflow: 'auto',
                  whiteSpace: 'pre',
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: '#ddd',
                  background: '#0f1220',
                  height: '100%',
                }}
              >
                {originalContent || ''}
              </pre>
            </div>
          )}

          {(view === 'diff' || view === 'after') && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', color: '#888', fontSize: 11, borderBottom: '1px solid #2a2a2a' }}>
                Après
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  overflow: 'auto',
                  whiteSpace: 'pre',
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: '#ddd',
                  background: '#0f1220',
                  height: '100%',
                }}
              >
                {proposedContent || ''}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
