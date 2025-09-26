import db from '../database/db.js';

// Save a record
export function saveRecord(record) {
  db.transaction(tx => {
    tx.executeSql(
      `INSERT INTO CallRecord (id, user_id, audio_file_path, duration, transcript, created_at, embeddings)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.user_id,
        record.audio_file_path,
        record.duration,
        record.transcript,
        record.created_at,
        JSON.stringify(record.embeddings)
      ],
      (_, result) => console.log("Record saved", result),
      (_, error) => console.log("Error saving record", error)
    );
  });
}

// Get all records (unordered)
export function getRecords(callback) {
  db.transaction(tx => {
    tx.executeSql(
      `SELECT * FROM CallRecord`,
      [],
      (_, { rows }) => {
        const data = rows._array.map(r => ({
          ...r,
          embeddings: r.embeddings ? JSON.parse(r.embeddings) : null
        }));
        callback(data);
      },
      (_, error) => console.log("Error fetching records", error)
    );
  });
}

// Get records ordered by time created
export function getRecordsSorted(callback) {
  db.transaction(tx => {
    tx.executeSql(
      `SELECT * FROM CallRecord ORDER BY datetime(created_at) DESC`,
      [],
      (_, { rows }) => {
        const data = rows._array.map(r => ({
          ...r,
          embeddings: r.embeddings ? JSON.parse(r.embeddings) : null
        }));
        callback(data);
      },
      (_, error) => console.log("Error fetching ordered records", error)
    );
  });
}
