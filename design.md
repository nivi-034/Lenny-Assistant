# UI/UX Design Document

This document outlines the design principles, visual aesthetics, component layout, and interactive micro-animations created for **The Lenny Growth Assistant**.

---

## 1. Style Guide & Design Token System

We follow a **Premium Dark Glassmorphic Style** to create a highly refined, professional workspace for creators and product leaders.

### 1.1 Color Palette
- **Main Background (`#0b0f19`):** Deep slate-navy. This acts as the canvas, preventing eye strain and emphasizing bright accents.
- **Sidebar Background (`#060911`):** Pitch black-blue. Establishes clear visual hierarchy between navigation and active work area.
- **Glass Card Background (`rgba(17, 24, 39, 0.6)`):** Dark translucent gray. Combines with `backdrop-filter: blur(16px)` to create depth.
- **Indigo Accent (`#6366f1`):** Primary brand accent. Used for core active states, user indicators, and main call-to-actions.
- **Cyan Accent (`#06b6d4`):** Secondary assistant brand color. Denotes assistant responses and AI route indications.
- **Emerald Accent (`#10b981`):** Success status indicators (e.g., active database connection).
- **Rose Accent (`#f43f5e`):** Alerts and delete actions.

### 1.2 Typography
- **Primary Body/Headers:** `Outfit` (imported from Google Fonts). A modern, slightly geometric sans-serif that looks extremely premium in both heavy headlines and skimmable bullet lists.
- **Code Snippets/Inspector:** `JetBrains Mono`. A clean monospace font optimized for code readability.

---

## 2. Interactive Micro-Animations

To make the workspace feel reactive and alive, we have implemented several dynamic transitions:
1. **Pulse Glows:** The active database connection indicator in the sidebar footer slowly pulses (`animation: pulse 2s infinite`) to show the backend is running and healthy.
2. **Spring Hover Scaling:** Primary buttons (like "New Chat" and "Send") scale up slightly (`transform: scale(1.05)`) with a spring-like ease transition on hover to encourage interaction.
3. **Slide-Out Transition:** The **Artifact Viewer** slides out smoothly from the right side of the screen (`animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)`) when an artifact is opened, adjusting the viewport layout without jarring cuts.
4. **Chat Loader Bubbles:** A bouncing triple-dot animation (`typingBounce`) provides visual feedback when the LLM is thinking but has not yet returned the first streaming token.
5. **Interactive Cards:** Inline artifact links within messages act as interactive cards, glowing Indigo and moving upward slightly on hover to signify clickability.

---

## 3. Component Layout & Workspace Architecture

We use a **split three-panel layout** to organize features logically:

```
+------------------+----------------------------------+------------------------+
|                  |                                  |                        |
|  SIDEBAR         |  CHAT WINDOW                     |  ARTIFACT VIEWER       |
|                  |                                  |                        |
|  - New Chat      |  - Title Renaming                |  - Title & Type        |
|  - History List  |  - Streaming Messages Area       |  - Tabs: Preview/Code  |
|  - DB Status     |  - Custom Markdown Renderer      |  - Isolated Iframe     |
|  - Settings      |  - Textarea & Mode Selector      |  - Copy & Download     |
|                  |                                  |                        |
+------------------+----------------------------------+------------------------+
```

### 3.1 Sidebar (280px Fixed)
Maintains historical context. The footer lists the active database status and holds the Settings trigger.

### 3.2 Chat Window (Flex Fill)
Handles input and output. Features a dynamic selector at the bottom to force Q&A vs. Ship30for30 or let the router auto-classify.

### 3.3 Artifact Viewer (50vw Split Screen)
The star of the workspace. If the AI output contains a document or template, the right side opens automatically.
- **Preview Mode (HTML):** Renders the code in a sandboxed `iframe` using `srcDoc`. This guarantees that the template CSS is entirely isolated from the main app and cannot break our own UI styling.
- **Preview Mode (Markdown):** Renders the Ship30for30 essays with dedicated margins, high contrast typography, and custom borders to read like a polished article.
- **Code Mode:** Shows the syntax-safe raw code.
