# The Lenny Growth Assistant

The Lenny Growth Assistant is a full-stack, AI-powered conversational web application. It ingests transcripts from *Lenny's Podcast*, allows users to ask product management and growth Q&A questions (strictly grounded in transcripts), and synthesizes answers into the **Ship30for30 digital essay style**. Furthermore, it features an interactive **Artifact Viewer** to render generated HTML templates or markdown documents side-by-side with the chat.

---

## 🏗️ Architecture Overview

The application is structured as a split client-server architecture:

```
                  +--------------------------------+
                  |         React Client           |
                  |     (Vite + TypeScript)        |
                  +--------------------------------+
                                  |
                                  | HTTP / SSE (Server-Sent Events)
                                  v
                  +--------------------------------+
                  |        FastAPI Backend         |
                  |       (Python 3.12)            |
                  +--------------------------------+
                    |             |            |
                    |             |            |
      SQLAlchemy ORM|             |            | HTTP Client
                    v             |            v
    +-----------------------+     |    +--------------------+
    |      Database         |     |    |     Local LLM      |
    |  PostgreSQL / SQLite  |     |    |    (Ollama API)    |
    +-----------------------+     |    +--------------------+
                                  |
                                  | SDK client
                                  v
                       +----------------------+
                       |      Cloud LLM       |
                       |  (Claude / OpenAI)   |
                       +----------------------+
```

1. **Frontend (Vite + React + TS):** 
   A single-page workspace styled with premium dark glassmorphism. It establishes a live Server-Sent Events (SSE) connection with the backend to stream tokens, extracts `<artifact>` blocks on the fly, and displays them in a side-by-side preview panel.
2. **Backend (FastAPI):**
   Exposes session CRUD REST endpoints and a streaming chat endpoint.
3. **Agentic Router & Skills (`agent.py`):**
   Classifies incoming user messages into either **Strict Q&A** or **Ship30for30 Writer** mode.
   - *Strict Q&A Agent:* Performs semantic search on the vector transcript chunks and restricts responses strictly to facts present in the excerpts.
   - *Ship30for30 Agent:* Synthesizes transcript insights into a skimmable 1250-word digital essay with a strong hook, 1/3/1 rhythms, and bold highlights.
4. **Database (PostgreSQL / SQLite fallback):**
   Persists chat sessions, configurations, and historical messages. The RAG index is stored in the database (`transcript_chunks` table).

---

## 🛠️ Step-by-Step Installation & Local Run

### 1. Prerequisites
- **Python:** Version 3.10+ (tested on Python 3.12)
- **Node.js:** Version 18+ (tested on Node v22)
- **Git**

---

### 2. Backend Setup
1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <repository-url>
   cd lennys-growth-assistant
   ```
2. Navigate to the backend folder and create a virtual environment:
   ```bash
   # Create environment
   python -m venv venv
   # Activate environment (Windows)
   venv\Scripts\activate
   # Activate environment (Mac/Linux)
   source venv/bin/activate
   ```
3. Install the required packages:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Set up environment variables. Create a `.env` file in the project root:
   ```env
   # Database: primary PostgreSQL URL, or fallback SQLite for local testing
   DATABASE_URL=sqlite:///./lenny_assistant.db

   # API Keys (Provide to enable Cloud LLM engines)
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here

   # Local Ollama Settings (Verify Ollama is running on port 11434)
   OLLAMA_HOST=http://localhost:11434
   OLLAMA_CHAT_MODEL=llama3
   OLLAMA_EMBED_MODEL=nomic-embed-text

   # Embedding configuration: "local" (free offline sentence-transformers), "ollama", or "openai"
   EMBEDDING_PROVIDER=local
   ```

---

### 3. Data Ingestion
To populate the database with transcripts:
1. Clone the public Lenny's transcripts repository into the project directory:
   ```bash
   git clone --depth 1 https://github.com/ChatPRD/lennys-podcast-transcripts.git data/transcripts
   ```
2. Run the Python ingestion script. You can specify a `--limit` to index only a small subset of episodes in seconds (recommended for quick evaluation):
   ```bash
   # Index 5 episodes (takes 10-15 seconds with 'local' embedding provider)
   python -m scripts.ingest --limit 5

   # Index all 300+ episodes
   python -m scripts.ingest --all
   ```

---

### 4. Running the Backend Server
Start the FastAPI server using Uvicorn:
```bash
# Run from the project root directory
uvicorn backend.app.main:app --reload --port 8000
```
The interactive Swagger API docs will be available at `http://localhost:8000/docs`.

---

### 5. Frontend Setup
1. Open a new terminal window and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install Node packages:
   ```bash
   npm install
   ```
3. Launch the Vite local dev server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to the local host address: `http://localhost:5173`.

---

## ⚡ Switchable LLM Layer (Local Ollama vs. Cloud)

Our system is designed to allow developers and users to toggle the underlying LLM dynamically per session:
1. Click **Settings** in the sidebar footer.
2. Under **LLM Provider**, select:
   - **Ollama:** Set the local model name (e.g. `llama3` or `mistral`). Ensure Ollama is running (`ollama serve`) and you have pulled the model (`ollama pull llama3`).
   - **Anthropic Claude:** Enter model name (e.g. `claude-3-5-sonnet-20241022`). Requires `ANTHROPIC_API_KEY` in `.env`.
   - **OpenAI GPT:** Enter model name (e.g. `gpt-4o-mini`). Requires `OPENAI_API_KEY` in `.env`.
3. Click **Save Changes**. The backend will instantly route subsequent messages in the session to the selected provider.
