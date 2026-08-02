import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, Date, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.app.database import Base

class ChatSession(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False, default="New Chat")
    model_provider = Column(String, nullable=False, default="ollama")
    model_name = Column(String, nullable=False, default="llama3")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationship to messages
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    artifacts = Column(JSON, nullable=True, default=list)  # List of dicts representing artifacts
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship to session
    session = relationship("ChatSession", back_populates="messages")

class TranscriptChunk(Base):
    __tablename__ = "transcript_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    episode_title = Column(String, nullable=False)
    guest = Column(String, nullable=False)
    publish_date = Column(Date, nullable=True)
    content = Column(Text, nullable=False)
    embedding = Column(JSON, nullable=False)  # List of floats representing the embedding vector
