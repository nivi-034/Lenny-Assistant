import json
import re
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import ChatSession, ChatMessage
from backend.app.schemas import ChatRequest
from backend.app.services.agent import prepare_agent_payload
from backend.app.services.llm import stream_chat

router = APIRouter(prefix="/api/chat", tags=["chat"])

def extract_artifacts(text: str) -> list:
    """
    Parses <artifact> tags from the generated text and extracts their attributes and content.
    Matches formats like: <artifact id="some-id" title="Some Title" type="html|markdown">content</artifact>
    """
    # Pattern to handle single or double quotes for attributes
    pattern = r"<artifact\s+id=['\"]([^'\"]+)['\"]\s+title=['\"]([^'\"]+)['\"]\s+type=['\"]([^'\"]+)['\"]>(.*?)</artifact>"
    matches = re.findall(pattern, text, re.DOTALL)
    
    artifacts = []
    for match in matches:
        art_id, art_title, art_type, art_content = match
        artifacts.append({
            "id": art_id.strip(),
            "title": art_title.strip(),
            "type": art_type.strip(),
            "content": art_content.strip()
        })
    return artifacts

@router.post("/stream")
async def chat_stream(request: ChatRequest, db: Session = Depends(get_db)):
    # 1. Fetch active session
    session = db.query(ChatSession).filter(ChatSession.id == request.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # 2. Save user message to database
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=request.content
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)
    
    # 3. Fetch session history (excluding the current user message to pass as history)
    history_messages = db.query(ChatMessage)\
        .filter(ChatMessage.session_id == session.id)\
        .filter(ChatMessage.id != user_msg.id)\
        .order_by(ChatMessage.created_at.asc())\
        .all()
        
    chat_history = [{"role": msg.role, "content": msg.content} for msg in history_messages]
    
    # 4. Prepare payload (Agentic routing + RAG context search + System Prompt assembly)
    # Since search_transcripts does numpy operations and standard DB query, we run it in thread pool if needed, 
    # but since it's fast we run it inline.
    route, messages = prepare_agent_payload(db, request.content, chat_history, request.mode)
    
    # 5. Define streaming generator
    async def event_generator():
        # Yield the active agentic route first
        yield f"data: {json.dumps({'event': 'route', 'route': route})}\n\n"
        await asyncio.sleep(0.01)
        
        full_response = ""
        
        # Stream tokens from the unified LLM wrapper
        async for token in stream_chat(messages, session.model_provider, session.model_name):
            full_response += token
            yield f"data: {json.dumps({'event': 'token', 'text': token})}\n\n"
            
        # 6. Post-stream processing: Parse artifacts and save assistant message
        try:
            artifacts = extract_artifacts(full_response)
            
            # Save assistant message to DB
            assistant_msg = ChatMessage(
                session_id=session.id,
                role="assistant",
                content=full_response,
                artifacts=artifacts
            )
            db.add(assistant_msg)
            
            # Update session modified timestamp
            session.updated_at = assistant_msg.created_at
            db.commit()
            db.refresh(assistant_msg)
            
            done_payload = {
                'event': 'done',
                'message': {
                    'id': assistant_msg.id,
                    'session_id': assistant_msg.session_id,
                    'role': 'assistant',
                    'content': assistant_msg.content,
                    'artifacts': assistant_msg.artifacts,
                    'created_at': assistant_msg.created_at.isoformat() if assistant_msg.created_at else None
                }
            }
            yield f"data: {json.dumps(done_payload)}\n\n"
        except Exception as e:
            db.rollback()
            yield f"data: {json.dumps({'event': 'error', 'message': f'Failed saving history: {str(e)}'})}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")
