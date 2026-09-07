# JINI — Hebrew Audio Search Engine

Flask service that transcribes Hebrew call audio, builds semantic embeddings, and serves
vector + exact search with strict per-user isolation. Part of the
[JINI final project](../README.md) — B.Sc. Computer Science, Bar-Ilan University.

Called by the [backend API](../backend/README.md); not exposed to the mobile client directly.

## Speech-to-text

Transcription runs locally with **[faster-whisper](https://github.com/SYSTRAN/faster-whisper)**
loading the **ivrit.ai fine-tuned Whisper model**
[`ivrit-ai/whisper-large-v3-turbo-ct2`](https://huggingface.co/ivrit-ai/whisper-large-v3-turbo-ct2) —
a CTranslate2 build of OpenAI's [Whisper](https://github.com/openai/whisper)
large-v3-turbo, fine-tuned on the [ivrit.ai](https://www.ivrit.ai) Hebrew speech corpus.
Default device is CPU with `int8` quantization (see `server.py`).

## Features

- Upload + Hebrew transcription with word-level timestamps
- **Semantic search** — `intfloat/multilingual-e5-small` embeddings over a FAISS index
- **Exact search** — regex keyword match in MongoDB
- Deterministic LLM re-ranking with Google Gemini
- Multi-tenant: every query is filtered by `user_id`
- Runs fully local except the Gemini re-rank calls

## Architecture

| File | Role |
|---|---|
| `server.py` | Flask REST API; audio processing, embedding, storage; model init |
| `search_engine.py` | Query refinement, exact + semantic search, Gemini re-rank |
| `storage.py` | MongoDB + FAISS hybrid store, user isolation, vector index |
| `requirements.txt` | Dependencies |
| `manage.bat` | Windows venv/run helper |
| `tests/` | Pytest suite, fully mocked (no real DB/API calls) |

## Processing pipeline

```
Audio upload → transcription (ivrit.ai Whisper) → sentence reconstruction
→ block creation → embedding (multilingual-e5-small) → store in MongoDB + FAISS
```

## Search flow

1. **Query refinement** — extract keywords, roots, semantic focus (Gemini)
2. **Exact search** — regex over MongoDB blocks
3. **Semantic search** — FAISS vector similarity
4. **Re-rank** — Gemini judge applies deterministic rules, scores, dedupes

## Requirements

- Python 3.9+
- MongoDB (local or Atlas)
- Google Gemini API key(s) — see `env.example`
- Optional CUDA GPU for faster transcription/embedding

## Quickstart (Windows)

```powershell
# copy env.example -> .env and add Gemini API key(s)
# add the `jini` helper to your PowerShell profile (see manage.bat), then:
jini init     # create venv, install requirements
jini run      # start Flask on http://localhost:5000
```

## API

- `POST /upload` — upload + transcribe audio (`user_id`, `file`)
- `GET /search?q=…&user_id=…` — search transcripts (semantic + exact)
- `GET /transcript/<user_id>/<filename>` — full transcript

## Storage

- **MongoDB** — `windows` (sentence blocks + embeddings, linked to user/file),
  `files` (metadata + full transcript)
- **FAISS** — in-memory 384-dim vector index (IP metric, normalized embeddings)

## Configuration

- `env.example` — Gemini API keys
- `MIN_WORDS` / `MIN_DURATION` / `MAX_WORDS` in `server.py` — sentence splitting
- `self.threshold` in `search_engine.py` — minimum match score

## Tests

```bash
python -m pytest -v tests/test_search_engine.py
```

All tests use full mocking. Key coverage: transcript alignment, user isolation.

## Tech stack

Flask · faster-whisper (`ivrit-ai/whisper-large-v3-turbo-ct2`) ·
sentence-transformers (`intfloat/multilingual-e5-small`) · FAISS · MongoDB · Google Gemini

## References

- ivrit.ai — <https://www.ivrit.ai>
- ivrit.ai fine-tuned Whisper — <https://huggingface.co/ivrit-ai/whisper-large-v3-turbo-ct2>
- Whisper (OpenAI) — <https://github.com/openai/whisper>
- faster-whisper — <https://github.com/SYSTRAN/faster-whisper>

## License

Academic project.
