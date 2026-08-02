import React from 'react';
import { Plus, MessageSquare, Trash2, Settings } from 'lucide-react';
import type { ChatSession, HealthStatus } from '../api';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  health: HealthStatus | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  health,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onOpenSettings,
}) => {
  const dbStatus = health?.database?.status || 'unhealthy';
  const chunksCount = health?.database?.chunks_indexed || 0;
  const isOnline = dbStatus.startsWith('healthy');

  return (
    <div className="sidebar">
      {/* Sidebar Header Logo */}
      <div className="sidebar-header">
        <div className="logo">
          <span>Lenny</span>Assistant
        </div>
      </div>

      {/* New Chat Button */}
      <button className="new-chat-btn" onClick={onCreateSession}>
        <Plus size={18} />
        New Chat
      </button>

      {/* Session History List */}
      <div className="session-list-container">
        {sessions.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.85rem' }}>
            No chat history
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="session-details">
                <MessageSquare size={16} style={{ color: session.id === activeSessionId ? '#a5b4fc' : 'var(--text-muted)' }} />
                <span className="session-title">{session.title}</span>
              </div>
              <button
                className="session-delete-btn"
                onClick={(e) => onDeleteSession(session.id, e)}
                title="Delete Chat"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Sidebar Footer Details */}
      <div className="sidebar-footer">
        <div className="connection-status">
          <div className={`status-indicator ${isOnline ? 'online pulse-glow' : 'offline'}`}></div>
          <span>Database: {isOnline ? 'Supabase' : 'Offline'}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>({chunksCount} chunks)</span>
        </div>

        <button className="secondary-btn" onClick={onOpenSettings} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 1rem' }}>
          <Settings size={16} />
          Settings
        </button>
      </div>
    </div>
  );
};
