from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class LLMConfig(BaseModel):
    provider: str = Field(..., description="LLM provider: 'ollama', 'anthropic', 'openai'")
    model: str = Field(..., description="LLM model name")

class SessionCreate(BaseModel):
    title: Optional[str] = "New Chat"
    model_provider: Optional[str] = "ollama"
    model_name: Optional[str] = "llama3"

class SessionUpdate(BaseModel):
    title: Optional[str] = None
    model_provider: Optional[str] = None
    model_name: Optional[str] = None

class ArtifactResponse(BaseModel):
    id: str
    title: str
    type: str  # "html" or "markdown"
    content: str

class MessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    artifacts: List[Dict[str, Any]] = []
    created_at: datetime

    class Config:
        from_attributes = True

class SessionResponse(BaseModel):
    id: str
    title: str
    model_provider: str
    model_name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SessionDetailResponse(SessionResponse):
    messages: List[MessageResponse] = []

class ChatRequest(BaseModel):
    session_id: str
    content: str
    mode: Optional[str] = "auto"  # "auto", "qa", "ship30"
