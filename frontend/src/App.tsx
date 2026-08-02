import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, BookOpen, ArrowRight, RefreshCw } from 'lucide-react';
import {
  fetchHealth,
  fetchSessions,
  createSession,
  fetchSessionDetails,
  updateSession,
  deleteSession,
  streamChat,
} from './api';
import type {
  ChatSession,
  ChatMessage,
  Artifact,
  HealthStatus,
} from './api';
import { Sidebar } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';
import { ArtifactViewer } from './components/ArtifactViewer';
import { Markdown } from './components/Markdown';

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  
  // Settings & Health
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [globalProvider, setGlobalProvider] = useState('ollama');
  const [globalModel, setGlobalModel] = useState('llama3');

  // Input & Modes
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'auto' | 'qa' | 'ship30'>('auto');
  
  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [streamingRoute, setStreamingRoute] = useState<string | null>(null);
  
  // Artifact panel state
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [isArtifactOpen, setIsArtifactOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll system health and fetch initial sessions on load
  const loadHealth = async () => {
    try {
      const data = await fetchHealth();
      setHealth(data);
      // Auto-configure from server defaults if available
      setGlobalProvider(data.llm_config.embedding_provider === 'local' ? 'ollama' : 'ollama');
    } catch (e) {
      console.error('Error fetching system health:', e);
    }
  };

  const loadSessions = async (selectFirst = false) => {
    try {
      const list = await fetchSessions();
      setSessions(list);
      if (selectFirst && list.length > 0 && !activeSessionId) {
        setActiveSessionId(list[0].id);
      }
    } catch (e) {
      console.error('Error listing sessions:', e);
    }
  };

  useEffect(() => {
    loadHealth();
    loadSessions(true);
  }, []);

  // Poll health status occasionally to monitor background ingestion
  useEffect(() => {
    const timer = setInterval(() => {
      loadHealth();
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Fetch full details whenever active session changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      setActiveSession(null);
      return;
    }

    const loadDetails = async () => {
      try {
        const details = await fetchSessionDetails(activeSessionId);
        setMessages(details.messages);
        setActiveSession({
          id: details.id,
          title: details.title,
          model_provider: details.model_provider,
          model_name: details.model_name,
          created_at: details.created_at,
          updated_at: details.updated_at,
        });
      } catch (e) {
        console.error('Failed to load session details:', e);
      }
    };
    loadDetails();
  }, [activeSessionId]);

  // Scroll chat area to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingResponse]);

  const handleCreateSession = async () => {
    try {
      const newSession = await createSession(globalProvider, globalModel);
      await loadSessions();
      setActiveSessionId(newSession.id);
      // Reset artifacts view
      setActiveArtifact(null);
      setIsArtifactOpen(false);
    } catch (e) {
      alert('Failed to start new chat session');
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat session?')) return;
    try {
      await deleteSession(id);
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setActiveArtifact(null);
        setIsArtifactOpen(false);
      }
      loadSessions();
    } catch (e) {
      alert('Failed to delete chat session');
    }
  };

  const handleSaveModelConfig = async (provider: string, model: string) => {
    setGlobalProvider(provider);
    setGlobalModel(model);
    
    // If there is an active session, update its settings as well
    if (activeSessionId) {
      try {
        await updateSession(activeSessionId, {
          model_provider: provider,
          model_name: model,
        });
        loadSessions();
        // Update active session metadata
        if (activeSession) {
          setActiveSession({
            ...activeSession,
            model_provider: provider,
            model_name: model,
          });
        }
      } catch (e) {
        console.error('Failed to update current session config:', e);
      }
    }
  };

  const handleUpdateSessionTitle = async (newTitle: string) => {
    if (!activeSessionId || !newTitle.trim()) return;
    try {
      await updateSession(activeSessionId, { title: newTitle });
      loadSessions();
      if (activeSession) {
        setActiveSession({ ...activeSession, title: newTitle });
      }
    } catch (e) {
      console.error('Failed to update title:', e);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const queryText = (textToSend || input).trim();
    if (!queryText) return;

    let targetSessionId = activeSessionId;

    // Create session first if none is active
    if (!targetSessionId) {
      try {
        const newSession = await createSession(globalProvider, globalModel);
        targetSessionId = newSession.id;
        setActiveSessionId(newSession.id);
        // Wait briefly for details hook to react
        await loadSessions();
      } catch (e) {
        alert('Failed to create session');
        return;
      }
    }

    setInput('');
    setIsStreaming(true);
    setStreamingResponse('');
    setStreamingRoute(null);

    // Optimistically push user message to UI
    const tempUserMsg: ChatMessage = {
      id: Math.random().toString(),
      session_id: targetSessionId,
      role: 'user',
      content: queryText,
      artifacts: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    // Stream chat response
    await streamChat(targetSessionId, queryText, mode, {
      onRoute: (route) => {
        setStreamingRoute(route);
      },
      onToken: (token) => {
        setStreamingResponse((prev) => prev + token);
      },
      onDone: async (savedAssistantMessage) => {
        setIsStreaming(false);
        setStreamingResponse('');
        setStreamingRoute(null);
        
        // Append actual DB saved message (with parsed artifacts)
        setMessages((prev) => [...prev, savedAssistantMessage]);

        // Auto open artifact if generated
        if (savedAssistantMessage.artifacts && savedAssistantMessage.artifacts.length > 0) {
          setActiveArtifact(savedAssistantMessage.artifacts[0]);
          setIsArtifactOpen(true);
        }

        // Auto Rename session title if it was "New Chat"
        if (activeSession?.title === 'New Chat' || (!activeSessionId && queryText)) {
          const generatedTitle = queryText.slice(0, 24) + (queryText.length > 24 ? '...' : '');
          await updateSession(targetSessionId!, { title: generatedTitle });
          loadSessions();
        }
      },
      onError: (err) => {
        setIsStreaming(false);
        setStreamingResponse('');
        setStreamingRoute(null);
        
        const errorMsg: ChatMessage = {
          id: Math.random().toString(),
          session_id: targetSessionId!,
          role: 'assistant',
          content: `⚠️ Error during stream generation:\n${err}`,
          artifacts: [],
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      },
    });
  };

  const handleSelectQuickPrompt = (promptText: string, promptMode: 'qa' | 'ship30') => {
    setMode(promptMode);
    handleSend(promptText);
  };

  // Helper to extract completed artifacts from streaming response in real-time
  const parseStreamingArtifacts = (text: string): Artifact[] => {
    const pattern = /<artifact\s+id=['"]([^'\"]+)['\"]\s+title=['\"]([^'\"]+)['\"]\s+type=['\"]([^'\"]+)['\"]>([\s\S]*?)<\/artifact>/g;
    const list: Artifact[] = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      list.push({
        id: match[1],
        title: match[2],
        type: match[3] as 'html' | 'markdown',
        content: match[4],
      });
    }
    return list;
  };

  const currentStreamingArtifacts = parseStreamingArtifacts(streamingResponse);

  return (
    <div className="app-container">
      {/* 1. Sidebar Nav */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        health={health}
        onSelectSession={setActiveSessionId}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 2. Main Chat Panel */}
      <div className="chat-main" style={{ marginRight: isArtifactOpen ? '0' : '0' }}>
        {/* Header */}
        <div className="chat-header">
          <div className="header-meta">
            {activeSession ? (
              <input
                className="header-title-input"
                value={activeSession.title}
                onChange={(e) => handleUpdateSessionTitle(e.target.value)}
                title="Click to rename"
              />
            ) : (
              <span style={{ fontWeight: 600 }}>The Lenny Growth Assistant</span>
            )}
            {activeSession && (
              <div className="model-config-badge">
                {activeSession.model_provider.toUpperCase()}: {activeSession.model_name}
              </div>
            )}
          </div>
          
          <div className="header-actions">
            {activeArtifact && !isArtifactOpen && (
              <button
                className="primary-btn"
                onClick={() => setIsArtifactOpen(true)}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                Open Viewer
              </button>
            )}
          </div>
        </div>

        {/* Message Container / Flow */}
        <div className="messages-container">
          {messages.length === 0 && !streamingResponse ? (
            /* Welcome Screen / Onboarding */
            <div className="welcome-screen">
              <div className="avatar" style={{ width: '56px', height: '56px', fontSize: '1.4rem', background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)', color: 'white', border: 'none' }}>
                <Sparkles size={24} />
              </div>
              <h1 className="welcome-title">The Lenny Growth Assistant</h1>
              <p className="welcome-subtitle">
                Synthesize growth and product advice grounded strictly in transcripts from **Lenny's Podcast**. Ask questions directly or compile templates in the premium **Ship30for30** digital writing layout.
              </p>
              
              <div className="quick-prompts-grid">
                <div className="quick-prompt-card" onClick={() => handleSelectQuickPrompt("What are curiosity loops and how did SurveyMonkey use them according to Ada Chen Rekhi?", "qa")}>
                  <div className="quick-prompt-title">Q&A: Curiosity Loops</div>
                  <div className="quick-prompt-desc">Ask how executive coach Ada Chen Rekhi models strategic career choices.</div>
                </div>
                <div className="quick-prompt-card" onClick={() => handleSelectQuickPrompt("What frameworks does Lenny recommend for knowing when it is time to leave your job?", "qa")}>
                  <div className="quick-prompt-title">Q&A: Career Growth</div>
                  <div className="quick-prompt-desc">Analyze transition frameworks and warning signs based on transcripts.</div>
                </div>
                <div className="quick-prompt-card" onClick={() => handleSelectQuickPrompt("Write a Ship30for30 essay about knowing when it is time to quit your job.", "ship30")}>
                  <div className="quick-prompt-title">Essay: Career Transitions</div>
                  <div className="quick-prompt-desc">Generate a 1250-word skimmable essay formatted with bullet points and hooks.</div>
                </div>
                <div className="quick-prompt-card" onClick={() => handleSelectQuickPrompt("Generate a premium SaaS pricing model template.", "ship30")}>
                  <div className="quick-prompt-title">Artifact: Landing Page mockup</div>
                  <div className="quick-prompt-desc">Create a landing page layout and render it natively side-by-side.</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Existing Message History List */}
              {messages.map((msg) => (
                <div key={msg.id} className={`message-wrapper ${msg.role}`}>
                  <div className="avatar">{msg.role === 'user' ? 'U' : 'L'}</div>
                  <div className="message-bubble">
                    <Markdown content={msg.content} />
                    
                    {/* Render clickable artifact link cards */}
                    {msg.artifacts && msg.artifacts.map((art) => (
                      <div
                        key={art.id}
                        className="artifact-card-link"
                        onClick={() => {
                          setActiveArtifact(art);
                          setIsArtifactOpen(true);
                        }}
                      >
                        <div className="artifact-info">
                          <div className="artifact-icon-wrapper">
                            <BookOpen size={16} />
                          </div>
                          <div>
                            <div className="artifact-title">{art.title}</div>
                            <div className="artifact-subtitle">Click to view {art.type}</div>
                          </div>
                        </div>
                        <div className="artifact-view-action">
                          Open <ArrowRight size={12} />
                        </div>
                      </div>
                    ))}
                    <span className="message-meta">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}

              {/* Streaming Tokens representation */}
              {streamingResponse && (
                <div className="message-wrapper assistant">
                  <div className="avatar">L</div>
                  <div className="message-bubble">
                    {/* Render active tokens */}
                    <Markdown content={streamingResponse} />

                    {/* Show live/streaming artifacts link cards */}
                    {currentStreamingArtifacts.map((art) => (
                      <div
                        key={art.id}
                        className="artifact-card-link"
                        onClick={() => {
                          setActiveArtifact(art);
                          setIsArtifactOpen(true);
                        }}
                      >
                        <div className="artifact-info">
                          <div className="artifact-icon-wrapper">
                            <RefreshCw size={14} className="pulse-glow" />
                          </div>
                          <div>
                            <div className="artifact-title">{art.title}</div>
                            <div className="artifact-subtitle">Streaming template...</div>
                          </div>
                        </div>
                        <div className="artifact-view-action">Open</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loader representation */}
              {isStreaming && !streamingResponse && (
                <div className="message-wrapper assistant">
                  <div className="avatar">L</div>
                  <div className="message-bubble" style={{ background: 'none', border: 'none', boxShadow: 'none' }}>
                    <div className="typing-indicator">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar Form */}
        <div className="input-area-container">
          <form
            className="chat-input-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <div className="input-wrapper-glass">
              <textarea
                className="chat-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask Lenny a growth question, or request a Ship30for30 essay..."
                disabled={isStreaming}
              />
              <button
                type="submit"
                className="send-message-btn"
                disabled={isStreaming || !input.trim()}
              >
                <Send size={16} color="white" />
              </button>
            </div>

            {/* Input Controls Footer bar */}
            <div className="input-controls">
              <div className="mode-selector">
                <button
                  type="button"
                  className={`mode-btn ${mode === 'auto' ? 'active' : ''}`}
                  onClick={() => setMode('auto')}
                  title="Router will auto-classify your intent"
                >
                  Auto-Route
                </button>
                <button
                  type="button"
                  className={`mode-btn ${mode === 'qa' ? 'active' : ''}`}
                  onClick={() => setMode('qa')}
                  title="Answer questions strictly using Lenny transcripts"
                >
                  Strict Q&A
                </button>
                <button
                  type="button"
                  className={`mode-btn ${mode === 'ship30' ? 'active' : ''}`}
                  onClick={() => setMode('ship30')}
                  title="Synthesize transcripts into a Ship30for30 digital essay"
                >
                  Ship30for30 Essay
                </button>
              </div>

              {streamingRoute && (
                <div className="active-route-indicator">
                  Agent Action: <span>{streamingRoute === 'ship30' ? 'Ship30 Essay Writer' : 'Podcast Q&A'}</span>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* 3. Right Artifact Pane */}
      <ArtifactViewer
        artifact={activeArtifact}
        onClose={() => {
          setIsArtifactOpen(false);
        }}
      />

      {/* 4. Settings Configuration Panel */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        health={health}
        onRefreshHealth={loadHealth}
        currentProvider={globalProvider}
        currentModel={globalModel}
        onSaveModelConfig={handleSaveModelConfig}
      />
    </div>
  );
}
