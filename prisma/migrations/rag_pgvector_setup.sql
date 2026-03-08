-- RAG Custom Vector Search — pgvector setup
-- Run this AFTER `npx prisma db push` to add the vector column and HNSW index.
-- Neon Postgres has pgvector pre-installed, just needs enabling.

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding vector column to rag_chunks
ALTER TABLE rag_chunks
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 3. Create HNSW index for fast cosine similarity search
-- HNSW provides ~99% recall with much faster queries than IVFFlat
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_hnsw_idx
  ON rag_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
