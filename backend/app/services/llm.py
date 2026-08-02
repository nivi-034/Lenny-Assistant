import json
import httpx
import asyncio
from typing import List, Dict, AsyncGenerator
from backend.app.config import settings

async def stream_ollama(messages: List[Dict[str, str]], model: str) -> AsyncGenerator[str, None]:
    url = f"{settings.OLLAMA_HOST.rstrip('/')}/api/chat"
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": 0.7
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code != 200:
                    yield f"Error: Ollama returned status code {response.status_code}\n"
                    return
                    
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        token = data.get("message", {}).get("content", "")
                        if token:
                            yield token
                    except Exception as e:
                        pass
    except httpx.ConnectError:
        yield f"Error: Could not connect to Ollama at {settings.OLLAMA_HOST}. Is Ollama running? (Command: 'ollama serve')\n"
    except Exception as e:
        yield f"Error contacting Ollama: {str(e)}\n"

async def stream_openai(messages: List[Dict[str, str]], model: str) -> AsyncGenerator[str, None]:
    from openai import AsyncOpenAI
    
    if not settings.OPENAI_API_KEY:
        yield "Error: OPENAI_API_KEY is not configured in the backend environment variables.\n"
        return
        
    try:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            temperature=0.7
        )
        async for chunk in response:
            token = chunk.choices[0].delta.content if chunk.choices and chunk.choices[0].delta.content else ""
            if token:
                yield token
    except Exception as e:
        yield f"Error contacting OpenAI: {str(e)}\n"

async def stream_anthropic(messages: List[Dict[str, str]], model: str) -> AsyncGenerator[str, None]:
    from anthropic import AsyncAnthropic
    
    if not settings.ANTHROPIC_API_KEY:
        yield "Error: ANTHROPIC_API_KEY is not configured in the backend environment variables.\n"
        return
        
    # Map messages format (Anthropic does not expect a system role in standard chat history, 
    # it accepts it as a top-level parameter. We must filter out any 'system' messages from history 
    # and pass the last system message separately if found.)
    system_prompt = ""
    filtered_messages = []
    
    for msg in messages:
        if msg["role"] == "system":
            system_prompt = msg["content"]
        else:
            filtered_messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
            
    try:
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        
        # Build parameters
        params = {
            "model": model,
            "messages": filtered_messages,
            "max_tokens": 4096,
            "temperature": 0.7
        }
        if system_prompt:
            params["system"] = system_prompt
            
        async with client.messages.stream(**params) as stream:
            async for text in stream.text_stream:
                yield text
    except Exception as e:
        yield f"Error contacting Anthropic: {str(e)}\n"

async def stream_chat(messages: List[Dict[str, str]], provider: str, model: str) -> AsyncGenerator[str, None]:
    """
    Unified entry point to stream chat responses from Ollama, Anthropic or OpenAI.
    """
    provider = provider.lower()
    
    if provider == "ollama":
        async for token in stream_ollama(messages, model):
            yield token
    elif provider == "openai":
        async for token in stream_openai(messages, model):
            yield token
    elif provider == "anthropic":
        async for token in stream_anthropic(messages, model):
            yield token
    else:
        yield f"Error: Unknown model provider '{provider}'. Please use 'ollama', 'openai', or 'anthropic'.\n"
