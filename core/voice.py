
from fastapi import WebSocket
import asyncio
import subprocess
import os
import logging

logger = logging.getLogger("NCS-Voice")

# Optional: Load whisper if available locally
try:
    import whisper
    STT_MODEL = whisper.load_model("base")
except ImportError:
    STT_MODEL = None

class WhisperStreamer:
    def __init__(self, model_name="base"):
        self.model = STT_MODEL

    async def stream(self, ws: WebSocket):
        while True:
            try:
                # Receive raw PCM bytes from mobile microphone
                audio_bytes = await ws.receive_bytes()
                
                if not self.model:
                    yield "[Whisper not loaded on host]"
                    continue

                # Temp file for Whisper (mobile optimization would use buffers)
                with open("runtime/stt_chunk.wav", "wb") as f:
                    f.write(audio_bytes)
                
                result = self.model.transcribe("runtime/stt_chunk.wav")
                yield result.get("text", "")
            except Exception as e:
                logger.error(f"STT Pipeline Error: {e}")
                break

class PiperStreamer:
    def __init__(self, model_path="voice.onnx"):
        self.model_path = model_path

    async def stream(self, ws: WebSocket):
        while True:
            try:
                # Receive text chunk from LLM token stream
                text = await ws.receive_text()
                
                # Pipe to Piper binary
                # piper --model <model> --output_raw
                proc = subprocess.Popen(
                    ["piper", "--model", self.model_path, "--output_raw"],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                
                audio_out, _ = proc.communicate(input=text.encode())
                if audio_out:
                    yield audio_out
            except Exception as e:
                logger.error(f"TTS Pipeline Error: {e}")
                break
