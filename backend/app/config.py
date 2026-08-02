import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # Database Settings
    # Default to postgresql if available, fallback to sqlite for easy developer setup
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/lenny_assistant"
    
    # LLM Provider Keys
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    
    # Ollama Settings
    OLLAMA_HOST: str = "http://localhost:11434"
    OLLAMA_CHAT_MODEL: str = "llama3"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"
    
    # RAG embedding settings
    # Options: "local" (uses pre-installed transformers with MiniLM), "ollama", "openai"
    EMBEDDING_PROVIDER: str = "local"
    
    # Port / Host Settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Configuration sources: Environment variables and .env file
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
