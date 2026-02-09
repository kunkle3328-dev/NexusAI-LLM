
import httpx
import json
import asyncio
import logging

logger = logging.getLogger("NCS-Models")
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3:8b-instruct-q4_K_M"

class GGUFChat:
    @staticmethod
    async def stream_to_ws(ws, prompt: str):
        payload = {
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": True,
            "options": {
                "temperature": 0.7,
                "num_predict": 4096
            }
        }
        
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", OLLAMA_URL, json=payload) as response:
                    async for line in response.aiter_lines():
                        if not line: continue
                        try:
                            data = json.loads(line)
                            token = data.get("response", "")
                            if token:
                                await ws.send_text(token)
                            if data.get("done"):
                                break
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.error(f"GGUF Stream Error: {e}")
            await ws.send_text(f"NCS: Engine Error - {e}")
