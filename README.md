
# Hebrew Audio Search Engine

A Python-based system for transcribing Hebrew audio, generating semantic embeddings, and enabling advanced search (vector and exact) with strict user isolation.


## 🎯 Features

- Upload and transcribe Hebrew audio using Faster-Whisper
- Search transcripts with:
  - **Semantic search** (vector-based, multilingual-e5)
  - **Exact keyword matching** (regex)
- Retrieve sentences with scores, timing, and reasoning
- User data isolation (multi-tenant)
- Deterministic LLM-based re-ranking (Using Google Gemini)


## 🏗️ Architecture & Main Files

- **server.py**: Flask REST API for upload, search, and transcript endpoints. Handles audio processing, embedding, and DB storage.
- **search_engine.py**: Core search logic. Refines queries, runs exact/semantic search, and re-ranks results using Gemini LLM.
- **storage.py**: MongoDB + FAISS hybrid storage. Handles user isolation, block storage, and fast vector search.
- **requirements.txt**: Python dependencies.
- **manage.bat**: Windows batch script for venv setup and server management.
- **tests/**: Pytest-based unit tests with full mocking (no real API/DB calls).



## 🗂️ File Structure

```
search_engine/
├── server.py
├── search_engine.py
├── storage.py
├── requirements.txt
├── manage.bat
├── env.example
├── tests/
│   ├── conftest.py
│   └── test_search_engine.py
└── ...
```


## 📋 Requirements

- Python 3.9+
- MongoDB (local or Atlas)
- Google Gemini API keys (see `env.example`)
- (Optional) CUDA GPU for faster Whisper/embedding

Install dependencies:
```
pip install -r requirements.txt
```


## 🚀 Quickstart

1. Copy `env.example` to `.env` and add your Gemini API keys.
2. Start MongoDB locally or update the URI in `storage.py` for Atlas.
3. Set Up PowerShell Profile

First, open PowerShell and edit your profile:

```powershell
notepad $profile
```

If the file doesn't exist, PowerShell will create it. Add the following function to your profile file and save:

```powershell
function JINI {
    param($action)

    if (Test-Path ".\manage.bat") {
        # Run the batch file logic first
        cmd /c manage.bat $action

        # Check: If we need activation AND we aren't already in a venv
        if (($action -eq "init" -or $action -eq "run") -and ($null -eq $env:VIRTUAL_ENV)) {
            if (Test-Path ".\venv\Scripts\Activate.ps1") {
                Write-Host "--- Activating Environment ---" -ForegroundColor Cyan
                . .\venv\Scripts\Activate.ps1
            }
        }
    } else {
        Write-Host "Error: manage.bat not found." -ForegroundColor Red
    }
}
```

After saving, close PowerShell completely and reopen it to load the new profile.
4. (Windows) Use `manage.bat` or PowerShell `jini` function for setup:
   - `jini init` — create venv and install requirements
   - `jini run` — start the Flask server
5. Access the API at `http://localhost:5000`


## 🔌 API Endpoints

- `POST /upload` — Upload and transcribe audio (`user_id`, `file`)
- `GET /search?q=...&user_id=...` — Search transcripts (semantic + exact)


## 📦 Data Storage

- **MongoDB**
  - `windows`: Blocks of sentences with embeddings, user/file linkage
  - `files`: File metadata and full transcript
- **FAISS**: In-memory vector index (384-dim, e5-small)


## 🔍 Search Flow

1. **Query refinement** (LLM): Extracts keywords, roots, and semantic focus
2. **Exact search**: Regex match in MongoDB blocks
3. **Semantic search**: FAISS vector similarity (e5-small, 384-dim)
4. **Re-ranking**: Gemini LLM applies deterministic rules, scores, and dedupes


## 📊 Processing Pipeline

```
Audio Upload → Transcription → Sentence Reconstruction
       ↓
    Block Creation (6 sentences, step=2)
       ↓
    Embedding Generation (e5-small)
       ↓
    Store blocks and embeddings in MongoDB & FAISS
```

All processing is performed locally. No Google Colab or GCS is required.

---

## 🔐 Security & Privacy

- **User Isolation**: All queries include `user_id` filter
- **Upsert Logic**: Prevents accidental data overwrites across users
- **Unique Indexes**: `(user_id, file_name)` prevents duplicates
- **Access Control**: Users can only access their own transcripts and audio files

---

## 📈 Performance Optimization

- **FAISS In-Memory Index**: Vector search in <1ms for 1M+ vectors
- **MongoDB Indexing**: Composite indexes on `(user_id, window_text)`
- **Batch Processing**: Processes multiple files concurrently
- **Embedding Normalization**: IP distance metric for fast similarity
- **Deduplication**: Prevents redundant re-ranking computations

---

## 🛠️ Troubleshooting

### MongoDB Connection Error
```python
# Update connection string in storage.py
mongo_uri = "mongodb://localhost:27017"  # or Atlas URI
```

### FAISS Index Not Loading
- Ensure MongoDB is running and contains documents
- Check user_id matches between requests
- Verify embeddings are 384-dimensional float32



### Slow Search Results
- Monitor FAISS index size: `storage.index.ntotal`
- Increase k in `vector_search()` if too few candidates
- Verify Gemini API quota is not exceeded

---


## 🧪 Testing

- Run all tests:
  ```
  python -m pytest-v  tests/test_search_engine.py
  ```
- All tests use full mocking (no real DB/API calls)
- Key tests: transcript alignment, user isolation

### Integration Test Checklist

Before deploying to production, manually verify:

- [ ] **MongoDB Connection**: `python -c "from storage import Storage; Storage('mongodb://localhost:27017')"`
- [ ] **Audio Upload**: Upload a test MP3 via `/upload`
- [ ] **Search**: Run a Hebrew query via `/search?q=test&user_id=user_1`
- [ ] **User Isolation**: Upload file as user_1, search as user_2 (should see nothing)
- [ ] **Transcript Retrieval**: Fetch full transcript via `/transcript/<user_id>/<filename>`
- [ ] **Audio Serving**: Stream audio file via `/audio/<user_id>/<filename>`
- [ ] **GCS Watcher**: Monitor logs for successful index downloads
- [ ] **Gemini APIs**: Both query and search LLM endpoints working

---

### Debugging Failed Tests

**Common Issues:**

1. **MongoMock version mismatch**
   ```bash
   pip install --upgrade mongomock
   ```

2. **Import path errors**
   ```bash
   # Run from project root
   cd c:\Users\avrha\Desktop\finals\ project\backend\search_engine
   pytest tests/ -v
   ```

3. **Missing test audio files**
   - Ensure `tests/recordings/` folder exists with sample audio files
   - Tests will be skipped if files unavailable

---

### Writing New Tests

**Template for new test:**

```python
def test_new_feature(search_client, mock_ai_and_db):
    """Description of what this test validates."""
    # 1. Setup: Insert test data into mock database
    mock_ai_and_db.windows.insert_one({
        "user_id": "test_user",
        "file_name": "test.mp3",
        "window_text": "test content",
        "embedding": [0.1] * 384,
        "sentences": [{"text": "test", "start": 0, "end": 1}]
    })
    
    # 2. Act: Call API endpoint
    response = search_client.get('/search?q=test&user_id=test_user')
    
    # 3. Assert: Verify response
    assert response.status_code == 200
    assert len(response.json["results"]) > 0
```

**Run your new test:**
```bash
pytest tests/test_search_engine.py::test_new_feature -v
```

---


## 📝 Configuration

- `env.example`: Set Gemini API keys
- `MIN_WORDS`, `MIN_DURATION`, `MAX_WORDS` in `server.py`: sentence splitting
- `self.threshold` in `search_engine.py`: minimum score for matches


## 📚 Tech Stack

- Flask (REST API)
- Faster-Whisper (transcription)
- Sentence-Transformers (intfloat/multilingual-e5-small)
- FAISS (vector search, 384-dim)
- MongoDB (document storage)
- Google Gemini (query refiment & re-rank)


## 🤝 Contributing

- Add new search logic: edit `search_engine.py` and `storage.py`
- Update LLM rules: change `system_instruction` in `search_engine.py`
- Add tests: `tests/` folder (pytest)


## 📄 License

Internal Project — February 2026

## 👤 Author Notes

- System designed for Hebrew language priority
- User isolation enforced at every layer
- Flexible deployment: Local MongoDB or Atlas, GCS or local storage
- Scalable: FAISS handles millions of vectors efficiently

