CREATE TABLE IF NOT EXISTS uploaded_files (
  key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data BLOB NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_created ON uploaded_files(created_at);
