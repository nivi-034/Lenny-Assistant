import numpy as np
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from backend.app.models import TranscriptChunk
from backend.app.services.embedding import get_embedding

# Simple in-memory cache for chunks to avoid DB queries on every user message
_cached_chunks = None

def get_all_chunks(db: Session, force_reload: bool = False) -> List[TranscriptChunk]:
    global _cached_chunks
    if _cached_chunks is None or force_reload:
        _cached_chunks = db.query(TranscriptChunk).all()
    return _cached_chunks

def search_transcripts(db: Session, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Find the most relevant transcript chunks for a given query.
    """
    # 1. Get embedding for the query
    query_vector = get_embedding(query)
    query_arr = np.array(query_vector)
    
    # 2. Get all chunks from the DB
    chunks = get_all_chunks(db)
    if not chunks:
        return []
        
    # 3. Calculate cosine similarity
    results = []
    for chunk in chunks:
        # Check if chunk has valid embedding
        if not chunk.embedding or not isinstance(chunk.embedding, list):
            continue
            
        chunk_arr = np.array(chunk.embedding)
        
        # Ensure dimensions match
        if query_arr.shape != chunk_arr.shape:
            # If dimensions differ, skip or handle (e.g. padding/trimming)
            min_dim = min(len(query_arr), len(chunk_arr))
            q_vec = query_arr[:min_dim]
            c_vec = chunk_arr[:min_dim]
        else:
            q_vec = query_arr
            c_vec = chunk_arr
            
        # Cosine similarity formula: dot(A, B) / (norm(A) * norm(B))
        dot_product = np.dot(q_vec, c_vec)
        norm_q = np.linalg.norm(q_vec)
        norm_c = np.linalg.norm(c_vec)
        
        if norm_q == 0 or norm_c == 0:
            similarity = 0.0
        else:
            similarity = dot_product / (norm_q * norm_c)
            
        results.append({
            "chunk": chunk,
            "similarity": float(similarity)
        })
        
    # 4. Sort by similarity descending
    results.sort(key=lambda x: x["similarity"], reverse=True)
    
    # 5. Format output
    top_results = []
    for item in results[:top_k]:
        chunk = item["chunk"]
        top_results.append({
            "id": chunk.id,
            "episode_title": chunk.episode_title,
            "guest": chunk.guest,
            "publish_date": str(chunk.publish_date) if chunk.publish_date else None,
            "content": chunk.content,
            "similarity": item["similarity"]
        })
        
    return top_results
