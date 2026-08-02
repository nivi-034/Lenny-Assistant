import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Download, Eye, Code } from 'lucide-react';
import type { Artifact } from '../api';
import { Markdown } from './Markdown';

interface ArtifactViewerProps {
  artifact: Artifact | null;
  onClose: () => void;
}

export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({ artifact, onClose }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);

  // Reset tab to preview when artifact changes
  useEffect(() => {
    setActiveTab('preview');
    setCopied(false);
  }, [artifact]);

  if (!artifact) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([artifact.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Choose appropriate file extension
    const extension = artifact.type === 'html' ? 'html' : 'md';
    link.download = `${artifact.id || 'artifact'}.${extension}`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="artifact-viewer-pane glass-panel">
      {/* Title bar */}
      <div className="artifact-viewer-header">
        <div className="artifact-title-wrapper">
          <div className="artifact-icon-wrapper">
            {artifact.type === 'html' ? <Code size={16} /> : <Eye size={16} />}
          </div>
          <div>
            <div className="artifact-viewer-title" title={artifact.title}>{artifact.title}</div>
            <div className="artifact-subtitle">{artifact.type.toUpperCase()} Template</div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="artifact-tabs">
          <button
            className={`artifact-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Eye size={12} /> Preview
            </span>
          </button>
          <button
            className={`artifact-tab-btn ${activeTab === 'code' ? 'active' : ''}`}
            onClick={() => setActiveTab('code')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Code size={12} /> Code
            </span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="artifact-viewer-actions">
          <button className="icon-btn" onClick={handleCopy} title="Copy Code">
            {copied ? <Check size={16} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={16} />}
          </button>
          <button className="icon-btn" onClick={handleDownload} title="Download File">
            <Download size={16} />
          </button>
          <button className="icon-btn" onClick={onClose} title="Close Pane">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content Rendering Viewport */}
      <div className="artifact-content-area">
        {activeTab === 'preview' ? (
          artifact.type === 'html' ? (
            <iframe
              title="Artifact Preview"
              srcDoc={artifact.content}
              sandbox="allow-scripts"
              className="artifact-iframe"
            />
          ) : (
            <div className="artifact-markdown-preview">
              <Markdown content={artifact.content} />
            </div>
          )
        ) : (
          <pre className="artifact-code-block">
            <code>{artifact.content}</code>
          </pre>
        )}
      </div>
    </div>
  );
};
