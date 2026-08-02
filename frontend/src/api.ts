// Client service for API integration with the FastAPI backend

export interface LLMConfig {
  provider: string;
  model: string;
}

export interface ChatSession {
  id: string;
  title: string;
  model_provider: string;
  model_name: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  artifacts: Artifact[];
  created_at: string;
}

export interface Artifact {
  id: string;
  title: string;
  type: 'html' | 'markdown';
  content: string;
}

export interface HealthStatus {
  status: string;
  database: {
    status: string;
    chunks_indexed: number;
    sessions_active: number;
    url_type: string;
  };
  llm_config: {
    ollama_host: string;
    embedding_provider: string;
    env_keys: {
      anthropic_api_key_set: boolean;
      openai_api_key_set: boolean;
    };
  };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error('Failed to fetch backend health');
  }
  return response.json();
}

export async function triggerIngestion(limit: number): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/ingest?limit=${limit}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error('Failed to trigger transcript ingestion');
  }
  return response.json();
}

export async function fetchSessions(): Promise<ChatSession[]> {
  const response = await fetch(`${API_BASE_URL}/sessions`);
  if (!response.ok) {
    throw new Error('Failed to fetch chat sessions');
  }
  return response.json();
}

export async function createSession(provider: string, model: string, title?: string): Promise<ChatSession> {
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: title || 'New Chat',
      model_provider: provider,
      model_name: model,
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to create new session');
  }
  return response.json();
}

export async function fetchSessionDetails(sessionId: string): Promise<ChatSession & { messages: ChatMessage[] }> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch session details');
  }
  return response.json();
}

export async function updateSession(sessionId: string, data: { title?: string; model_provider?: string; model_name?: string }): Promise<ChatSession> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update session');
  }
  return response.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete session');
  }
}

export interface StreamCallbacks {
  onRoute?: (route: string) => void;
  onToken?: (token: string) => void;
  onDone?: (message: ChatMessage) => void;
  onError?: (error: string) => void;
}

export async function streamChat(
  sessionId: string,
  content: string,
  mode: string,
  callbacks: StreamCallbacks
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        content,
        mode,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('ReadableStream not supported by response');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Save the last incomplete line back to the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned.startsWith('data: ')) continue;
        
        try {
          const jsonStr = cleaned.slice(6);
          const parsed = JSON.parse(jsonStr);
          
          if (parsed.event === 'route') {
            callbacks.onRoute?.(parsed.route);
          } else if (parsed.event === 'token') {
            callbacks.onToken?.(parsed.text);
          } else if (parsed.event === 'done') {
            callbacks.onDone?.(parsed.message);
          } else if (parsed.event === 'error') {
            callbacks.onError?.(parsed.message);
          }
        } catch (e) {
          console.error('Error parsing SSE line:', cleaned, e);
        }
      }
    }
  } catch (error: any) {
    callbacks.onError?.(error.message || 'Network stream error');
  }
}
