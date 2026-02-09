
import sqlite3
import os
import logging
import time
import math
from typing import List, Dict

logger = logging.getLogger("NCS-Memory")
DB_PATH = "runtime/memory/nexus_enclave.db"

DECAY_POLICIES = {
    "fact": 180 * 24 * 3600,
    "preference": 90 * 24 * 3600,
    "project": 60 * 24 * 3600,
    "skill": 365 * 24 * 3600
}

class MemoryManager:
    def __init__(self):
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
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
                base_confidence REAL DEFAULT 1.0,
                tags TEXT
            )
        """)
        conn.commit()
        conn.close()

    def calculate_confidence(self, row: tuple) -> float:
        m_id, m_type, content, ts, last_acc, imp, usage, base_conf, tags = row
        elapsed = time.time() - ts
        half_life = DECAY_POLICIES.get(m_type, 180 * 24 * 3600)
        recency_factor = math.pow(0.5, elapsed / half_life)
        usage_factor = 1.0 + (math.log(usage + 1) * 0.15)
        return min(1.0, base_conf * recency_factor * usage_factor)

    def prune_low_confidence(self):
        """Auto-prune old or low-confidence vectors to keep database lean."""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM memory_nodes")
        rows = cursor.fetchall()
        
        pruned_count = 0
        for row in rows:
            conf = self.calculate_confidence(row)
            if conf < 0.1:
                cursor.execute("DELETE FROM memory_nodes WHERE id = ?", (row[0],))
                pruned_count += 1
        
        conn.commit()
        conn.close()
        if pruned_count > 0:
            logger.info(f"Pruned {pruned_count} low-confidence memory nodes.")

    def store_memory(self, content: str, m_type: str = "fact", tags: str = ""):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = int(time.time())
        m_id = os.urandom(8).hex()
        cursor.execute(
            "INSERT INTO memory_nodes (id, type, content, timestamp, last_accessed, tags) VALUES (?, ?, ?, ?, ?, ?)", 
            (m_id, m_type, content, now, now, tags)
        )
        conn.commit()
        conn.close()
        return m_id

    def search_memory(self, query: str, k: int = 5) -> str:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM memory_nodes")
        rows = cursor.fetchall()
        
        terms = query.lower().split()
        scored = []
        for row in rows:
            content = row[2]
            conf = self.calculate_confidence(row)
            relevance = sum(1 for t in terms if t in content.lower())
            score = (relevance * 2) + conf + row[5]
            if relevance > 0:
                scored.append({"content": content, "score": score})
        
        conn.close()
        top_k = sorted(scored, key=lambda x: x["score"], reverse=True)[:k]
        return "\n".join([f"- {m['content']}" for m in top_k])

memory_system = MemoryManager()
