import Ajv from 'ajv';
import { AGENT_TOOLS } from '../agentTools';
import safeContent from './safeContent';

export default async function executeTool(toolName, toolInput, options = {}) {
  const { addLog, onFileUpdate, activeFile, projectPath, recordAction, confirmGitPush } = options;
  const ajv = new Ajv();

  const normalizeAbsPath = (p) => {
    const s = (p || '').toString().trim();
    if (!s) return '';
    const isWinAbs = /^[a-zA-Z]:\\/.test(s) || s.startsWith('\\\\');
    const isUnixAbs = s.startsWith('/');
    if (isWinAbs || isUnixAbs) return s;
    const base = (projectPath || '').toString();
    if (!base) return s;
    const stripped = s.replace(/^\.(\\|\/)/, '');
    return base.replace(/[\\/]+$/, '') + '\\' + stripped;
  };

  const runCapture = async (command) => {
    if (!window.electron?.runCommandCapture) {
      window.electron?.terminalInput && window.electron.terminalInput(command + '\r');
      return { ok: true, stdout: '', stderr: '', exitCode: null };
    }
    return await window.electron.runCommandCapture({ command, cwd: projectPath || undefined });
  };

  const formatCapture = (res) => {
    const out = (res?.stdout || '').toString();
    const err = (res?.stderr || '').toString();
    const code = res?.exitCode;
    return [
      `exitCode: ${code}`,
      err ? `stderr:\n${err}` : '',
      out ? `stdout:\n${out}` : '',
    ].filter(Boolean).join('\n');
  };

  const isDangerousCommand = (cmd) => {
    const c = (cmd || '').toLowerCase();
    return (
      c.includes(' format ') || c.startsWith('format ') ||
      c.includes(' shutdown') || c.startsWith('shutdown') ||
      c.includes(' rm -rf') || c.includes(' rm -r') || c.startsWith('rm ') ||
      c.startsWith('del ') || c.startsWith('rmdir ') || c.includes('remove-item')
    );
  };

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
        const abs = normalizeAbsPath(toolInput.path);
        const content = await window.electron.readFile(abs);
        recordAction && recordAction({ type: 'read_file', path: abs });
        const msg = `📖 Lu : ${toolInput.path}`;
        addLog && addLog('tool', msg);
        window.electron?.auditLog && window.electron.auditLog('info', msg, { tool: toolName, path: abs });
        return { success: true, output: safeContent(content) };
      }
      case 'write_file': {
        const abs = normalizeAbsPath(toolInput.path);
        await window.electron.writeFile(abs, toolInput.content);
        recordAction && recordAction({ type: 'write_file', path: abs, bytes: (toolInput.content || '').toString().length });
        const msg = `✏️ Modifié : ${toolInput.path}`;
        addLog && addLog('tool', msg);
        window.electron?.auditLog && window.electron.auditLog('info', msg, { tool: toolName, path: abs });
        if (activeFile && activeFile.path === abs && typeof onFileUpdate === 'function') {
          onFileUpdate(toolInput.content);
        }
        return { success: true, output: `Fichier modifié avec succès: ${abs}` };
      }
      case 'create_file': {
        const abs = normalizeAbsPath(toolInput.path);
        await window.electron.writeFile(abs, toolInput.content || '');
        recordAction && recordAction({ type: 'create_file', path: abs, bytes: (toolInput.content || '').toString().length });
        const msg = `✨ Créé : ${toolInput.path}`;
        addLog && addLog('tool', msg);
        window.electron?.auditLog && window.electron.auditLog('info', msg, { tool: toolName, path: abs });
        return { success: true, output: `Fichier créé avec succès: ${abs}` };
      }
      case 'create_folder': {
        const abs = normalizeAbsPath(toolInput.path);
        await window.electron.createFolder(abs);
        recordAction && recordAction({ type: 'create_folder', path: abs });
        const msg = `📁 Dossier créé : ${abs}`;
        addLog && addLog('tool', msg);
        window.electron?.auditLog && window.electron.auditLog('info', msg, { tool: toolName, path: abs });
        return { success: true, output: msg };
      }
      case 'move_path': {
        const fromAbs = normalizeAbsPath(toolInput.from);
        const toAbs = normalizeAbsPath(toolInput.to);
        await window.electron.renameFile(fromAbs, toAbs);
        recordAction && recordAction({ type: 'move_path', from: fromAbs, to: toAbs });
        const msg = `📦 Déplacé : ${fromAbs} -> ${toAbs}`;
        addLog && addLog('tool', msg);
        window.electron?.auditLog && window.electron.auditLog('info', msg, { tool: toolName, from: fromAbs, to: toAbs });
        return { success: true, output: msg };
      }
      case 'copy_file': {
        const fromAbs = normalizeAbsPath(toolInput.from);
        const toAbs = normalizeAbsPath(toolInput.to);
        const content = await window.electron.readFile(fromAbs);
        await window.electron.writeFile(toAbs, content);
        recordAction && recordAction({ type: 'copy_file', from: fromAbs, to: toAbs, bytes: (content || '').toString().length });
        const msg = `🧬 Copié : ${fromAbs} -> ${toAbs}`;
        addLog && addLog('tool', msg);
        window.electron?.auditLog && window.electron.auditLog('info', msg, { tool: toolName, from: fromAbs, to: toAbs });
        return { success: true, output: msg };
      }
      case 'trash_path': {
        const abs = normalizeAbsPath(toolInput.path);
        if (!window.electron?.trashFile || !window.electron?.restoreFile) {
          await window.electron.deleteFile(abs);
          recordAction && recordAction({ type: 'delete_path', path: abs, viaTrash: false });
          const msg = `🗑️ Supprimé (sans corbeille) : ${abs}`;
          addLog && addLog('tool', msg);
          return { success: true, output: msg };
        }
        if (!projectPath) throw new Error('ProjectPath manquant pour la corbeille');
        const res = await window.electron.trashFile(projectPath, abs);
        recordAction && recordAction({ type: 'delete_path', path: abs, viaTrash: true, trashedPath: res?.trashedPath, originalPath: res?.originalPath });
        const msg = `🗑️ Mis en corbeille : ${abs}`;
        addLog && addLog('tool', msg);
        return { success: true, output: safeContent({ ...res, message: msg }) };
      }
      case 'restore_path': {
        if (!window.electron?.restoreFile) throw new Error('restoreFile indisponible');
        const trashedPath = normalizeAbsPath(toolInput.trashedPath);
        const originalPath = normalizeAbsPath(toolInput.originalPath);
        const res = await window.electron.restoreFile(trashedPath, originalPath);
        recordAction && recordAction({ type: 'restore_path', trashedPath, originalPath });
        const msg = `♻️ Restauré : ${originalPath}`;
        addLog && addLog('tool', msg);
        return { success: true, output: safeContent({ ...res, message: msg }) };
      }
      case 'delete_path': {
        const abs = normalizeAbsPath(toolInput.path);
        if (window.electron?.trashFile && window.electron?.restoreFile && projectPath) {
          const res = await window.electron.trashFile(projectPath, abs);
          recordAction && recordAction({ type: 'delete_path', path: abs, viaTrash: true, trashedPath: res?.trashedPath, originalPath: res?.originalPath });
          const msg = `🗑️ Mis en corbeille : ${abs}`;
          addLog && addLog('tool', msg);
          return { success: true, output: safeContent({ ...res, message: msg }) };
        }
        await window.electron.deleteFile(abs);
        recordAction && recordAction({ type: 'delete_path', path: abs, viaTrash: false });
        const msg = `🗑️ Supprimé : ${abs}`;
        addLog && addLog('tool', msg);
        return { success: true, output: msg };
      }
      case 'list_files': {
        const abs = normalizeAbsPath(toolInput.path);
        const tree = await window.electron.readDirectory(abs);
        const flatten = (items, depth = 0) =>
          items.flatMap(item => [
            '  '.repeat(depth) + (item.isDirectory ? '📁 ' : '📄 ') + item.name,
            ...(item.children ? flatten(item.children, depth + 1) : [])
          ]);
        const result = flatten(tree).join('\n');
        const msg = `📂 Listé : ${abs}`;
        addLog && addLog('tool', msg);
        window.electron?.auditLog && window.electron.auditLog('info', msg, { tool: toolName, path: abs });
        return { success: true, output: safeContent(result) };
      }
      case 'git_status': {
        const res = await runCapture('git status');
        recordAction && recordAction({ type: 'git_status', ok: !!res?.ok, exitCode: res?.exitCode });
        return { success: !!res?.ok, output: safeContent(formatCapture(res)), error: res?.ok ? '' : safeContent(res?.stderr || 'git status failed') };
      }
      case 'git_add': {
        const ps = (toolInput?.pathspec || '.').toString().trim() || '.';
        const res = await runCapture(`git add ${ps}`);
        recordAction && recordAction({ type: 'git_add', pathspec: ps, ok: !!res?.ok, exitCode: res?.exitCode });
        return { success: !!res?.ok, output: safeContent(formatCapture(res)), error: res?.ok ? '' : safeContent(res?.stderr || 'git add failed') };
      }
      case 'git_commit': {
        const msg = (toolInput?.message || '').toString();
        if (!msg.trim()) return { success: false, output: '', error: 'Message de commit manquant' };
        const escaped = msg.replace(/"/g, '\\"');
        const res = await runCapture(`git commit -m "${escaped}"`);
        recordAction && recordAction({ type: 'git_commit', message: msg, ok: !!res?.ok, exitCode: res?.exitCode });
        return { success: !!res?.ok, output: safeContent(formatCapture(res)), error: res?.ok ? '' : safeContent(res?.stderr || 'git commit failed') };
      }
      case 'git_push': {
        const remote = (toolInput?.remote || 'origin').toString().trim() || 'origin';
        const branch = (toolInput?.branch || '').toString().trim();
        if (!confirmGitPush) {
          const hint = `Confirmation requise pour git_push. Réponds exactement: CONFIRM_PUSH ${remote}${branch ? (' ' + branch) : ''}`;
          recordAction && recordAction({ type: 'git_push_blocked', remote, branch });
          return { success: false, output: '', error: hint };
        }
        const cmd = branch ? `git push ${remote} ${branch}` : `git push ${remote}`;
        const res = await runCapture(cmd);
        recordAction && recordAction({ type: 'git_push', remote, branch, ok: !!res?.ok, exitCode: res?.exitCode });
        return { success: !!res?.ok, output: safeContent(formatCapture(res)), error: res?.ok ? '' : safeContent(res?.stderr || 'git push failed') };
      }
      case 'run_command': {
        const msg = `🖥️ Commande : ${toolInput.command}`;
        addLog && addLog('tool', msg);
        window.electron?.auditLog && window.electron.auditLog('info', msg, { tool: toolName, command: toolInput.command });

        if (isDangerousCommand(toolInput.command)) {
          return { success: false, output: '', error: 'Commande bloquée (potentiellement destructive). Utilise une commande non destructive ou ajoute un outil dédié.' };
        }

        if (window.electron?.runCommandCapture) {
          const res = await window.electron.runCommandCapture({
            command: toolInput.command,
            cwd: projectPath || undefined,
          });

          const summary = formatCapture(res);
          const err = (res?.stderr || '').toString();
          const code = res?.exitCode;
          recordAction && recordAction({ type: 'run_command', command: toolInput.command, ok: !!res?.ok, exitCode: code });
          return { success: !!res?.ok, output: safeContent(summary), error: res?.ok ? '' : (err || `exitCode=${code}`) };
        }

        window.electron?.terminalInput && window.electron.terminalInput(toolInput.command + '\r');
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
