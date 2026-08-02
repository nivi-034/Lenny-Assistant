import os
import re
import yaml
import argparse
from datetime import datetime
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.database import engine, Base, SessionLocal
from backend.app.models import TranscriptChunk
from backend.app.services.embedding import get_embedding

def parse_transcript_file(file_path: str):
    """
    Parses a single transcript markdown file.
    Returns metadata and raw text.
    """
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Split by YAML frontmatter delimiters
    parts = content.split("---")
    if len(parts) < 3:
        # Fallback if frontmatter format is weird
        return {"title": os.path.basename(os.path.dirname(file_path)), "guest": "Unknown"}, content
        
    frontmatter_text = parts[1]
    body_text = "---".join(parts[2:])
    
    try:
        metadata = yaml.safe_load(frontmatter_text)
    except Exception as e:
        print(f"Error parsing frontmatter for {file_path}: {e}")
        metadata = {}
        
    # Clean up metadata fields
    guest = metadata.get("guest", "Unknown")
    title = metadata.get("title", "Untitled Episode")
    
    publish_date_raw = metadata.get("publish_date")
    publish_date = None
    if publish_date_raw:
        if isinstance(publish_date_raw, datetime):
            publish_date = publish_date_raw.date()
        elif isinstance(publish_date_raw, str):
            try:
                publish_date = datetime.strptime(publish_date_raw.strip(), "%Y-%m-%d").date()
            except ValueError:
                pass
                
    return {
        "guest": guest,
        "title": title,
        "publish_date": publish_date,
    }, body_text

def chunk_transcript(metadata: dict, body_text: str) -> list:
    """
    Groups speaker turns into semantic chunks of roughly ~1200 characters
    with a 1 dialogue turn overlap to preserve context.
    """
    # Find the "Transcript" header to start parsing
    transcript_start = body_text.find("## Transcript")
    if transcript_start != -1:
        transcript_content = body_text[transcript_start + len("## Transcript"):]
    else:
        transcript_content = body_text
        
    # Regular expression to identify dialogue turns:
    # "Speaker Name (00:00:00):" or "(00:00:00):"
    pattern = r"([\w\s\.\-\&]+)?\(\d{2}:\d{2}:\d{2}\):"
    
    # Split by dialogue turns
    turns_raw = re.split(pattern, transcript_content)
    # The split will return [text_before, speaker_1, text_1, speaker_2, text_2...]
    # Let's rebuild the turns properly
    turns = []
    
    # Get all speaker names and timestamps matches
    headers = re.findall(r"(([\w\s\.\-\&]+)?\((\d{2}:\d{2}:\d{2})\):)", transcript_content)
    
    # If regex split doesn't work as expected, fall back to simple paragraph splitting
    if not headers or len(turns_raw) < len(headers):
        paragraphs = [p.strip() for p in transcript_content.split("\n\n") if p.strip()]
        chunks = []
        current_chunk = []
        current_len = 0
        for p in paragraphs:
            current_chunk.append(p)
            current_len += len(p)
            if current_len >= 1200:
                chunks.append("\n\n".join(current_chunk))
                # Keep last paragraph as overlap
                current_chunk = [current_chunk[-1]] if current_chunk else []
                current_len = len(current_chunk[0]) if current_chunk else 0
        if current_chunk:
            chunks.append("\n\n".join(current_chunk))
        return chunks

    # We match turns_raw index to headers.
    # turns_raw[0] is text before first header (usually title or empty)
    # Then for each header, we have speaker name and turn text.
    current_speaker = "Unknown"
    for i, header_match in enumerate(headers):
        # header_match is (FullHeader, SpeakerName, Timestamp)
        full_header, speaker, timestamp = header_match
        
        # Determine speaker
        speaker = speaker.strip() if speaker else current_speaker
        if speaker:
            current_speaker = speaker
            
        # Get corresponding turn text from turns_raw
        # Index in turns_raw: i*2 + 2 (since index 0 is text_before, index 1 is first speaker text or similar)
        # Let's align cleanly:
        try:
            turn_text = turns_raw[i * 2 + 2].strip()
        except IndexError:
            turn_text = ""
            
        if turn_text:
            turns.append({
                "header": f"{current_speaker} ({timestamp}):",
                "text": turn_text
            })
            
    # Group turns into chunks
    chunks = []
    current_turns = []
    current_char_count = 0
    
    for turn in turns:
        turn_str = f"{turn['header']}\n{turn['text']}"
        current_turns.append(turn_str)
        current_char_count += len(turn_str)
        
        if current_char_count >= 1200:
            chunks.append("\n\n".join(current_turns))
            # Sliding window overlap: keep the last turn
            current_turns = [current_turns[-1]] if len(current_turns) > 1 else []
            current_char_count = sum(len(t) for t in current_turns)
            
    if current_turns:
        chunks.append("\n\n".join(current_turns))
        
    return chunks

def ingest_directory(db_session: Session, limit: int = None):
    """
    Crawls data/transcripts/episodes, chunks each transcript, embeds them,
    and inserts them into the DB.
    """
    episodes_dir = "data/transcripts/episodes"
    if not os.path.exists(episodes_dir):
        raise FileNotFoundError(f"Directory not found: {episodes_dir}. Please run git clone first.")
        
    episodes = os.listdir(episodes_dir)
    print(f"Found {len(episodes)} episode directories in {episodes_dir}.")
    
    if limit:
        episodes = episodes[:limit]
        print(f"Limiting ingestion to the first {limit} episodes for testing.")
        
    total_chunks_added = 0
    
    for idx, ep_folder in enumerate(episodes):
        ep_path = os.path.join(episodes_dir, ep_folder, "transcript.md")
        if not os.path.exists(ep_path):
            continue
            
        print(f"[{idx+1}/{len(episodes)}] Processing {ep_folder}...")
        
        try:
            metadata, body_text = parse_transcript_file(ep_path)
            chunks = chunk_transcript(metadata, body_text)
            print(f"   Created {len(chunks)} chunks.")
            
            for chunk_idx, chunk_content in enumerate(chunks):
                # Generate embedding
                embedding = get_embedding(chunk_content)
                
                # Create model
                chunk_model = TranscriptChunk(
                    episode_title=metadata["title"],
                    guest=metadata["guest"],
                    publish_date=metadata["publish_date"],
                    content=chunk_content,
                    embedding=embedding
                )
                
                db_session.add(chunk_model)
                total_chunks_added += 1
                
            db_session.commit()
            print(f"   Successfully ingested {metadata['guest']}'s episode.")
            
        except Exception as e:
            db_session.rollback()
            print(f"   Error processing {ep_folder}: {e}")
            
    print(f"\nIngestion finished! Added {total_chunks_added} chunks to the database.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest Lenny's Podcast transcripts into the DB.")
    parser.add_argument("--limit", type=int, default=10, help="Limit number of episodes to process (default: 10)")
    parser.add_argument("--all", action="store_true", help="Process all episodes (overrides --limit)")
    args = parser.parse_args()
    
    # Initialize DB tables
    print("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Clear existing chunks before ingesting
        print("Clearing existing transcript chunks...")
        db.query(TranscriptChunk).delete()
        db.commit()
        
        limit_val = None if args.all else args.limit
        ingest_directory(db, limit=limit_val)
    finally:
        db.close()
