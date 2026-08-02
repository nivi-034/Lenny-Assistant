import re
from sqlalchemy.orm import Session
from typing import List, Dict, Tuple, Any
from backend.app.services.rag import search_transcripts

# Regex patterns for routing classification
CONTENT_GENERATION_KEYWORDS = [
    r"\bessay\b", r"\bwrite\b", r"\bgenerate\b", r"\bcreate\b", r"\bpost\b",
    r"\barticle\b", r"\bnewsletter\b", r"\bship30\b", r"\bship\s*30\b",
    r"\batomic\b", r"\bmarkdown\b", r"\bhtml\b", r"\btemplate\b", r"\bpage\b"
]

def route_query(query: str, user_mode: str = "auto") -> str:
    """
    Classifies the query route as "ship30" or "qa".
    If user_mode is explicit ("qa" or "ship30"), that is returned directly.
    """
    if user_mode in ["qa", "ship30"]:
        return user_mode
        
    # Auto-routing based on query keywords
    query_lower = query.lower()
    for pattern in CONTENT_GENERATION_KEYWORDS:
        if re.search(pattern, query_lower):
            return "ship30"
            
    return "qa"

# Shared instructions telling the LLM how and when to output artifacts.
ARTIFACT_SYSTEM_INSTRUCTIONS = """
=== ARTIFACT GENERATION INSTRUCTIONS ===
When the user asks you to write code, create an HTML page/component, or write a structured document (like a detailed guide, essay, or checklist), you MUST wrap the core content in an `<artifact>` tag. This enables a side-by-side viewer in the UI.

Artifact format:
<artifact id="[unique-slug]" title="[Descriptive Title]" type="[html|markdown]">
[Put ONLY the content here. No explanations, no markdown blocks around the HTML. If html, write standard complete self-contained HTML/CSS. If markdown, write clean formatted markdown.]
</artifact>

Rules for choosing type:
- Use type="markdown" for essays (like the Ship30for30 essay), long reports, structured plans, or textual documents.
- Use type="html" for UI components, web pages, landing pages, interactive forms, and visual dashboards (include styling inside a <style> block).

Keep chat text outside of the <artifact> tag brief (e.g. "I've generated the essay/page for you. You can view it on the right.").
"""

QA_SYSTEM_PROMPT = """
You are the Q&A Agent for The Lenny Growth Assistant.
Your goal is to answer the user's questions about product management, growth, hiring, and startup strategy.

CRITICAL CONSTRAINT: You must answer the user's questions STRICTLY using the retrieved podcast transcript excerpts provided below.
- Do NOT use general knowledge or make up facts.
- If the answer cannot be found in the provided excerpts, state: "I'm sorry, but I couldn't find that information in Lenny's podcast transcripts."
- Cite the episodes and guests when answering (e.g., "According to Ada Chen Rekhi in her episode...").

Retrieved Context Excerpts:
{context}

{artifact_instructions}
"""

SHIP30_SYSTEM_PROMPT = """
You are the Ship30for30 Writer Agent for The Lenny Growth Assistant.
Your goal is to write a comprehensive, high-quality digital essay (approx. 1250 words) on the topic requested.
You must synthesize the insights from Lenny's Podcast transcripts provided below to write this essay.

You MUST write the essay inside an `<artifact id="ship30-essay" title="[Title of Essay]" type="markdown">` tag so it renders on the side screen.
Provide a very short introductory sentence in the chat before the tag (e.g., "Here is the Ship30for30 essay covering [topic]:").

You MUST adhere strictly to the **Ship30for30 digital writing framework**:
1. **Hook**: Begin the essay with a single, bold, highly engaging sentence that promises massive value, identifies a pain point, or challenges status quo.
2. **Context/Why (1/3/1 Rhythm)**: Write a brief introductory section explaining why this topic is critical and the friction the reader faces. Use the 1/3/1 visual layout rhythm: a single-sentence opener, a 3-sentence body, and a single-sentence transition.
3. **Actionable Core (Heavily Formatted for Skimmability)**: Divide the essay into 3 to 5 clear subheadings. Under each subheading, use short paragraphs (maximum 3 lines), bulleted/numbered lists, and bold key terms so that the reader can scan the section in 10 seconds and understand the main points.
4. **Clear Takeaway/Conclusion**: End the essay with a single-sentence punchy takeaway or an actionable next step for the reader.

Retrieved Context Excerpts:
{context}

{artifact_instructions}
"""

def prepare_agent_payload(db: Session, query: str, chat_history: List[Dict[str, str]], mode: str = "auto") -> Tuple[str, List[Dict[str, str]]]:
    """
    Decides the route, performs RAG, constructs the system prompt,
    and returns (route_name, full_messages_list).
    """
    route = route_query(query, mode)
    
    # 1. Retrieve relevant transcript chunks
    # We query top 6 chunks for QA and top 8 chunks for Ship30 to give rich context
    top_k = 8 if route == "ship30" else 6
    search_results = search_transcripts(db, query, top_k=top_k)
    
    # 2. Format context
    context_blocks = []
    for idx, item in enumerate(search_results):
        block = f"--- EXCERPT {idx+1} (Episode: {item['episode_title']}, Guest: {item['guest']}) ---\n{item['content']}"
        context_blocks.append(block)
        
    context_str = "\n\n".join(context_blocks) if context_blocks else "No transcript context available."
    
    # 3. Build system prompt based on route
    if route == "ship30":
        system_prompt = SHIP30_SYSTEM_PROMPT.format(
            context=context_str,
            artifact_instructions=ARTIFACT_SYSTEM_INSTRUCTIONS
        )
    else:
        system_prompt = QA_SYSTEM_PROMPT.format(
            context=context_str,
            artifact_instructions=ARTIFACT_SYSTEM_INSTRUCTIONS
        )
        
    # 4. Construct messages payload
    messages = [{"role": "system", "content": system_prompt}]
    
    # Append chat history (limiting history to last 6 turns to keep context window small)
    for msg in chat_history[-6:]:
        messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })
        
    # Append current user query
    messages.append({"role": "user", "content": query})
    
    return route, messages
