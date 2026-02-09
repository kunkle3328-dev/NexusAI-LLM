
from core.server import app
import uvicorn
import os

if __name__ == "__main__":
    # Ensure runtime directories exist
    os.makedirs("runtime/workspace", exist_ok=True)
    os.makedirs("runtime/memory", exist_ok=True)
    
    print("🚀 Nexus AI Core Service (NCS) starting on http://127.0.0.1:7337")
    uvicorn.run(app, host="127.0.0.1", port=7337)
