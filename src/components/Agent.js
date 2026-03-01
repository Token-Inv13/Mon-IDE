import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_TOOLS } from '../agentTools';
import executeTool from '../utils/executeTool';
import safeContent from '../utils/safeContent';

export default function Agent({ projectPath, apiKey, onFileUpdate, activeFile }) {
  const [task, setTask] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [steps, setSteps] = useState([]);
  const logsEndRef = useRef(null);

  const addLog = (type, message) => {
    const entry = { type, message, time: new Date().toLocaleTimeString() };
    setLogs(prev => [...prev, entry]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const addStep = (icon, label, status = 'running') => {
    const id = Date.now();
    setSteps(prev => [...prev, { id, icon, label, status }]);
    return id;
  };

  const updateStep = (id, status) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  // executeTool is provided by src/utils/executeTool and imported above

  const runAgent = async () => {
    if (!task.trim() || isRunning) return;
    if (!projectPath) {
      addLog('error', '❌ Ouvre d\'abord un dossier de projet !');
      return;
    }

    setIsRunning(true);
    setLogs([]);
    setSteps([]);
      addLog('start', `🚀 Démarrage de la tâche : ${task}`);
      window.electron?.auditLog && window.electron.auditLog('info', 'Agent start', { task: task, projectPath, activeFile: activeFile?.path });

    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = `Tu es un agent de développement autonome expert.
Tu as accès à des outils pour lire, créer et modifier des fichiers, et exécuter des commandes.

Projet : ${projectPath}
${activeFile ? `Fichier actif : ${activeFile.path}` : ''}

Instructions :
- Analyse la tâche demandée
- Utilise les outils disponibles pour accomplir la tâche étape par étape
- Commence TOUJOURS par lister les fichiers du projet pour comprendre sa structure
- Lis les fichiers pertinents avant de les modifier
- Explique chaque action que tu fais
- Sois méthodique et précis
- Réponds en français`;

    const messages = [{ role: 'user', content: safeContent(task) }];
    let iteration = 0;
    const maxIterations = 20;

    try {
      while (iteration < maxIterations) {
        iteration++;
        addLog('info', `🔄 Itération ${iteration}...`);
        window.electron?.auditLog && window.electron.auditLog('info', 'Agent iteration', { iteration, task });

        let response;
        // Only use the simulated fallback when running tests (NODE_ENV === 'test')
        if (process.env.NODE_ENV === 'test' && (!client || !client.messages || typeof client.messages.create !== 'function')) {
          // Simulate first a tool_use, then an end_turn on the next iteration.
          if (!global.__agent_sim_called) {
            global.__agent_sim_called = 1;
            response = {
              content: [
                { type: 'tool_use', name: 'list_files', input: { path: '.' }, id: 't1' }
              ],
              stop_reason: 'tool_use'
            };
          } else {
            response = { content: [{ type: 'text', text: 'Terminé' }], stop_reason: 'end_turn' };
          }
        } else {
          response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: systemPrompt,
            tools: AGENT_TOOLS,
            messages
          });
        }

        // Ajouter la réponse à l'historique (coerce content en chaîne sûre)
        const respContentSafe = safeContent(response.content);
        messages.push({ role: 'assistant', content: respContentSafe });

        // Traiter les blocs de contenu
        for (const block of response.content) {
          if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
            addLog('claude', `🤖 ${block.text}`);
          }

          if (block.type === 'tool_use') {
            const stepId = addStep(
              block.name === 'read_file' ? '📖' :
              block.name === 'write_file' ? '✏️' :
              block.name === 'create_file' ? '✨' :
              block.name === 'list_files' ? '📂' : '🖥️',
              `${block.name} : ${Object.values(block.input)[0]?.substring(0, 40)}...`
            );

            window.electron?.auditLog && window.electron.auditLog('info', 'Agent tool_use', { tool: block.name, input: safeContent(block.input) });
            const toolResult = await executeTool(block.name, block.input, { addLog, onFileUpdate, activeFile, projectPath });
            window.electron?.auditLog && window.electron.auditLog('info', 'Agent tool_result', { tool: block.name, result: safeContent(toolResult) });
            const resultOutput = (toolResult && toolResult.output !== undefined && toolResult.output !== null)
              ? toolResult.output
              : (toolResult && toolResult.error ? `Erreur: ${toolResult.error}` : '');
            updateStep(stepId, 'done');

            // Ajouter le résultat de l'outil
            messages.push({
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: block.id,
                content: resultOutput
              }]
            });
          }
        }

        // Arrêter si Claude a fini
        if (response.stop_reason === 'end_turn') {
          addLog('success', '✅ Tâche terminée avec succès !');
          window.electron?.auditLog && window.electron.auditLog('info', 'Agent finished', { task });
          break;
        }

        if (response.stop_reason !== 'tool_use') {
          addLog('info', `ℹ️ Arrêt : ${response.stop_reason}`);
          break;
        }
      }

      if (iteration >= maxIterations) {
        addLog('error', '⚠️ Limite d\'itérations atteinte');
      }

    } catch (err) {
      addLog('error', `❌ Erreur agent : ${err.message}`);
      window.electron?.auditLog && window.electron.auditLog('error', `Agent error: ${err.message}`, { task });
    } finally {
      setIsRunning(false);
    }
  };

  const logColors = {
    start: '#7c3aed', claude: '#60a5fa', tool: '#34d399',
    error: '#f87171', success: '#4ade80', info: '#888'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1a1a2e' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #333',
        background: '#252535', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🤖</span>
        <div>
          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>Agent Autonome</div>
          <div style={{ color: '#888', fontSize: 11 }}>Claude agit seul sur ton projet</div>
        </div>
      </div>

      {/* Saisie de tâche */}
      <div style={{ padding: 12, borderBottom: '1px solid #333' }}>
        <textarea
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1px solid #444', background: '#1e1e2e',
            color: '#fff', fontSize: 13, resize: 'none',
            outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
            boxSizing: 'border-box'
          }}
          rows={4}
          placeholder="Décris la tâche à accomplir...
