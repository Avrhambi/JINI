import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('JINI.db');

export function initDatabase() {
  db.transaction(tx => {
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS CallRecord (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        audio_file_path TEXT NOT NULL,
        duration REAL NOT NULL,
        transcript TEXT,
        created_at TEXT NOT NULL,
        embeddings TEXT
      );`
    );
  });
}

export default db;