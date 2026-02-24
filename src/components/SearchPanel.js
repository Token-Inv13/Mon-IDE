import React, { useState, useRef, useEffect } from 'react';

/**
 * SearchPanel — Recherche globale dans les fichiers du projet
 * Props :
 *   projectPath : string
 *   onOpenFile  : (file) => void  — ouvre un fichier dans l'éditeur
 *   isVisible   : bool
 *   onClose     : () => void
 */
export default function SearchPanel({ projectPath, onOpenFile, isVisible, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isVisible) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isVisible]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    // Recherche en temps différé
    const timer = setTimeout(() => search(), 400);
    return () => clearTimeout(timer);
  }, [query, caseSensitive]);

  const search = async () => {
    if (!query.trim() || !projectPath) return;
    setIsSearching(true);
    setSearched(false);

    try {
      // Lister récursivement tous les fichiers texte
      const tree = await window.electron.readDirectory(projectPath);
      const textExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'json', 'md', 'txt', 'yml', 'yaml', 'env', 'sh', 'bat'];

      const flatFiles = [];
      const flatten = (items) => {
        for (const item of items) {
          if (item.isDirectory && item.children) {
            // Ignorer node_modules, .git, dist, build
            if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(item.name)) {
              flatten(item.children);
            }
          } else if (!item.isDirectory) {
            const ext = item.name.split('.').pop().toLowerCase();
            if (textExts.includes(ext)) flatFiles.push(item);
          }
        }
      };
      flatten(tree);

      // Chercher dans chaque fichier
      const found = [];
      const needle = caseSensitive ? query : query.toLowerCase();

      for (const file of flatFiles) {
        try {
          const content = await window.electron.readFile(file.path);
          const lines = content.split('\n');
          const matches = [];

          lines.forEach((line, idx) => {
            const haystack = caseSensitive ? line : line.toLowerCase();
            if (haystack.includes(needle)) {
              matches.push({
                lineNumber: idx + 1,
                line: line.trim(),
                preview: highlight(line.trim(), query, caseSensitive),
              });
            }
          });

          if (matches.length > 0) {
            found.push({ file, matches: matches.slice(0, 10), total: matches.length });
          }
        } catch (e) {
          // Ignorer les fichiers non lisibles
        }
      }

      setResults(found);
      setSearched(true);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const highlight = (line, query, caseSensitive) => {
    if (!query) return line;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, caseSensitive ? 'g' : 'gi');
    return line.replace(regex, '|||$1|||');
  };

  const renderHighlighted = (text) => {
    const parts = text.split('|||');
    return parts.map((part, i) => {
      const isMatch = i % 2 === 1;
      return isMatch
        ? <mark key={i} style={{ background: '#f59e0b55', color: '#fbbf24', borderRadius: 2, padding: '0 2px' }}>{part}</mark>
        : <span key={i}>{part}</span>;
    });
  };

  if (!isVisible) return null;

  const totalMatches = results.reduce((sum, r) => sum + r.total, 0);

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>🔍 Recherche</span>
        <button onClick={onClose} style={styles.closeBtn}>✕</button>
      </div>

      {/* Input */}
      <div style={styles.inputArea}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Rechercher dans les fichiers..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onClose()}
          style={styles.input}
        />
        <button
          onClick={() => setCaseSensitive(!caseSensitive)}
          title="Respecter la casse"
          style={{
            ...styles.optionBtn,
            background: caseSensitive ? '#7c3aed44' : 'transparent',
            border: `1px solid ${caseSensitive ? '#7c3aed' : '#444'}`,
          }}
        >
          Aa
        </button>
      </div>

      {/* Status */}
      {query.trim() && (
        <div style={styles.status}>
          {isSearching
            ? <span style={{ color: '#7c3aed' }}>⏳ Recherche...</span>
            : searched
              ? <span style={{ color: '#888' }}>
                  {totalMatches > 0
                    ? `${totalMatches} résultat${totalMatches > 1 ? 's' : ''} dans ${results.length} fichier${results.length > 1 ? 's' : ''}`
                    : 'Aucun résultat'}
                </span>
              : null}
        </div>
      )}

      {/* Résultats */}
      <div style={styles.results}>
        {results.map((result, ri) => (
          <div key={ri} style={styles.fileResult}>
            {/* Nom du fichier */}
            <div
              style={styles.fileName}
              onClick={() => onOpenFile(result.file)}
              title={result.file.path}
            >
              <span style={{ fontSize: 12 }}>📄</span>
              <span style={styles.fileNameText}>{result.file.name}</span>
              <span style={styles.matchCount}>{result.total}</span>
            </div>

            {/* Lignes correspondantes */}
            {result.matches.map((match, mi) => (
              <div
                key={mi}
                style={styles.matchLine}
                onClick={() => onOpenFile(result.file)}
                title={`Ligne ${match.lineNumber}`}
              >
                <span style={styles.lineNumber}>{match.lineNumber}</span>
                <span style={styles.lineContent}>
                  {renderHighlighted(match.preview.slice(0, 80))}
                </span>
              </div>
            ))}

            {result.total > 10 && (
              <div style={styles.moreMatches}>
                + {result.total - 10} autres correspondances...
              </div>
            )}
          </div>
        ))}

        {searched && results.length === 0 && (
          <div style={styles.empty}>
            <p style={{ fontSize: 24 }}>🔍</p>
            <p>Aucun résultat pour « {query} »</p>
          </div>
        )}

        {!query.trim() && (
          <div style={styles.empty}>
            <p style={{ fontSize: 24, marginBottom: 8 }}>🔍</p>
            <p>Tape pour chercher dans tous les fichiers du projet</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  panel: {
    width: 280,
    background: '#1e1e2e',
    borderRight: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
  },
  header: {
    padding: '10px 12px',
    borderBottom: '1px solid #333',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#252535',
  },
  title: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  closeBtn: {
    background: 'none', border: 'none', color: '#666',
    cursor: 'pointer', fontSize: 14,
  },
  inputArea: {
    padding: '10px 10px 6px',
    display: 'flex',
    gap: 6,
    borderBottom: '1px solid #2a2a3a',
  },
  input: {
    flex: 1,
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid #444',
    background: '#1e1e1e',
    color: '#fff',
    fontSize: 13,
    outline: 'none',
  },
  optionBtn: {
    padding: '6px 8px',
    borderRadius: 6,
    color: '#aaa',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 'bold',
    flexShrink: 0,
  },
  status: {
    padding: '4px 12px',
    fontSize: 11,
    borderBottom: '1px solid #2a2a3a',
  },
  results: {
    flex: 1,
    overflowY: 'auto',
    padding: '6px 0',
  },
  fileResult: {
    marginBottom: 8,
  },
  fileName: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    cursor: 'pointer',
    background: '#252535',
    borderTop: '1px solid #333',
    borderBottom: '1px solid #333',
  },
  fileNameText: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: 'bold',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  matchCount: {
    background: '#7c3aed',
    color: '#fff',
    borderRadius: 8,
    padding: '1px 6px',
    fontSize: 10,
    fontWeight: 'bold',
  },
  matchLine: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'Consolas, monospace',
  },
  lineNumber: {
    color: '#555',
    minWidth: 28,
    textAlign: 'right',
    flexShrink: 0,
    paddingTop: 1,
  },
  lineContent: {
    color: '#ccc',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  moreMatches: {
    padding: '2px 10px 2px 46px',
    color: '#555',
    fontSize: 11,
    fontStyle: 'italic',
  },
  empty: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    padding: '32px 16px',
    lineHeight: 1.6,
  },
};
