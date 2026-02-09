
-- NEXUS COGNITIVE ENCLAVE v3.1
-- Optimized for Cosine Similarity Retrieval on Mobile

CREATE TABLE IF NOT EXISTS cognitive_memory (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  embedding BLOB NOT NULL, -- Compressed f32 vector
  importance INTEGER DEFAULT 1,
  timestamp INTEGER DEFAULT (strftime('%s', 'now')),
  tags TEXT -- JSON array of metadata tags
);

CREATE INDEX IF NOT EXISTS idx_importance ON cognitive_memory(importance DESC);
CREATE INDEX IF NOT EXISTS idx_timestamp ON cognitive_memory(timestamp DESC);
