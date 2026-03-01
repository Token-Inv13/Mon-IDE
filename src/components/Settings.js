import React, { useState, useEffect } from 'react';

const PROVIDERS = [
  {
    id: 'claude',
    name: 'Claude',
    icon: '🤖',
    color: '#7c3aed',
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
    ],
    keyPlaceholder: 'sk-ant-...',
    keyPrefix: 'sk-ant'
  },
  {
    id: 'codex',
    name: 'Codex',
    icon: '🧠',
    color: '#22c55e',
    models: [
      { id: 'gpt-5-codex', name: 'GPT-5 Codex' },
      { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
    ],
    keyPlaceholder: 'sk-proj-... (ou sk-...)',
    keyPrefix: 'sk-'
  },
  {
    id: 'openai',
    name: 'ChatGPT',
    icon: '✨',
    color: '#10a37f',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-5', name: 'GPT-5' },
      { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
      { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
      { id: 'gpt-5.1', name: 'GPT-5.1' },
      { id: 'gpt-5-codex', name: 'GPT-5 Codex' },
      { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex' },
      { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex' },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    ],
    keyPlaceholder: 'sk-...',
    keyPrefix: 'sk-'
  },
  {
    id: 'grok',
    name: 'Grok',
    icon: '⚡',
    color: '#1d9bf0',
    models: [
      { id: 'grok-3', name: 'Grok 3' },
      { id: 'grok-3-fast', name: 'Grok 3 Fast' },
      { id: 'grok-2', name: 'Grok 2' },
    ],
    keyPlaceholder: 'xai-...',
    keyPrefix: 'xai-'
  }
];

export default function Settings({ isVisible, onClose, onSave, currentSettings }) {
  const [keys, setKeys] = useState({
    claude: '',
    codex: '',
    openai: '',
    grok: ''
  });
  const [budget, setBudget] = useState({
    enableSummarize: true,
    enableFileContext: true,
    maxHistoryMessages: 12,
    summarizeThreshold: 18,
    keepAfterSummarize: 8,
    maxFileChars: 2500,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!currentSettings) return;
    if (currentSettings.keys) {
      setKeys(currentSettings.keys);
      if (currentSettings.budget) setBudget(prev => ({ ...prev, ...currentSettings.budget }));
      return;
    }
    setKeys(currentSettings);
  }, [currentSettings]);

  const handleSave = () => {
    onSave({ keys, budget });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#1e1e2e', borderRadius: 12, padding: 32,
        width: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        border: '1px solid #333'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
            🔑 Clés API
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#666',
            cursor: 'pointer', fontSize: 18
          }}>✕</button>
        </div>

        {/* Providers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {PROVIDERS.map(provider => (
            <div key={provider.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{provider.icon}</span>
                <span style={{ color: provider.color, fontWeight: 'bold', fontSize: 14 }}>
                  {provider.name}
                </span>
                {keys[provider.id] && (
                  <span style={{ color: '#4ade80', fontSize: 11, marginLeft: 4 }}>✓ Configuré</span>
                )}
              </div>
              <input
                type="password"
                placeholder={provider.keyPlaceholder}
                value={keys[provider.id]}
                onChange={e => setKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  border: `1px solid ${keys[provider.id] ? provider.color + '66' : '#333'}`,
                  background: '#252535', color: '#fff', fontSize: 13,
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, color: '#9ca3af', fontSize: 12, lineHeight: 1.5 }}>
          💡 Conseil: sélectionne <strong style={{ color: '#22c55e' }}>Codex</strong> dans le chat puis le mode <strong>Agent</strong> pour donner à l'IA un accès complet aux fichiers du projet ouvert (lecture/écriture/exécution de commandes).
        </div>

        <div style={{ marginTop: 26, paddingTop: 18, borderTop: '1px solid #333' }}>
          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 14, marginBottom: 12 }}>
            💸 Budget tokens
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#aaa', fontSize: 12 }}>
              <input
                type="checkbox"
                checked={!!budget.enableSummarize}
                onChange={e => setBudget(prev => ({ ...prev, enableSummarize: e.target.checked }))}
              />
              Résumé automatique de l'historique
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#aaa', fontSize: 12 }}>
              <input
                type="checkbox"
                checked={!!budget.enableFileContext}
                onChange={e => setBudget(prev => ({ ...prev, enableFileContext: e.target.checked }))}
              />
              Inclure le contexte du fichier actif (si nécessaire)
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center' }}>
              <div style={{ color: '#888', fontSize: 12 }}>Historique max (messages)</div>
              <input
                type="number"
                value={budget.maxHistoryMessages}
                min={2}
                max={50}
                onChange={e => setBudget(prev => ({ ...prev, maxHistoryMessages: Number(e.target.value) }))}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #333', background: '#252535', color: '#fff' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center' }}>
              <div style={{ color: '#888', fontSize: 12 }}>Seuil résumé (messages)</div>
              <input
                type="number"
                value={budget.summarizeThreshold}
                min={4}
                max={80}
                onChange={e => setBudget(prev => ({ ...prev, summarizeThreshold: Number(e.target.value) }))}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #333', background: '#252535', color: '#fff' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center' }}>
              <div style={{ color: '#888', fontSize: 12 }}>Messages gardés après résumé</div>
              <input
                type="number"
                value={budget.keepAfterSummarize}
                min={2}
                max={30}
                onChange={e => setBudget(prev => ({ ...prev, keepAfterSummarize: Number(e.target.value) }))}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #333', background: '#252535', color: '#fff' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center' }}>
              <div style={{ color: '#888', fontSize: 12 }}>Max contexte fichier (chars)</div>
              <input
                type="number"
                value={budget.maxFileChars}
                min={0}
                max={20000}
                onChange={e => setBudget(prev => ({ ...prev, maxFileChars: Number(e.target.value) }))}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #333', background: '#252535', color: '#fff' }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 28, display: 'flex', gap: 12 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            border: '1px solid #444', background: 'transparent',
            color: '#aaa', cursor: 'pointer', fontSize: 14
          }}>
            Annuler
          </button>
          <button onClick={handleSave} style={{
            flex: 2, padding: '10px 0', borderRadius: 8,
            border: 'none', background: saved ? '#16a34a' : '#7c3aed',
            color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 'bold'
          }}>
            {saved ? '✅ Sauvegardé !' : '💾 Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
}

export { PROVIDERS };
