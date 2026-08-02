import requests
from typing import List
from backend.app.config import settings

# Lazy imports for transformers/torch to speed up startup if not used
_local_model = None
_local_tokenizer = None

def get_local_embedding(text: str) -> List[float]:
    global _local_model, _local_tokenizer
    import torch
    from transformers import AutoTokenizer, AutoModel
    
    if _local_model is None or _local_tokenizer is None:
        model_name = "sentence-transformers/all-MiniLM-L6-v2"
        _local_tokenizer = AutoTokenizer.from_pretrained(model_name)
        _local_model = AutoModel.from_pretrained(model_name)
    
    # Tokenize input
    inputs = _local_tokenizer(
        text, 
        padding=True, 
        truncation=True, 
        return_tensors="pt", 
        max_length=512
    )
    
    # Compute token embeddings
    with torch.no_grad():
        model_output = _local_model(**inputs)
        
    # Mean pooling
    token_embeddings = model_output[0]
    attention_mask = inputs['attention_mask']
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
    sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
    embeddings = sum_embeddings / sum_mask
    
    # L2 normalize
    embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
    return embeddings[0].tolist()

def get_ollama_embedding(text: str) -> List[float]:
    url = f"{settings.OLLAMA_HOST.rstrip('/')}/api/embeddings"
    payload = {
        "model": settings.OLLAMA_EMBED_MODEL,
        "prompt": text
    }
    response = requests.post(url, json=payload, timeout=30)
    response.raise_for_status()
    return response.json()["embedding"]

def get_openai_embedding(text: str) -> List[float]:
    from openai import OpenAI
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not set but OpenAI embedding provider was selected.")
    
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.embeddings.create(
        input=[text],
        model="text-embedding-3-small"
    )
    return response.data[0].embedding

def get_embedding(text: str) -> List[float]:
    """
    Unified function to get embedding based on EMBEDDING_PROVIDER config.
    """
    provider = settings.EMBEDDING_PROVIDER.lower()
    
    # Clean/normalize text to remove newlines
    clean_text = text.replace("\n", " ").strip()
    if not clean_text:
        # Return dummy vector of appropriate length (384 for MiniLM)
        return [0.0] * (384 if provider == "local" else 1536)
        
    if provider == "ollama":
        try:
            return get_ollama_embedding(clean_text)
        except Exception as e:
            # Fallback to local if Ollama connection fails
            print(f"Ollama embedding failed: {e}. Falling back to local embedder.")
            return get_local_embedding(clean_text)
    elif provider == "openai":
        try:
            return get_openai_embedding(clean_text)
        except Exception as e:
            print(f"OpenAI embedding failed: {e}. Falling back to local embedder.")
            return get_local_embedding(clean_text)
    else:
        return get_local_embedding(clean_text)