Ex: Ajoute une gestion d'erreurs à tous les fichiers JS
Ex: Crée un composant Button réutilisable
Ex: Optimise les performances du projet"
          value={task}
          onChange={e => setTask(e.target.value)}
          disabled={isRunning}
        />
        <button
          onClick={runAgent}
          disabled={isRunning || !task.trim()}
          style={{
            width: '100%', marginTop: 8, padding: '10px 0',
            borderRadius: 8, border: 'none',
            background: isRunning ? '#444' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            color: '#fff', fontSize: 14, fontWeight: 'bold',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          {isRunning ? '⏳ Agent en cours...' : '🚀 Lancer l\'agent'}
        </button>
      </div>

      {/* Étapes */}
      {steps.length > 0 && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #333',
          display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>ÉTAPES</div>
          {steps.map(step => (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span>{step.status === 'done' ? '✅' : '⏳'}</span>
              <span style={{ color: step.status === 'done' ? '#4ade80' : '#fbbf24' }}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Logs */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {logs.length === 0 && (
          <div style={{ color: '#444', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🤖</p>
            <p>L'agent attend une tâche.</p>
            <p style={{ marginTop: 8 }}>Il peut lire, créer et modifier</p>
            <p>des fichiers de façon autonome.</p>
          </div>
        )}
        {logs.map((log, i) => (
          <div key={i} style={{ marginBottom: 6, fontSize: 12, lineHeight: 1.5,
            color: logColors[log.type] || '#ccc' }}>
            <span style={{ color: '#555', marginRight: 8 }}>{log.time}</span>
            {log.message}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>

      {/* Footer */}
      {logs.length > 0 && !isRunning && (
        <div style={{ padding: 8, borderTop: '1px solid #333' }}>
          <button onClick={() => { setLogs([]); setSteps([]); }} style={{
            width: '100%', padding: '6px 0', borderRadius: 6,
            border: '1px solid #333', background: 'transparent',
            color: '#666', fontSize: 12, cursor: 'pointer'
          }}>
            🗑️ Effacer les logs
          </button>
        </div>
      )}
    </div>
  );
}

Agent.propTypes = {
  projectPath: PropTypes.string,
  apiKey: PropTypes.string,
  onFileUpdate: PropTypes.func,
  activeFile: PropTypes.shape({ path: PropTypes.string, name: PropTypes.string }),
};

Agent.defaultProps = {
  projectPath: '',
  apiKey: '',
  onFileUpdate: null,
  activeFile: null,
};