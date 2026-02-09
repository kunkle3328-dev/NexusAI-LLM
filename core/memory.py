
import sqlite3
import os
import logging
import time
import math
from typing import List, Dict

logger = logging.getLogger("NCS-Memory")
DB_PATH = "runtime/memory/memory.db"

# Half-lives in seconds
DECAY_POLICIES = {
    "fact": 180 * 24 * 3600,
    "preference": 90 * 24 * 3600,
    "project": 60 * 24 * 3600,
    "skill": 365 * 24 * 3600
}

class MemoryManager:
    def __init__(self):
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS memory_nodes (
                id TEXT PRIMARY KEY,
                type TEXT,
                content TEXT,
                timestamp INTEGER,
                last_accessed INTEGER,
                importance INTEGER DEFAULT 1,
                usage_count INTEGER DEFAULT 0,
                base_confidence REAL DEFAULT 1.0
            )
        """)
        conn.commit()
        conn.close()

    def calculate_confidence(self, row: tuple) -> float:
        # confidence = base_score × recency_factor × usage_factor
        m_id, m_type, content, ts, last_acc, imp, usage, base_conf = row
        
        # Recency Decay
        elapsed = time.time() - ts
        half_life = DECAY_POLICIES.get(m_type, 180 * 24 * 3600)
        recency_factor = math.pow(0.5, elapsed / half_life)
        
        # Usage Reinforcement
        usage_factor = 1.0 + (math.log(usage + 1) * 0.1)
        
        return min(1.0, base_conf * recency_factor * usage_factor)

    def store_memory(self, content: str, m_type: str = "fact"):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = int(time.time())
        m_id = os.urandom(8).hex()
        cursor.execute(
            "INSERT INTO memory_nodes (id, type, content, timestamp, last_accessed) VALUES (?, ?, ?, ?, ?)", 
            (m_id, m_type, content, now, now)
        )
        conn.commit()
        conn.close()
        return m_id

    def search_memory(self, query: str, k: int = 5) -> List[Dict]:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # simplified search for skeleton
        cursor.execute("SELECT * FROM memory_nodes")
        rows = cursor.fetchall()
        
        scored = []
        for row in rows:
            conf = self.calculate_confidence(row)
            # update last_accessed on recall attempt
            scored.append({"content": row[2], "confidence": conf, "id": row[0]})
            
        conn.close()
        # return top k by confidence
        return sorted(scored, key=lambda x: x["confidence"], reverse=True)[:k]

    def nightly_decay_pass(self):
        """Deprioritize or flag for GC low confidence memories."""
        logger.info("Running neural decay pass...")
        # In real impl, we'd delete nodes with conf < 0.05
        pass

memory_system = MemoryManager()
