
import json
import time

def stream_tokens(prompt):
    """Nexus Enclave simulated token emitter."""
    tokens = prompt.split()
    for token in tokens:
        time.sleep(0.02)
        yield json.dumps({
            "token": token + " ",
            "is_code": "```" in token,
            "ts": time.time()
        })
