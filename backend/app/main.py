import os
from fastapi import FastAPI, Depends, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any

from backend.app.config import settings
from backend.app.database import engine, Base, get_db
from backend.app.models import TranscriptChunk, ChatSession
from backend.app.routes import sessions, chat
from scripts.ingest import ingest_directory

# Create database tables if they don't exist on boot
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="The Lenny Growth Assistant API",
    description="Backend API for Q&A and Ship30for30 content generation on Lenny's Podcast transcripts",
    version="1.0.0"
)

# Configure CORS for local development and client integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to frontend origin in production (e.g. http://localhost:5173)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(sessions.router)
app.include_router(chat.router)

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    # Check Database connection
    db_status = "healthy"
    chunks_count = 0
    sessions_count = 0
    try:
        db.execute(text("SELECT 1"))
        chunks_count = db.query(TranscriptChunk).count()
        sessions_count = db.query(ChatSession).count()
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
        
    # Check environment keys loaded
    env_keys = {
        "anthropic_api_key_set": settings.ANTHROPIC_API_KEY is not None and settings.ANTHROPIC_API_KEY != "",
        "openai_api_key_set": settings.OPENAI_API_KEY is not None and settings.OPENAI_API_KEY != "",
    }
    
    return {
        "status": "online",
        "database": {
            "status": db_status,
            "chunks_indexed": chunks_count,
            "sessions_active": sessions_count,
            "url_type": "sqlite" if settings.DATABASE_URL.startswith("sqlite") else "postgresql"
        },
        "llm_config": {
            "ollama_host": settings.OLLAMA_HOST,
            "embedding_provider": settings.EMBEDDING_PROVIDER,
            "env_keys": env_keys
        }
    }

def bg_ingest_transcripts(limit: int, clear_existing: bool):
    from backend.app.database import SessionLocal
    db = SessionLocal()
    try:
        if clear_existing:
            db.query(TranscriptChunk).delete()
            db.commit()
        ingest_directory(db, limit=limit)
    except Exception as e:
        print(f"Background ingestion failed: {e}")
    finally:
        db.close()

@app.post("/api/ingest", status_code=status.HTTP_202_ACCEPTED)
def trigger_ingestion(
    background_tasks: BackgroundTasks,
    limit: int = 10,
    clear_existing: bool = True
) -> Dict[str, str]:
    """
    Trigger transcript ingestion asynchronously in the background.
    """
    # Verify transcripts folder exists before launching task
    episodes_dir = "data/transcripts/episodes"
    if not os.path.exists(episodes_dir):
        return {
            "status": "error",
            "message": f"Transcripts folder '{episodes_dir}' not found. Please clone the repository first."
        }
        
    background_tasks.add_task(bg_ingest_transcripts, limit, clear_existing)
    return {
        "status": "pending",
        "message": f"Ingestion of top {limit} episodes started in the background. Check /api/health to monitor progress."
    }

@app.get("/")
def read_root():
    return {"message": "Welcome to The Lenny Growth Assistant API. Go to /docs for Swagger UI documentation."}
