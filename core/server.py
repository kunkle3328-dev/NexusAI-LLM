
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
from core.models import GGUFChat
from core.voice import WhisperStreamer, PiperStreamer

app = FastAPI(title="Nexus AI Core Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Initialize heavy dependencies lazily if needed
stt = WhisperStreamer(model_name="base")
tts = PiperStreamer(model_path="runtime/voice.onnx")

active_chat_tasks = {}

@app.get("/health")
def health():
    return {"status": "ok", "engine": "gguf-v3-ollama"}

@app.websocket("/chat/stream")
async def chat_stream(ws: WebSocket):
    await ws.accept()
    session_id = "active"
    try:
        prompt = await ws.receive_text()
        task = asyncio.create_task(GGUFChat.stream_to_ws(ws, prompt))
        active_chat_tasks[session_id] = task
        await task
        await ws.send_text("[DONE]")
    except WebSocketDisconnect:
        pass
    finally:
        active_chat_tasks.pop(session_id, None)

@app.websocket("/voice/stt")
async def voice_stt(ws: WebSocket):
    await ws.accept()
    try:
        async for text in stt.stream(ws):
            await ws.send_text(text)
    except WebSocketDisconnect:
        pass

@app.websocket("/voice/tts")
async def voice_tts(ws: WebSocket):
    await ws.accept()
    try:
        async for audio_chunk in tts.stream(ws):
            await ws.send_bytes(audio_chunk)
    except WebSocketDisconnect:
        pass

@app.websocket("/ws/control")
async def control_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            msg = await ws.receive_json()
            if msg.get("signal") == "INTERRUPT":
                task = active_chat_tasks.get("active")
                if task:
                    task.cancel()
    except WebSocketDisconnect:
        pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=7337)
