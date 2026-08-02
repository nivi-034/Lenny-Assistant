import React, { useState } from 'react';
import { X, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { triggerIngestion } from '../api';
import type { HealthStatus } from '../api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  health: HealthStatus | null;
  onRefreshHealth: () => void;
  currentProvider: string;
  currentModel: string;
  onSaveModelConfig: (provider: string, model: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  health,
  onRefreshHealth,
  currentProvider,
  currentModel,
  onSaveModelConfig,
}) => {
  const [provider, setProvider] = useState(currentProvider);
  const [model, setModel] = useState(currentModel);
  const [ingestLimit, setIngestLimit] = useState(10);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveModelConfig(provider, model);
    onClose();
  };

  const handleIngest = async () => {
    setIngestLoading(true);
    setIngestMsg(null);
    try {
      const res = await triggerIngestion(ingestLimit);
      setIngestMsg({
        type: 'success',
        text: res.message || 'Ingestion started successfully in the background!',
      });
      // Refresh health check details
      setTimeout(onRefreshHealth, 2000);
    } catch (e: any) {
      setIngestMsg({
        type: 'error',
        text: e.message || 'Failed to start ingestion process.',
      });
    } finally {
      setIngestLoading(false);
    }
  };

  // Helper defaults based on provider selection
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    if (newProvider === 'ollama') {
      setModel(health?.llm_config?.ollama_host ? 'llama3' : 'llama3');
    } else if (newProvider === 'anthropic') {
      setModel('claude-3-5-sonnet-20241022');
    } else if (newProvider === 'openai') {
      setModel('gpt-4o-mini');
    }
  };

  const keysSet = health?.llm_config?.env_keys || { anthropic_api_key_set: false, openai_api_key_set: false };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel">
        <div className="modal-header">
          <h2>System Settings</h2>
          <button className="icon-btn" onClick={onClose} style={{ border: 'none', background: 'none' }}>
            <X size={18} />
          </button>
        </div>

        {/* LLM Configuration Settings */}
        <div className="settings-group">
          <label className="settings-label">LLM Provider</label>
          <select
            className="settings-select"
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            <option value="ollama">Ollama (Local LLM)</option>
            <option value="anthropic">Anthropic Claude (Cloud LLM)</option>
            <option value="openai">OpenAI GPT (Cloud LLM)</option>
          </select>
        </div>

        <div className="settings-group">
          <label className="settings-label">Model Name</label>
          <input
            className="settings-input"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. llama3, claude-3-5-sonnet-20241022, gpt-4o"
          />
        </div>

        {/* API Key Status Check */}
        <div className="ingestion-status-card" style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div className="settings-label" style={{ fontSize: '0.7rem' }}>API Key Verification</div>
          <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
            <span>Anthropic API Key:</span>
            <span style={{ fontWeight: 'bold', color: keysSet.anthropic_api_key_set ? '#10b981' : '#f43f5e' }}>
              {keysSet.anthropic_api_key_set ? 'Configured' : 'Missing'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
            <span>OpenAI API Key:</span>
            <span style={{ fontWeight: 'bold', color: keysSet.openai_api_key_set ? '#10b981' : '#f43f5e' }}>
              {keysSet.openai_api_key_set ? 'Configured' : 'Missing'}
            </span>
          </div>
        </div>

        {/* Ingestion Console */}
        <div className="ingestion-status-card">
          <div className="settings-label" style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Data Ingestion Manager</span>
            <button onClick={onRefreshHealth} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', color: '#a5b4fc', border: 'none', background: 'none' }}>
              <RefreshCw size={10} /> Refresh
            </button>
          </div>
          
          <div className="status-grid">
            <div className="status-item">
              <span style={{ color: 'var(--text-muted)' }}>Index Database:</span>
              <span className="status-val">{health?.database?.url_type === 'sqlite' ? 'SQLite Local' : 'PostgreSQL Cloud'}</span>
            </div>
            <div className="status-item">
              <span style={{ color: 'var(--text-muted)' }}>Transcript Chunks:</span>
              <span className="status-val">{health?.database?.chunks_indexed || 0}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Limit:</span>
              <input
                className="settings-input"
                type="number"
                value={ingestLimit}
                onChange={(e) => setIngestLimit(parseInt(e.target.value) || 10)}
                style={{ padding: '0.3rem 0.5rem', width: '60px' }}
                min="1"
                max="300"
              />
            </div>
            <button
              className="secondary-btn"
              onClick={handleIngest}
              disabled={ingestLoading}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
            >
              {ingestLoading && <RefreshCw size={12} className="pulse-glow" />}
              {ingestLoading ? 'Ingesting...' : 'Ingest Transcripts'}
            </button>
          </div>

          {ingestMsg && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: ingestMsg.type === 'success' ? '#10b981' : '#f43f5e', display: 'flex', gap: '0.3rem', alignItems: 'flex-start' }}>
              {ingestMsg.type === 'success' ? <CheckCircle size={14} style={{ flexShrink: 0 }} /> : <AlertTriangle size={14} style={{ flexShrink: 0 }} />}
              <span>{ingestMsg.text}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button className="secondary-btn" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </button>
          <button className="primary-btn" onClick={handleSave} style={{ flex: 1 }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
