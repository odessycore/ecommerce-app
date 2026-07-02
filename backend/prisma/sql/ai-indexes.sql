-- pgvector ANN index for semantic search / recommendations.
-- Prisma can't express vector index ops, so apply this manually AFTER embeddings are
-- populated (run `POST /api/admin/catalog/reindex` once an embedding model is configured).
--
--   psql "$DATABASE_URL" -f prisma/sql/ai-indexes.sql

CREATE INDEX IF NOT EXISTS products_embedding_hnsw
  ON products USING hnsw (embedding vector_cosine_ops);
