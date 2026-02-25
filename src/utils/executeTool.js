import Ajv from 'ajv';
import { AGENT_TOOLS } from '../agentTools';
import safeContent from './safeContent';

export default async function executeTool(toolName, toolInput, options = {}) {
  const { addLog, onFileUpdate, activeFile } = options;
  const ajv = new Ajv();

  try {
    const toolDef = AGENT_TOOLS.find(t => t.name === toolName);
    if (toolDef && toolDef.input_schema) {
      const validate = ajv.compile(toolDef.input_schema);
      const valid = validate(toolInput || {});
      if (!valid) {
        const errText = ajv.errorsText(validate.errors);
        addLog && addLog('error', `❌ Validation failed for ${toolName}: ${errText}`);
        return { success: false, output: '', error: `Validation error: ${errText}` };
      }
    }

    switch (toolName) {
      case 'read_file': {
        const content = await window.electron.readFile(toolInput.path);
        const msg = `📖 Lu : ${toolInput.path}`;
        addLog && addLog('tool', msg);
        window.electron?.auditLog && window.electron.auditLog('info', msg, { tool: toolName, path: toolInput.path });
        return { success: true, output: safeContent(content) };
      }
      case 'write_file': {
        await window.electron.writeFile(toolInput.path, toolInput.content);
        const msg = `✏️ Modifié : ${toolInput.path}`;
        addLog && addLog('tool', msg);
        window.electron?.auditLog && window.electron.auditLog('info', msg, { tool: toolName, path: toolInput.path });
        if (activeFile && activeFile.path === toolInput.path && typeof onFileUpdate === 'function') {
          onFileUpdate(toolInput.content);
        }
        return { success: true, output: `Fichier modifié avec succès: ${toolInput.path}` };
      }
      case 'create_file': {
        await window.electron.writeFile(toolInput.path, toolInput.content || '');
        const msg = `✨ Créé : ${toolInput.path}`;
        addLog && addLog('tool', msg);
        window.electron?.auditLog && window.electron.auditLog('info', msg, { tool: toolName, path: toolInput.path });
        return { success: true, output: `Fichier créé avec succès: ${toolInput.path}` };
      }
      case 'list_files': {
        const tree = await window.electron.readDirectory(toolInput.path);
        const flatten = (items, depth = 0) =>
          items.flatMap(item => [
            '  '.repeat(depth) + (item.isDirectory ? '📁 ' : '📄 ') + item.name,
            ...(item.children ? flatten(item.children, depth + 1) : [])
          ]);
        const result = flatten(tree).join('\n');
        const msg = `📂 Listé : ${toolInput.path}`;
        addLog && addLog('tool', msg);
        window.electron?.auditLog && window.electron.auditLog('info', msg, { tool: toolName, path: toolInput.path });
        return { success: true, output: safeContent(result) };
      }
      case 'run_command': {
        const msg = `🖥️ Commande : ${toolInput.command}`;
        addLog && addLog('tool', msg);
        window.electron?.auditLog && window.electron.auditLog('info', msg, { tool: toolName, command: toolInput.command });
        window.electron.terminalInput(toolInput.command + '\r');
        return { success: true, output: `Commande envoyée au terminal : ${toolInput.command}` };
      }
      default:
        return { success: false, output: '', error: `Outil inconnu: ${toolName}` };
    }
  } catch (err) {
    const message = err?.message || String(err);
    const errMsg = `❌ Erreur : ${message}`;
    addLog && addLog('error', errMsg);
    window.electron?.auditLog && window.electron.auditLog('error', errMsg, { tool: toolName, input: safeContent(toolInput) });
    return { success: false, output: '', error: message };
  }
}
