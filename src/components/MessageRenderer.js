import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'relative', margin: '8px 0', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 12px', background: '#1a1a2e',
        borderBottom: '1px solid #333'
      }}>
        <span style={{ color: '#888', fontSize: 11 }}>
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          style={{
            background: copied ? '#16a34a' : '#2d2d2d',
            border: '1px solid #444', color: copied ? '#fff' : '#aaa',
            padding: '3px 10px', borderRadius: 4,
            cursor: 'pointer', fontSize: 11, transition: 'all 0.2s'
          }}
        >
          {copied ? '✅ Copié !' : '📋 Copier'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={vscDarkPlus}
        customStyle={{
          margin: 0, padding: '12px 16px',
          fontSize: 13, lineHeight: 1.5,
          background: '#0d1117', borderRadius: 0,
          maxHeight: 400, overflow: 'auto'
        }}
        showLineNumbers={code.split('\n').length > 5}
        lineNumberStyle={{ color: '#444', fontSize: 11 }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export default function MessageRenderer({ content }) {
  if (!content) return null;

  const parts = [];
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', language: match[1] || 'text', content: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }

  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }

  return (
    <div>
      {parts.map((part, i) => {
        if (part.type === 'code') {
          return <CodeBlock key={i} language={part.language} code={part.content} />;
        }

        const lines = part.content.split('\n');
        return (
          <div key={i}>
            {lines.map((line, j) => {
              if (line.startsWith('### ')) return (
                <div key={j} style={{ color: '#a78bfa', fontWeight: 'bold', fontSize: 13, margin: '10px 0 4px' }}>
                  {line.slice(4)}
                </div>
              );
              if (line.startsWith('## ')) return (
                <div key={j} style={{ color: '#c4b5fd', fontWeight: 'bold', fontSize: 14, margin: '12px 0 4px' }}>
                  {line.slice(3)}
                </div>
              );
              if (line.startsWith('# ')) return (
                <div key={j} style={{ color: '#ddd6fe', fontWeight: 'bold', fontSize: 15, margin: '14px 0 6px' }}>
                  {line.slice(2)}
                </div>
              );
              if (line.startsWith('- ') || line.startsWith('* ')) return (
                <div key={j} style={{ display: 'flex', gap: 8, margin: '2px 0', paddingLeft: 8 }}>
                  <span style={{ color: '#7c3aed', flexShrink: 0 }}>•</span>
                  <span>{renderInlineMarkdown(line.slice(2))}</span>
                </div>
              );
              const numMatch = line.match(/^(\d+)\. (.+)/);
              if (numMatch) return (
                <div key={j} style={{ display: 'flex', gap: 8, margin: '2px 0', paddingLeft: 8 }}>
                  <span style={{ color: '#7c3aed', flexShrink: 0, minWidth: 16 }}>{numMatch[1]}.</span>
                  <span>{renderInlineMarkdown(numMatch[2])}</span>
                </div>
              );
              if (line.trim() === '') return <div key={j} style={{ height: 6 }} />;
              return (
                <div key={j} style={{ lineHeight: 1.6 }}>
                  {renderInlineMarkdown(line)}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function renderInlineMarkdown(text) {
  const parts = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let last = 0;
  let m;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={m.index} style={{ color: '#fff' }}>{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={m.index} style={{ color: '#c4b5fd' }}>{m[4]}</em>);
    else if (m[5]) parts.push(
      <code key={m.index} style={{
        background: '#1a1a2e', color: '#a78bfa',
        padding: '1px 6px', borderRadius: 4, fontSize: 12,
        border: '1px solid #333'
      }}>{m[6]}</code>
    );
    last = m.index + m[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}