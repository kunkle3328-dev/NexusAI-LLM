
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
import json
from core.models import GGUFChat
from core.voice import WhisperStreamer, PiperStreamer

# Setup production logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("Nexus-Core")

app = FastAPI(title="Nexus AI Core Service", version="1.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Lazy initialize STT and TTS engines to save memory on start
stt = WhisperStreamer(model_name="base")
tts = PiperStreamer(model_path="voice.onnx")

active_chat_tasks = {}

@app.get("/health")
def health():
    return {
        "status": "stable", 
        "engine": "llama-cpp-embedded",
        "model": GGUFChat.get_current_model()
    }

@app.websocket("/chat/stream")
async def chat_stream(ws: WebSocket):
    await ws.accept()
    session_id = "active"
    try:
        # Prompt is expected as the first text message
        prompt = await ws.receive_text()
        logger.info(f"Inference Request: {prompt[:50]}...")
        
        # Priority Queue for token delivery
        task = asyncio.create_task(GGUFChat.stream_to_ws(ws, prompt))
        active_chat_tasks[session_id] = task
        await task
        
        await ws.send_text("[DONE]")
    except WebSocketDisconnect:
        logger.info("Chat WS Disconnected")
    except asyncio.CancelledError:
        logger.warning("Inference Task Cancelled")
    except Exception as e:
        logger.error(f"Pipeline Failure: {e}")
        await ws.send_text(f"[ERROR]: Internal Neural Error - {str(e)}")
    finally:
        active_chat_tasks.pop(session_id, None)

@app.websocket("/ws/control")
async def control_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            msg = await ws.receive_json()
            signal = msg.get("signal")
            m_type = msg.get("type")
            
            if signal == "INTERRUPT":
                task = active_chat_tasks.get("active")
                if task:
                    task.cancel()
                    logger.info("Kernel signal received: INTERRUPT")
            
            elif m_type == "TELEMETRY":
                # Handle hardware-aware scaling
                state = msg.get("state", {})
                if state.get("ramFree", 8192) < 1000:
                    logger.warning("Low RAM detected. Hot-swapping to Phi-3 Mini.")
                    await GGUFChat.hot_swap("phi3-mini.gguf")
    except WebSocketDisconnect:
        pass

if __name__ == "__main__":
    import uvicorn
    # Local only for security
    uvicorn.run(app, host="127.0.0.1", port=8000)
