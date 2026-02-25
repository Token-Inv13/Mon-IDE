import React, { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import MessageRenderer from './MessageRenderer';
import safeContent from '../utils/safeContent';
import { AGENT_TOOLS } from '../agentTools';
import executeTool from '../utils/executeTool';

const PROVIDERS = [
  {
    id: 'claude',
    name: 'Claude',
    icon: '🤖',
    color: '#7c3aed',
    models: [
      { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6' },
      { id: 'claude-opus-4-6', name: 'Opus 4.6' },
      { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' },
    ]
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
    ]
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
    ]
  }
];


// Convertir les tools du format Claude au format OpenAI
const convertToolsToOpenAI = (tools) => {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema // Renommer input_schema → parameters
    }
  }));
};

const MODES = [
  { id: 'chat', label: 'Chat', icon: '💬', description: 'Claude répond et suggère' },
  { id: 'agent', label: 'Agent', icon: '🤖', description: 'Claude agit et modifie les fichiers' },
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const Chat = forwardRef(function Chat({
  apiKeys = { claude: '', openai: '', grok: '' },
  activeFile,
  fileContent,
  projectPath,
  onFileUpdate,
  onProposeFileUpdate,
  initialProvider,
  initialModel,
  onProviderModelChange,
  budgetOverrides,
}, ref) {
  const [messages, setMessages] = useState([]);
  const [conversationSummary, setConversationSummary] = useState('');
  const [projectMemory, setProjectMemory] = useState('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('chat');
  const [provider, setProvider] = useState('claude');
  const [model, setModel] = useState('claude-sonnet-4-6');

  const [pendingImages, setPendingImages] = useState([]);
  const imageInputRef = useRef(null);

  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [currentAction, setCurrentAction] = useState(null);
  const messagesEndRef = useRef(null);
  const modeMenuRef = useRef(null);
  const providerMenuRef = useRef(null);

  const projectMemorySaveTimerRef = useRef(null);
  const projectMemoryUpdateTimerRef = useRef(null);

  const [conversationId, setConversationId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const saveTimerRef = useRef(null);

  const currentProvider = useMemo(() => {
    return PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];
  }, [provider]);

  const currentMode = useMemo(() => {
    return MODES.find(m => m.id === mode) || MODES[0];
  }, [mode]);

  const getProjectKey = (p) => (p || '').toString() || '__no_project__';

  const storageKeyForProject = (p) => `conversations:${getProjectKey(p)}`;

  const projectMemoryStorageKeyForProject = (p) => `projectMemory:${getProjectKey(p)}`;

  const getProjectMemoryValue = async () => {
    try {
      if (window.electron?.getProjectMemory) {
        const res = await window.electron.getProjectMemory(projectPath || '');
        return (res?.text || '').toString();
      }
      const raw = localStorage.getItem(projectMemoryStorageKeyForProject(projectPath));
      const parsed = raw ? JSON.parse(raw) : null;
      return (parsed?.text || '').toString();
    } catch (e) {
      return '';
    }
  };

  const saveProjectMemoryValue = async (text) => {
    const payload = { text: (text || '').toString() };
    try {
      if (window.electron?.saveProjectMemory) {
        await window.electron.saveProjectMemory(projectPath || '', payload);
        return;
      }
      localStorage.setItem(projectMemoryStorageKeyForProject(projectPath), JSON.stringify({ ...payload, updatedAt: Date.now() }));
    } catch (e) {
    }
  };

  const listConversations = async () => {
    if (window.electron?.listConversations) {
      return await window.electron.listConversations(projectPath || '');
    }
    const raw = localStorage.getItem(storageKeyForProject(projectPath));
    const parsed = raw ? JSON.parse(raw) : { byId: {}, order: [] };
    return (parsed.order || [])
      .map(id => parsed.byId?.[id])
      .filter(Boolean)
      .map(c => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
        provider: c.provider,
        model: c.model,
      }));
  };

  const getConversation = async (id) => {
    if (!id) return null;
    if (window.electron?.getConversation) {
      return await window.electron.getConversation(projectPath || '', id);
    }
    const raw = localStorage.getItem(storageKeyForProject(projectPath));
    const parsed = raw ? JSON.parse(raw) : { byId: {}, order: [] };
    return parsed.byId?.[id] || null;
  };

  const saveConversation = async (payload) => {
    if (window.electron?.saveConversation) {
      return await window.electron.saveConversation(projectPath || '', payload);
    }
    const key = storageKeyForProject(projectPath);
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : { byId: {}, order: [] };
    if (!parsed.byId || typeof parsed.byId !== 'object') parsed.byId = {};
    if (!Array.isArray(parsed.order)) parsed.order = [];

    const now = Date.now();
    const id = (payload?.id || '').toString() || `c_${now}_${Math.random().toString(16).slice(2)}`;
    const existing = parsed.byId[id];
    parsed.byId[id] = {
      id,
      title: (payload?.title || existing?.title || 'Conversation').toString().slice(0, 120),
      createdAt: existing?.createdAt || payload?.createdAt || now,
      updatedAt: now,
      provider: payload?.provider || existing?.provider || null,
      model: payload?.model || existing?.model || null,
      summary: payload?.summary || existing?.summary || '',
      messages: Array.isArray(payload?.messages) ? payload.messages : (existing?.messages || []),
    };

    parsed.order = parsed.order.filter(x => x !== id);
    parsed.order.unshift(id);
    parsed.order = parsed.order.slice(0, 200);
    localStorage.setItem(key, JSON.stringify(parsed));
    return { id };
  };

  const renameConversation = async (id, title) => {
    if (!id) return false;
    if (window.electron?.renameConversation) {
      return await window.electron.renameConversation(projectPath || '', id, title);
    }
    const key = storageKeyForProject(projectPath);
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : { byId: {}, order: [] };
    if (!parsed.byId?.[id]) return false;
    parsed.byId[id].title = (title || '').toString().slice(0, 120) || 'Conversation';
    parsed.byId[id].updatedAt = Date.now();
    localStorage.setItem(key, JSON.stringify(parsed));
    return true;
  };

  const deleteConversation = async (id) => {
    if (!id) return false;
    if (window.electron?.deleteConversation) {
      return await window.electron.deleteConversation(projectPath || '', id);
    }
    const key = storageKeyForProject(projectPath);
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : { byId: {}, order: [] };
    if (parsed.byId) delete parsed.byId[id];
    parsed.order = (parsed.order || []).filter(x => x !== id);
    localStorage.setItem(key, JSON.stringify(parsed));
    return true;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listConversations();
        if (!cancelled) setHistoryItems(list);
      } catch (e) {
        if (!cancelled) setHistoryItems([]);
      }
    })();
    return () => { cancelled = true; };
  }, [projectPath]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mem = await getProjectMemoryValue();
      if (!cancelled) setProjectMemory(mem);
    })();
    return () => { cancelled = true; };
  }, [projectPath]);

  useEffect(() => {
    if (!projectPath) return;
    if (projectMemorySaveTimerRef.current) clearTimeout(projectMemorySaveTimerRef.current);
    projectMemorySaveTimerRef.current = setTimeout(() => {
      saveProjectMemoryValue(projectMemory || '');
    }, 600);
    return () => {
      if (projectMemorySaveTimerRef.current) clearTimeout(projectMemorySaveTimerRef.current);
    };
  }, [projectPath, projectMemory]);

  useEffect(() => {
    if (!projectPath) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (!messages || messages.length === 0) return;

    saveTimerRef.current = setTimeout(async () => {
      try {
        const firstUser = messages.find(m => m.role === 'user');
        const title = (firstUser?.content || `${currentProvider.name} • ${new Date().toLocaleString()}`)
          .toString()
          .slice(0, 80);
        const res = await saveConversation({
          id: conversationId,
          title,
          provider,
          model,
          summary: conversationSummary || '',
          messages,
        });
        if (res?.id && res.id !== conversationId) setConversationId(res.id);
        const list = await listConversations();
        setHistoryItems(list);
      } catch (e) {
      }
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [projectPath, messages, conversationSummary, provider, model, conversationId, currentProvider.name]);

  useEffect(() => {
    if (initialProvider) setProvider(initialProvider);
    if (initialModel) setModel(initialModel);
  }, [initialProvider, initialModel]);

  const canUseImagesForCurrentProvider = () => {
    if (mode === 'agent') return false;
    if (provider !== 'openai') return false;
    return true;
  };

  const handlePickImages = () => {
    imageInputRef.current?.click();
  };

  const handleImageFilesSelected = async (files) => {
    try {
      const list = Array.from(files || []).filter(f => (f?.type || '').startsWith('image/'));
      if (list.length === 0) return;
      const readers = list.slice(0, 4).map(file => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          name: file.name,
          mime: file.type,
          dataUrl: reader.result,
        });
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      }));
      const results = (await Promise.all(readers)).filter(Boolean);
      setPendingImages(prev => {
        const merged = [...prev, ...results];
        return merged.slice(0, 4);
      });
    } catch (e) {
    }
  };

  const buildOpenAIMultimodalUserContent = (text, images) => {
    const parts = [];
    const t = (text || '').toString();
    if (t.trim()) parts.push({ type: 'text', text: t });
    for (const img of images || []) {
      if (!img?.dataUrl) continue;
      parts.push({ type: 'image_url', image_url: { url: img.dataUrl } });
    }
    return parts.length > 0 ? parts : [{ type: 'text', text: '' }];
  };

  const getBudgetConfig = () => {
    const isAgent = mode === 'agent';
    const base = {
      enableSummarize: true,
      enableFileContext: true,
      maxHistoryMessages: isAgent ? 18 : 12,
      summarizeThreshold: isAgent ? 28 : 18,
      keepAfterSummarize: isAgent ? 10 : 8,
      maxSummaryChars: 1800,
      maxFileChars: isAgent ? 0 : (provider === 'claude' ? 4500 : 2500),
    };

    const o = budgetOverrides || {};
    const next = { ...base };
    if (typeof o.enableSummarize === 'boolean') next.enableSummarize = o.enableSummarize;
    if (typeof o.enableFileContext === 'boolean') next.enableFileContext = o.enableFileContext;
    if (Number.isFinite(o.maxHistoryMessages)) next.maxHistoryMessages = Math.max(2, Math.floor(o.maxHistoryMessages));
    if (Number.isFinite(o.summarizeThreshold)) next.summarizeThreshold = Math.max(4, Math.floor(o.summarizeThreshold));
    if (Number.isFinite(o.keepAfterSummarize)) next.keepAfterSummarize = Math.max(2, Math.floor(o.keepAfterSummarize));
    if (Number.isFinite(o.maxSummaryChars)) next.maxSummaryChars = Math.max(200, Math.floor(o.maxSummaryChars));
    if (Number.isFinite(o.maxFileChars)) next.maxFileChars = Math.max(0, Math.floor(o.maxFileChars));

    return next;
  };

  const compactText = (text, maxChars) => {
    const t = (text || '').toString();
    if (t.length <= maxChars) return t;
    const head = Math.max(0, Math.floor(maxChars * 0.6));
    const tail = Math.max(0, maxChars - head);
    return t.slice(0, head) + '\n... (tronqué)\n' + t.slice(Math.max(0, t.length - tail));
  };

  const shouldIncludeFileContext = (userText) => {
    if (mode !== 'chat') return false;
    const cfg = getBudgetConfig();
    if (!cfg.enableFileContext) return false;
    const t = (userText || '').toLowerCase();
    if (!t.trim()) return false;
    if (t.includes('<file>')) return true;
    if (t.includes('fichier actif') || t.includes('ce fichier') || t.includes('ce code')) return true;
    if (t.includes('bug') || t.includes('erreur') || t.includes('stack') || t.includes('trace')) return true;
    if (t.includes('refactor') || t.includes('corrige') || t.includes('fix') || t.includes('optimise')) return true;
    if (t.includes('explique') || t.includes('comprendre')) return true;
    if (t.includes('diff') || t.includes('patch')) return true;
    return false;
  };

  const buildSystemPrompt = (userTextForBudget = '') => {
    let prompt = mode === 'agent'
      ? `Tu es un agent de développement autonome expert. Tu as ACCÈS DIRECT aux outils listés et TU DOIS LES UTILISER pour accomplir les tâches.
    - Quand tu exécutes une tâche, APPELLE L'OUTIL approprié (read_file, write_file, create_file, list_files, run_command) au lieu de seulement décrire ce que tu ferais.
    - Pour OpenAI: utilise le mécanisme de function-calling (appelle les fonctions fournies).
    - Commence par lister les fichiers si nécessaire, lis les fichiers pertinents avant de les modifier.
    - Explique chaque action succinctement après son exécution.
    - Réponds en français.`
      : `Tu es un assistant de développement expert intégré dans un IDE.
Quand tu modifies du code, écris TOUJOURS le fichier complet entre balises <file>contenu</file>.
Sois concis et précis. Réponds en français.`;

    if (projectPath) prompt += `\n\nProjet : ${projectPath}`;
    if (activeFile) prompt += `\nFichier actif : ${activeFile.path}`;
    const cfg = getBudgetConfig();
    if (projectMemory?.trim()) {
      const max = Math.max(300, Math.min(3000, Math.floor(cfg.maxSummaryChars * 0.8)));
      prompt += `\n\nMémoire projet (auto) :\n${compactText(projectMemory.trim(), max)}`;
    }
    if (conversationSummary?.trim()) {
      prompt += `\n\nRésumé de la conversation :\n${compactText(conversationSummary.trim(), cfg.maxSummaryChars)}`;
    }
    if (fileContent && mode === 'chat' && cfg.maxFileChars > 0 && shouldIncludeFileContext(userTextForBudget)) {
      const truncated = compactText(fileContent, cfg.maxFileChars);
      prompt += `\n\nContenu (extrait) :\n\`\`\`\n${truncated}\n\`\`\``;
    }
    return prompt;
  };

  const buildProjectMemoryPrompt = ({ existingMemory, recentLines }) => {
    const existing = (existingMemory || '').toString().trim();
    const recent = (recentLines || '').toString().trim();
    return `Tu maintiens une MEMOIRE PROJET persistante pour un IDE.
Objectif: conserver uniquement les informations stables et réutilisables.

Règles:
- Réponds uniquement par le texte de la mémoire mise à jour (pas d'explications).
- Format concis, en français, avec sections courtes.
- Inclure: objectifs, décisions d'architecture, conventions, commandes utiles, pièges connus, TODOs importants.
- Exclure: bavardage, détails temporaires, logs, tokens, ou messages de faible valeur.
- Garde la mémoire à ~500-1200 mots maximum.

MEMOIRE ACTUELLE:
${existing || '(vide)'}

NOUVEAUX ELEMENTS (conversation récente):

${recent || '(rien)'}

MEMOIRE MISE A JOUR:`;
  };

  const updateProjectMemoryFromMessages = async (allMessages) => {
    if (!projectPath) return;
    if (mode === 'agent') return;
    const userAssistant = (allMessages || []).filter(m => m.role === 'user' || m.role === 'assistant');
    if (userAssistant.length < 4) return;

    const last = userAssistant.slice(-12);
    const recentLines = last
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${sanitizeForSummary(m.content)}`)
      .join('\n');

    const prompt = buildProjectMemoryPrompt({ existingMemory: projectMemory, recentLines });

    try {
      const next = provider === 'claude'
        ? await summarizeWithClaude(prompt)
        : await summarizeWithOpenAI(prompt);
      const cleaned = compactText((next || '').trim(), 9000);
      if (cleaned) setProjectMemory(cleaned);
    } catch (e) {
    }
  };

  useEffect(() => {
    if (!projectPath) return;
    if (!messages || messages.length === 0) return;
    if (mode === 'agent') return;
    if (projectMemoryUpdateTimerRef.current) clearTimeout(projectMemoryUpdateTimerRef.current);
    projectMemoryUpdateTimerRef.current = setTimeout(() => {
      updateProjectMemoryFromMessages(messages);
    }, 4500);
    return () => {
      if (projectMemoryUpdateTimerRef.current) clearTimeout(projectMemoryUpdateTimerRef.current);
    };
  }, [projectPath, messages, provider, model, mode]);

  const toApiMessages = (msgs) => msgs.map(m => ({ role: m.role, content: m.content }));

  function sanitizeForSummary(text) {
    return (text || '')
      .toString()
      .replace(/<file>[\s\S]*?<\/file>/g, '');
  }

  async function summarizeWithClaude(summaryPrompt) {
    const client = new Anthropic({ apiKey: apiKeys?.claude, dangerouslyAllowBrowser: true });
    const res = await client.messages.create({
      model,
      max_tokens: 300,
      system: 'Tu produis un résumé très concis. Réponds uniquement par le résumé.',
      messages: [{ role: 'user', content: summaryPrompt }]
    });
    const txt = (res?.content || []).map(b => b.type === 'text' ? b.text : '').join(' ').trim();
    return txt;
  }

  async function summarizeWithOpenAI(summaryPrompt) {
    const isGrok = provider === 'grok';
    const client = new OpenAI({
      apiKey: isGrok ? apiKeys?.grok : apiKeys?.openai,
      baseURL: isGrok ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1',
      dangerouslyAllowBrowser: true
    });
    const res = await client.chat.completions.create({
      model,
      stream: false,
      max_tokens: 300,
      messages: [
        { role: 'system', content: 'Tu produis un résumé très concis. Réponds uniquement par le résumé.' },
        { role: 'user', content: summaryPrompt },
      ]
    });
    return (res.choices?.[0]?.message?.content || '').trim();
  }

  const maybeSummarize = async (nextUserVisibleMessages) => {
    const cfg = getBudgetConfig();
    if (mode === 'agent') return { messages: nextUserVisibleMessages };
    if (!cfg.enableSummarize) {
      return { messages: nextUserVisibleMessages.slice(-cfg.maxHistoryMessages) };
    }
    if (nextUserVisibleMessages.length < cfg.summarizeThreshold) {
      const trimmed = nextUserVisibleMessages.slice(-cfg.maxHistoryMessages);
      return { messages: trimmed };
    }

    const toSummarize = nextUserVisibleMessages.slice(0, Math.max(0, nextUserVisibleMessages.length - cfg.keepAfterSummarize));
    const keep = nextUserVisibleMessages.slice(Math.max(0, nextUserVisibleMessages.length - cfg.keepAfterSummarize));

    const lines = toSummarize
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${sanitizeForSummary(m.content)}`)
      .join('\n');

    const summaryPrompt = `Résume la conversation suivante en points courts (max 12 lignes). Garde uniquement les décisions, contraintes, erreurs et contexte important.\n\n${lines}`;

    let newSummary = '';
    try {
      newSummary = provider === 'claude'
        ? await summarizeWithClaude(summaryPrompt)
        : await summarizeWithOpenAI(summaryPrompt);
    } catch (e) {
      const cfg2 = getBudgetConfig();
      newSummary = compactText(lines, cfg2.maxSummaryChars);
    }

    const merged = (conversationSummary ? (conversationSummary.trim() + '\n') : '') + (newSummary || '').trim();
    setConversationSummary(compactText(merged, cfg.maxSummaryChars));

    return { messages: keep };
  };

  const extractFileContent = (text) => {
    const match = text.match(/<file>([\s\S]*?)<\/file>/);
    return match ? match[1] : null;
  };

  // executeTool behavior is provided by src/utils/executeTool

  const sendWithClaude = async (apiMessages, systemPrompt, isAgent) => {
    const apiKey = apiKeys?.claude;
    if (!apiKey) {
      throw new Error('Clé API Claude non disponible');
    }
    const client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true
    });

    if (!isAgent) {
      let fullResponse = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '...' }]);

      const stream = await client.messages.stream({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: apiMessages
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullResponse += chunk.delta.text;
          setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: fullResponse }]);
        }
      }

      const newFileContent = extractFileContent(fullResponse);
      if (newFileContent && activeFile) {
        if (onProposeFileUpdate) {
          onProposeFileUpdate({ path: activeFile.path, content: newFileContent });
        } else {
          onFileUpdate(newFileContent);
          await window.electron.writeFile(activeFile.path, newFileContent);
        }
      }
      // Audit assistant response (non-agent)
      window.electron?.auditLog && window.electron.auditLog('info', 'Claude response', { provider: 'claude', preview: safeContent(fullResponse).slice(0, 200) });
      return;
    }

    let iteration = 0;
    while (iteration < 20) {
      iteration++;
      let response;
      let retries = 0;
      while (retries < 3) {
        try {
          response = await client.messages.create({
            model,
            max_tokens: 4096,
            system: systemPrompt,
            tools: AGENT_TOOLS,
            messages: apiMessages
          });
          break;
        } catch (err) {
          if (err.message.includes('rate_limit') && retries < 2) {
            retries++;
            setMessages(prev => [...prev, { role: 'system', content: `⏳ Pause ${retries * 15}s...` }]);
            await sleep(retries * 15000);
          } else throw err;
        }
      }

      apiMessages.push({ role: 'assistant', content: response.content });

      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) {
          setMessages(prev => [...prev, { role: 'assistant', content: block.text }]);
        }
        if (block.type === 'tool_use') {
          const icons = { read_file: '📖', write_file: '✏️', create_file: '✨', list_files: '📂', run_command: '🖥️' };
          const shortPath = Object.values(block.input)[0]?.toString().split('\\').pop() || '';

          // Ajouter le message "en cours"
          setMessages(prev => [...prev, {
            role: 'tool',
            icon: icons[block.name] || '🔧',
            text: `${block.name} — ${shortPath}`,
            status: 'running'
          }]);

          // Exécuter l'outil
          window.electron?.auditLog && window.electron.auditLog('info', 'Chat tool_use', { tool: block.name, input: safeContent(block.input) });
          const result = await executeTool(block.name, block.input);
          const resultOutput = (result && typeof result === 'object')
            ? (result.output !== undefined && result.output !== null ? result.output : (result.error || ''))
            : (result || '');

          window.electron?.auditLog && window.electron.auditLog('info', 'Chat tool_result', { tool: block.name, result: safeContent(result) });

          // Mettre à jour le message avec le résultat
          setMessages(prev => {
            const copy = [...prev];
            // Trouver et mettre à jour le dernier message tool
            for (let i = copy.length - 1; i >= 0; i--) {
              if (copy[i].role === 'tool' && copy[i].status === 'running') {
                copy[i] = {
                  ...copy[i],
                  status: 'done',
                  resultText: resultOutput // Afficher le résultat
                };
                break;
              }
            }
            return copy;
          });

          // Envoyer le résultat à Claude
          apiMessages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: block.id,
              content: resultOutput
            }]
          });
        }
      }

      // Vérifier la raison d'arrêt
      if (response.stop_reason === 'end_turn') {
        setMessages(prev => [...prev, { role: 'system', content: '✅ Agent terminé - tâche complétée !' }]);
        break;
      }

      // Si pas tool_use, arrêter la boucle
      if (response.stop_reason !== 'tool_use') {
        // stop_reason may be used for diagnostics; avoid noisy console output in production
        // console.debug('[Agent] Stop reason:', response.stop_reason);
        break;
      }
    }
  };

  const sendWithOpenAI = async (apiMessages, systemPrompt, isAgent) => {
    const isGrok = provider === 'grok';
    const client = new OpenAI({
      apiKey: isGrok ? apiKeys?.grok : apiKeys?.openai,
      baseURL: isGrok ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1',
      dangerouslyAllowBrowser: true
    });

    // Mode Agent (OpenAI only, not Grok)
    if (isAgent && !isGrok) {
      const openaiTools = convertToolsToOpenAI(AGENT_TOOLS);
      let iteration = 0;
      const maxIterations = 20;

      while (iteration < maxIterations) {
        iteration++;
        let response;
        let retries = 0;

        // Retry logic for rate limits
        while (retries < 3) {
          try {
            // OpenAI expects the system prompt as a message and functions under `functions`.
            const functions = openaiTools.map(t => t.function);
            response = await client.chat.completions.create({
              model,
              max_tokens: 4096,
              temperature: 0,
              function_call: 'auto',
              functions,
              messages: [
                { role: 'system', content: systemPrompt },
                ...apiMessages.map(m => ({
                  role: m.role,
                  content: safeContent(m.content),
                  ...(m.tool_calls && { tool_calls: m.tool_calls })
                }))
              ]
            });
            break;
          } catch (err) {
            // Rate limit retry
            if (err.message?.includes('rate_limit') && retries < 2) {
              retries++;
              setMessages(prev => [...prev, { role: 'system', content: `⏳ Pause ${retries * 15}s...` }]);
              await sleep(retries * 15000);
            } else {
              // Surface model access errors with clearer guidance
              if (err.message?.includes('does not have access to model') || err.message?.includes('Access denied')) {
                setMessages(prev => [...prev, { role: 'assistant', content: `❌ Erreur d'accès au modèle OpenAI: ${err.message}. Vérifiez que la clé API utilisée a accès au modèle sélectionné ou changez de modèle dans le menu.` }]);
                return;
              }
              throw err;
            }
          }
        }

        const assistantMessage = response.choices[0].message;

        // Safely coerce assistant content to a string for our messages array
        const assistantContentSafe = safeContent(assistantMessage.content);

        // Ajouter le message de l'assistant aux messages de la conversation
        apiMessages.push({
          role: 'assistant',
          content: assistantContentSafe,
          tool_calls: assistantMessage.tool_calls
        });

        // Afficher le texte de réponse s'il existe (ne tenter trim() que sur des chaînes)
        if (typeof assistantMessage.content === 'string' && assistantMessage.content.trim()) {
          setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage.content }]);
        }

        // Traiter les appels d'outils
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            for (const toolCall of assistantMessage.tool_calls) {
            const toolName = toolCall.function.name;
            const icons = { read_file: '📖', write_file: '✏️', create_file: '✨', list_files: '📂', run_command: '🖥️' };
            const toolInput = JSON.parse(toolCall.function.arguments);
            const shortPath = Object.values(toolInput)[0]?.toString().split('\\').pop() || '';

            // Afficher le message "en cours"
            setMessages(prev => [...prev, {
              role: 'tool',
              icon: icons[toolName] || '🔧',
              text: `${toolName} — ${shortPath}`,
              status: 'running'
            }]);

            // Exécuter l'outil
            window.electron?.auditLog && window.electron.auditLog('info', 'Chat tool_use', { tool: toolName, input: safeContent(toolInput) });
            const result = await executeTool(toolName, toolInput);
            const resultOutput = (result && typeof result === 'object')
              ? (result.output !== undefined && result.output !== null ? result.output : (result.error || ''))
              : (result || '');

            window.electron?.auditLog && window.electron.auditLog('info', 'Chat tool_result', { tool: toolName, result: safeContent(result) });

            // Mettre à jour le message avec le résultat
            setMessages(prev => {
              const copy = [...prev];
              for (let i = copy.length - 1; i >= 0; i--) {
                if (copy[i].role === 'tool' && copy[i].status === 'running') {
                  copy[i] = {
                    ...copy[i],
                    status: 'done',
                    resultText: resultOutput
                  };
                  break;
                }
              }
              return copy;
            });

            // Envoyer le résultat à OpenAI dans un format compatible avec Claude (tool_result)
            apiMessages.push({
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: toolCall.id,
                content: resultOutput
              }]
            });
          }
        }

        // Vérifier la raison d'arrêt
        const finishReason = response.choices[0].finish_reason;
        if (finishReason === 'stop') {
          if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
            // Le modèle n'a pas utilisé les outils — demander explicitement une action via outils et relancer
            if (iteration < maxIterations - 1) {
              setMessages(prev => [...prev, { role: 'system', content: '⚠️ Le modèle a répondu sans appeler les outils. Je lui demande d\'exécuter maintenant les actions en appelant les outils disponibles.' }]);
              apiMessages.push({ role: 'user', content: 'Veuillez maintenant exécuter les actions en appelant les outils fournis (read_file, write_file, create_file, list_files, run_command). N\'expliquez pas seulement, exécutez.' });
              continue;
            }
            setMessages(prev => [...prev, { role: 'system', content: '✅ Agent terminé - tâche complétée (fin de tentatives).' }]);
            break;
          }
          setMessages(prev => [...prev, { role: 'system', content: '✅ Agent terminé - tâche complétée !' }]);
          break;
        }
      }
      return;
    }

    // Mode Chat (streaming) - comportement par défaut
    let fullResponse = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '...' }]);

    const stream = await client.chat.completions.create({
      model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...apiMessages.map(m => ({ role: m.role, content: safeContent(m.content) }))
      ]
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      fullResponse += delta;
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: fullResponse }]);
    }

    const newFileContent = extractFileContent(fullResponse);
    if (newFileContent && activeFile) {
      if (onProposeFileUpdate) {
        onProposeFileUpdate({ path: activeFile.path, content: newFileContent });
      } else {
        onFileUpdate(newFileContent);
        await window.electron.writeFile(activeFile.path, newFileContent);
      }
    }
  };

  const sendMessage = async (overridePrompt = null, actionLabel = null) => {
    const messageText = overridePrompt || input;
    if ((!messageText.trim() && pendingImages.length === 0) || isLoading) return;

    if (!currentProvider) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Erreur : Provider non disponible`
      }]);
      return;
    }

    const currentKey = apiKeys?.[provider];
    if (!currentKey) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Aucune clé API pour ${currentProvider.name}. Clique sur 🔑 APIs pour la configurer.`
      }]);
      return;
    }

    if (pendingImages.length > 0 && !canUseImagesForCurrentProvider()) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Les images ne sont pas supportées pour ${currentProvider.name} pour l'instant. Passe sur ChatGPT (OpenAI) pour analyser des images.`
      }]);
      return;
    }

    const finalText = messageText.trim() ? messageText : '🖼️ Image';
    const displayText = actionLabel ? `⚡ ${actionLabel}` : finalText;
    const userMessage = { role: 'user', content: finalText, display: displayText };

    const newMessages = [...messages.filter(m => m.role !== 'tool' && m.role !== 'system'), userMessage];
    setMessages(prev => [...prev, userMessage]);
    if (!overridePrompt) setInput('');
    setIsLoading(true);

    try {
      const { messages: budgetedMessages } = await maybeSummarize(newMessages);
      if (budgetedMessages !== newMessages) {
        setMessages(prev => {
          const toolsAndSystem = prev.filter(m => m.role === 'tool' || m.role === 'system');
          return [...toolsAndSystem, ...budgetedMessages];
        });
      }
      const systemPrompt = buildSystemPrompt(finalText);
      const apiMessages = toApiMessages(budgetedMessages);

      if (provider === 'openai' && pendingImages.length > 0) {
        apiMessages[apiMessages.length - 1] = {
          ...apiMessages[apiMessages.length - 1],
          content: buildOpenAIMultimodalUserContent(finalText, pendingImages),
        };
      }

      if (provider === 'claude') {
        await sendWithClaude(apiMessages, systemPrompt, mode === 'agent');
      } else {
        const isAgentMode = mode === 'agent' && provider !== 'grok';
        await sendWithOpenAI(apiMessages, systemPrompt, isAgentMode);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Erreur : ${error.message}` }]);
    } finally {
      setIsLoading(false);
      setCurrentAction(null);
      setPendingImages([]);
    }
  };

  useImperativeHandle(ref, () => ({
    sendExternalMessage: (prompt, label) => {
      sendMessage(prompt, label);
    }
  }), [sendMessage]);

  const renderMessage = (msg, index) => {
    if (msg.role === 'tool') {
      return (
        <div key={index} style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          padding: '8px 12px', margin: '8px 0',
          background: '#1e2a1e', borderRadius: 6,
          border: `1px solid ${msg.status === 'done' ? '#2a6a2a' : '#3a5a3a'}`,
          fontSize: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{msg.status === 'done' ? '✅' : '⏳'}</span>
            <span style={{ color: msg.status === 'done' ? '#4ade80' : '#fbbf24', fontWeight: 'bold' }}>
              {msg.icon} {msg.text}
            </span>
          </div>
          {msg.resultText && msg.status === 'done' && (
            <div style={{
              marginLeft: 20,
              padding: '6px 8px',
              background: '#0a1f0a',
              borderRadius: 4,
              border: '1px solid #1a3a1a',
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#6ee7b7',
              maxHeight: '100px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {msg.resultText.substring(0, 500)}
              {msg.resultText.length > 500 && '...'}
            </div>
          )}
        </div>
      );
    }
    if (msg.role === 'system') {
      return (
        <div key={index} style={{ textAlign: 'center', color: '#4ade80', fontSize: 12, padding: '8px 0' }}>
          {msg.content}
        </div>
      );
    }

    const isUser = msg.role === 'user';
    const displayContent = (msg.display || msg.content || '')
      .replace(/<file>[\s\S]*?<\/file>/g, '✅ *Fichier mis à jour*');

    return (
      <div key={index} style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>
          {isUser ? '👤 Toi' : `${currentProvider.icon} ${currentProvider.name}`}
        </div>
        <div style={{
          maxWidth: '92%', padding: '10px 14px', borderRadius: 10,
          background: isUser ? '#7c3aed' : '#2d2d2d',
          color: '#fff', fontSize: 13, lineHeight: 1.6,
          wordBreak: 'break-word',
          border: isUser ? 'none' : `1px solid ${currentProvider.color}33`
        }}>
          {isUser ? displayContent : <MessageRenderer content={displayContent} />}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
          {currentProvider.icon} {currentProvider.name}
          {activeFile && <span style={{ color: '#666', fontWeight: 'normal', fontSize: 11, marginLeft: 8 }}>• {activeFile.name}</span>}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={async () => {
              try {
                const list = await listConversations();
                setHistoryItems(list);
              } catch (e) {
                setHistoryItems([]);
              }
              setShowHistory(true);
            }}
            style={{ background: 'none', border: 'none', color: '#777', cursor: 'pointer', fontSize: 13 }}
            title="Historique"
          >📚</button>
          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([]);
                setConversationSummary('');
                setConversationId(null);
              }}
              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11 }}
              title="Vider"
            >🗑️</button>
          )}
        </div>
      </div>

      {showHistory && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            width: 520,
            maxWidth: '95vw',
            maxHeight: '80vh',
            background: '#151515',
            border: '1px solid #333',
            borderRadius: 12,
            overflow: 'hidden',
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
              <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>📚 Conversations</div>
              <button
                onClick={() => setShowHistory(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #444',
                  color: '#aaa',
                  borderRadius: 8,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >Fermer</button>
            </div>

            <div style={{ padding: 12, overflow: 'auto' }}>
              {(!historyItems || historyItems.length === 0) ? (
                <div style={{ color: '#777', fontSize: 12, padding: 8 }}>Aucune conversation enregistrée pour ce projet.</div>
              ) : (
                historyItems.map(item => (
                  <div key={item.id} style={{
                    border: '1px solid #2a2a2a',
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    background: item.id === conversationId ? '#23202a' : '#1b1b1b',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: '#fff', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title || 'Conversation'}
                      </div>
                      <div style={{ color: '#777', fontSize: 11, marginTop: 2 }}>
                        {(item.provider || '').toString()} {(item.model || '').toString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={async () => {
                          const convo = await getConversation(item.id);
                          if (!convo) return;
                          setConversationId(convo.id);
                          setMessages(Array.isArray(convo.messages) ? convo.messages : []);
                          setConversationSummary(convo.summary || '');
                          if (convo.provider) setProvider(convo.provider);
                          if (convo.model) setModel(convo.model);
                          setShowHistory(false);
                        }}
                        style={{ background: '#2d2d2d', border: '1px solid #444', color: '#ddd', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}
                      >Ouvrir</button>
                      <button
                        onClick={async () => {
                          const nextTitle = window.prompt('Nouveau titre', item.title || 'Conversation');
                          if (nextTitle == null) return;
                          await renameConversation(item.id, nextTitle);
                          const list = await listConversations();
                          setHistoryItems(list);
                        }}
                        style={{ background: 'transparent', border: '1px solid #444', color: '#aaa', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}
                      >Renommer</button>
                      <button
                        onClick={async () => {
                          const ok = window.confirm('Supprimer cette conversation ?');
                          if (!ok) return;
                          await deleteConversation(item.id);
                          if (item.id === conversationId) {
                            setConversationId(null);
                            setMessages([]);
                            setConversationSummary('');
                          }
                          const list = await listConversations();
                          setHistoryItems(list);
                        }}
                        style={{ background: 'transparent', border: '1px solid #3a1d1d', color: '#ffb4b4', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}
                      >Supprimer</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {messages.length === 0 && (
          <div style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 32 }}>
            <p style={{ fontSize: 24, marginBottom: 12 }}>👋</p>
            <p>Bonjour ! Je suis {currentProvider.name}.</p>
            <p style={{ marginTop: 6, marginBottom: 20, fontSize: 12, color: currentProvider.color }}>
              {currentMode.icon} Mode {currentMode.label}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['Explique ce code', 'Corrige les erreurs', 'Ajoute des commentaires', 'Optimise ce fichier'].map(s => (
                <button key={s} onClick={() => setInput(s)} style={{
                  background: '#2d2d2d', border: '1px solid #444', color: '#aaa',
                  padding: '7px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map(renderMessage)}
        {isLoading && (
          <div style={{ color: currentProvider.color, fontSize: 12, textAlign: 'center', padding: 8 }}>
            {mode === 'agent' ? '🤖 Agent en cours...' : currentAction ? `⚡ ${currentAction}...` : `${currentProvider.icon} Réflexion...`}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Zone de saisie */}
      <div style={{ padding: 12, borderTop: '1px solid #333' }}>
        {pendingImages.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {pendingImages.map((img, idx) => (
              <div key={idx} style={{
                position: 'relative',
                width: 72,
                height: 52,
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid #333',
                background: '#111',
              }}>
                <img
                  src={img.dataUrl}
                  alt={img.name || `image-${idx}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <button
                  onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 18,
                    height: 18,
                    borderRadius: 6,
                    border: '1px solid #444',
                    background: 'rgba(0,0,0,0.5)',
                    color: '#ddd',
                    cursor: 'pointer',
                    fontSize: 12,
                    lineHeight: '16px',
                    padding: 0,
                  }}
                  title="Retirer"
                >✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={async (e) => {
              await handleImageFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />

          <textarea
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 8,
              border: '1px solid #444', background: '#1e1e1e',
              color: '#fff', fontSize: 13, resize: 'none',
              outline: 'none', fontFamily: 'inherit', lineHeight: 1.5
            }}
            rows={3}
            placeholder={mode === 'agent' ? 'Décris la tâche à accomplir...' : `Demande quelque chose à ${currentProvider.name}...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
          />

          <button
            onClick={handlePickImages}
            disabled={isLoading || mode === 'agent'}
            style={{
              padding: '0 10px',
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid #444',
              color: (provider === 'openai' && mode !== 'agent') ? '#ddd' : '#666',
              cursor: (isLoading || mode === 'agent') ? 'not-allowed' : 'pointer',
              alignSelf: 'stretch',
              fontSize: 16,
            }}
            title={mode === 'agent' ? 'Images désactivées en mode Agent' : (provider === 'openai' ? 'Joindre une image' : 'Images: OpenAI uniquement pour l’instant')}
          >📷</button>

          <button
            onClick={() => sendMessage()}
            disabled={isLoading || (!input.trim() && pendingImages.length === 0)}
            style={{
              padding: '0 14px', borderRadius: 8,
              background: isLoading ? '#444' : currentProvider.color,
              border: 'none', color: '#fff',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: 18, alignSelf: 'stretch'
            }}
          >➤</button>
        </div>

        {/* Barre du bas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>

          {/* Sélecteur Provider */}
          <div ref={providerMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowProviderMenu(!showProviderMenu)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 6,
                border: `1px solid ${currentProvider.color}66`,
                background: `${currentProvider.color}22`,
                color: '#ccc', cursor: 'pointer', fontSize: 12
              }}
            >
              <span>{currentProvider.icon}</span>
              <span style={{ color: currentProvider.color }}>{currentProvider.name}</span>
              <span style={{ color: '#666', fontSize: 10 }}>▼</span>
            </button>

            {showProviderMenu && (
              <div style={{
                position: 'absolute', bottom: '110%', left: 0,
                background: '#2d2d2d', border: '1px solid #444',
                borderRadius: 8, overflow: 'hidden', zIndex: 100,
                minWidth: 220, boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
              }}>
                {PROVIDERS.map(p => (
                  <div key={p.id}>
                    <div style={{
                      padding: '8px 14px', fontSize: 11,
                      color: p.color, background: '#1e1e2e',
                      borderBottom: '1px solid #333', fontWeight: 'bold'
                    }}>
                      {p.icon} {p.name}
                      {!apiKeys?.[p.id] && <span style={{ color: '#f87171', marginLeft: 8, fontSize: 10 }}>⚠️ Pas de clé</span>}
                    </div>
                    {p.models.map(m => (
                      <div
                        key={m.id}
                        onClick={() => {
                          setProvider(p.id);
                          setModel(m.id);
                          onProviderModelChange?.({ provider: p.id, model: m.id });
                          setShowProviderMenu(false);
                        }}
                        style={{
                          padding: '8px 20px', cursor: 'pointer', fontSize: 12,
                          color: model === m.id && provider === p.id ? '#fff' : '#aaa',
                          background: model === m.id && provider === p.id ? `${p.color}33` : 'transparent',
                          borderBottom: '1px solid #2a2a2a'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = `${p.color}22`}
                        onMouseLeave={e => e.currentTarget.style.background = model === m.id && provider === p.id ? `${p.color}33` : 'transparent'}
                      >
                        {model === m.id && provider === p.id ? '✓ ' : '  '}{m.name}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sélecteur Mode */}
          <div ref={modeMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowModeMenu(!showModeMenu)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 6,
                border: '1px solid #444', background: '#2d2d2d',
                color: '#ccc', cursor: 'pointer', fontSize: 12
              }}
            >
              <span>{currentMode.icon}</span>
              <span>{currentMode.label}</span>
              <span style={{ color: '#666', fontSize: 10 }}>▼</span>
            </button>

            {showModeMenu && (
              <div style={{
                position: 'absolute', bottom: '110%', left: 0,
                background: '#2d2d2d', border: '1px solid #444',
                borderRadius: 8, overflow: 'hidden', zIndex: 100,
                minWidth: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
              }}>
                {MODES.map(m => (
                  <div
                    key={m.id}
                    onClick={() => { setMode(m.id); setShowModeMenu(false); }}
                    style={{
                      padding: '10px 14px', cursor: 'pointer',
                      background: mode === m.id ? '#3a3a4a' : 'transparent',
                      borderBottom: '1px solid #333',
                      display: 'flex', alignItems: 'center', gap: 10
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#3a3a4a'}
                    onMouseLeave={e => e.currentTarget.style.background = mode === m.id ? '#3a3a4a' : 'transparent'}
                  >
                    <span style={{ fontSize: 16 }}>{m.icon}</span>
                    <div>
                      <div style={{ color: '#fff', fontSize: 13, fontWeight: mode === m.id ? 'bold' : 'normal' }}>
                        {m.label} {mode === m.id && <span style={{ color: '#7c3aed' }}>✓</span>}
                      </div>
                      <div style={{ color: '#666', fontSize: 11 }}>{m.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <span style={{ color: '#555', fontSize: 11, marginLeft: 'auto' }}>Shift+↵ nouvelle ligne</span>
        </div>
      </div>
    </div>
  );
});

export default Chat;

Chat.propTypes = {
  apiKeys: PropTypes.shape({
    claude: PropTypes.string,
    openai: PropTypes.string,
    grok: PropTypes.string,
  }),
  activeFile: PropTypes.shape({
    path: PropTypes.string,
    name: PropTypes.string,
  }),
  fileContent: PropTypes.string,
  projectPath: PropTypes.string,
  onFileUpdate: PropTypes.func,
  onProposeFileUpdate: PropTypes.func,
  initialProvider: PropTypes.string,
  initialModel: PropTypes.string,
  onProviderModelChange: PropTypes.func,
  budgetOverrides: PropTypes.object,
};

Chat.defaultProps = {
  apiKeys: { claude: '', openai: '', grok: '' },
  activeFile: null,
  fileContent: '',
  projectPath: '',
  onFileUpdate: null,
  onProposeFileUpdate: null,
  initialProvider: null,
  initialModel: null,
  onProviderModelChange: null,
  budgetOverrides: null,
};