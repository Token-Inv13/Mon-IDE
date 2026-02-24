import React, { useEffect, useRef, useState } from 'react';

export default function Terminal({ isVisible, projectPath }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [isStarted, setIsStarted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isVisible || isStarted || !terminalRef.current) return;

    let xterm, fitAddon, resizeObserver;

    const init = async () => {
      try {
        const { Terminal: XTerm } = await import('xterm');
        const { FitAddon } = await import('xterm-addon-fit');

        xterm = new XTerm({
          theme: {
            background: '#1a1a1a',
            foreground: '#f0f0f0',
            cursor: '#7c3aed',
          },
          fontSize: 13,
          fontFamily: 'Consolas, "Courier New", monospace',
          cursorBlink: true,
          scrollback: 1000,
        });

        fitAddon = new FitAddon();
        xterm.loadAddon(fitAddon);
        xterm.open(terminalRef.current);

        setTimeout(() => {
          try { fitAddon.fit(); } catch (e) {}
        }, 100);

        xtermRef.current = xterm;
        fitAddonRef.current = fitAddon;

        // Passer le projectPath au terminal
        await window.electron.terminalStart(projectPath);
        setIsStarted(true);

        window.electron.onTerminalData((data) => {
          xterm.write(data);
        });

        xterm.onData((data) => {
          window.electron.terminalInput(data);
        });

        resizeObserver = new ResizeObserver(() => {
          try {
            fitAddon.fit();
            window.electron.terminalResize(xterm.cols, xterm.rows);
          } catch (e) {}
        });
        resizeObserver.observe(terminalRef.current);

      } catch (err) {
        setError(err.message);
      }
    };

    init();

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.electron.removeTerminalListeners();
      window.electron.terminalKill();
      if (xterm) xterm.dispose();
    };
  }, [isVisible]);

  if (error) {
    return (
      <div style={{ background: '#1a1a1a', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: 13 }}>
        ❌ Erreur terminal : {error}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', background: '#1a1a1a',
      display: isVisible ? 'flex' : 'none', flexDirection: 'column' }}>
      <div style={{ padding: '6px 16px', background: '#2d2d2d',
        borderBottom: '1px solid #333', color: '#888', fontSize: 12,
        display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>🖥️</span>
        <span>Terminal PowerShell</span>
        {projectPath && (
          <span style={{ color: '#7c3aed', fontSize: 11 }}>
            — {projectPath.split('\\').pop()}
          </span>
        )}
      </div>
      <div ref={terminalRef} style={{ flex: 1, padding: 8, overflow: 'hidden' }} />
    </div>
  );
}