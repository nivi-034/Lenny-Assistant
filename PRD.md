# Product Requirements Document (PRD)

## 1. Product Name
**The Lenny Growth Assistant**

---

## 2. Executive Summary
The Lenny Growth Assistant is a full-stack, AI-powered conversational workspace. It allows product managers, founders, and growth engineers to query a curated knowledge base of **Lenny's Podcast transcripts** and generate structured, high-value digital content. The application supports dynamic session handling (similar to ChatGPT), a switchable LLM configuration (cloud vs. local Ollama), a strict Q&A agent, an automated Ship30for30 essay generator, and an interactive side-by-side **Artifact Viewer** to render generated HTML components or markdown documents natively.

---

## 3. Goals & User Personas
### 3.1 Goals
- Provide product management professionals with a reliable, transcript-grounded oracle.
- Allow digital creators to instantly draft high-converting digital essays in the Ship30for30 style based on podcast learnings.
- Empower developers and designers to generate visual widgets, dashboards, or mockups and preview them natively side-by-side in real-time.

### 3.2 User Personas
- **The Product Manager (PM):** Wants quick, verified strategic advice from Lenny's podcast guests (e.g. SurveyMonkey marketing loops) without spending hours listening to full episodes.
- **The Content Creator:** Writes digital essays and posts online; wants to use Ship30for30 frameworks (bold skimmability, strong hooks) to capture Lenny's insights.
- **The Evaluator:** Wants to run the application locally, toggle configurations easily between Ollama and Cloud APIs, and check database persistence.

---

## 4. Functional Requirements

### 4.1 Chat & Session Management
- **ChatGPT-like Sidebar:** Users can start a "New Chat" session. Previous sessions are listed in reverse chronological order in a sidebar history.
- **Session Operations:** Users can switch between sessions, rename session titles, and delete sessions (which cascades to delete related message history).
- **Session Persistence:** All sessions, message logs, and configurations are stored in a PostgreSQL database (with SQLite local fallback).

### 4.2 Switchable LLM Layer
- **Provider Selector:** The system must feature a configuration layer allowing users to switch the active LLM engine between:
  1. **Ollama (Local):** For running local models (e.g. `llama3`) on localhost.
  2. **Anthropic Claude (Cloud):** Using Claude SDK and API keys.
  3. **OpenAI GPT (Cloud):** Using OpenAI SDK and API keys.
- **Model Specification:** Users can customize the specific model name string (e.g. `claude-3-5-sonnet-20241022`, `llama3.1`) directly in the Settings.

### 4.3 Knowledge Base RAG Engine
- **Source Corpus:** Ingests markdown transcripts from Claire Vo's public repository (`ChatPRD/lennys-podcast-transcripts`).
- **Semantic Chunking:** Splits transcripts by dialogue turn into ~1200-character blocks, retaining speaker names and timestamps, with a 1-turn overlap.
- **Vector Search:** Computes vector embeddings (Ollama, OpenAI, or a local Hugging Face fallback) and performs cosine similarity matching to feed relevant context blocks into the LLM system prompt.

### 4.4 Agentic Routing & Skills
- **Skill 1: Strict Q&A Agent:** Grounded *strictly* in transcript search context. Answers must not hallucinate or use external knowledge. If facts are not in context, it politely declines to answer.
- **Skill 2: Ship30for30 Writer:** Synthesizes insights into a skimmable digital essay (approx. 1250 words) structured with:
  1. **A Strong Hook:** Bold single-sentence opener.
  2. **Context (1/3/1 Rhythm):** Short introduction explaining the problem.
  3. **Actionable Core:** 3-5 subheads with short paragraphs (max 3 lines), bullet lists, and bold text.
  4. **Clear Takeaway:** Punchy single-sentence summary.
- **Routing Selector:** The UI allows users to choose:
  - **Auto-Route:** Uses a regex/keyword classifier on the backend to detect content writing intent and route appropriately.
  - **Strict Q&A:** Overrides and forces Q&A mode.
  - **Ship30for30:** Overrides and forces Essay Writer mode.

### 4.5 In-App Artifact Viewer
- **Nesting UI:** When the assistant generates HTML templates or markdown documents, it wraps the core content in custom XML-like `<artifact>` tags.
- **Side-by-Side Panel:** The frontend extracts the tags, displays a placeholder card in the chat stream, and automatically slides out a split-screen viewer.
- **Tabbed Layout:**
  - **Preview Tab:** Renders HTML inside a sandboxed `iframe` (isolated stylesheet) or renders markdown with premium CSS formatting.
  - **Code Tab:** Renders the raw text code block.
- **File Utilities:** Users can copy the raw code or download the file directly from the header controls.

---

## 5. Non-Functional Requirements
- **Performance:** Stream tokens in real-time via Server-Sent Events (SSE) so users see response typing immediately.
- **Robustness:** Database fallbacks (Postgres to SQLite) and embedding fallbacks (API to local Hugging Face models) must ensure the application boots and works out-of-the-box.
- **Visual Excellence:** Premium dark theme, glassmorphic blurred panels, glowing accent states, Outfit typography, and responsive layouts.
