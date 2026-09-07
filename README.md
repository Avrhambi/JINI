# JINI

**JINI** is a voice-call archive with Hebrew speech-to-text transcription and AI-powered
semantic search. Users record or upload phone calls from a mobile app; the calls are
transcribed in Hebrew, indexed, and made searchable by meaning — not just keywords.

> **Final project — B.Sc. in Computer Science, Bar-Ilan University.**
> Submitted as the capstone project for the Computer Science degree at Bar-Ilan University.

---

## Repository layout

This branch consolidates the three services of the system, each in its own folder with
its own README:

| Component | Folder | Stack | README |
|---|---|---|---|
| **Mobile app** | [`frontend/`](frontend/) | React Native (Expo), Google Sign-In | [frontend/README.md](frontend/README.md) |
| **Backend API** | [`backend/`](backend/) | FastAPI, MongoDB, JWT | [backend/README.md](backend/README.md) |
| **Search engine** | [`search_engine/`](search_engine/) | Flask, faster-whisper, FAISS, Gemini | [search_engine/README.md](search_engine/README.md) |

## Architecture

```
┌─────────────┐        ┌──────────────┐        ┌────────────────────┐
│  frontend   │ HTTPS  │   backend    │  HTTP  │   search_engine    │
│ React Native│ ─────► │  FastAPI     │ ─────► │  Flask             │
│  (Expo)     │  JWT   │  MongoDB     │        │  Whisper + FAISS   │
└─────────────┘        └──────────────┘        └────────────────────┘
      records/            auth, call            transcription (Hebrew),
      uploads calls       metadata, files       embeddings, semantic +
                                                exact search, LLM re-rank
```

1. The **frontend** authenticates the user and uploads call audio + metadata to the backend.
2. The **backend** stores users/calls in MongoDB and forwards audio to the search engine.
3. The **search engine** transcribes the audio in Hebrew, splits it into sentence blocks,
   embeds them, and stores them in MongoDB + a FAISS vector index. Search queries run an
   exact (regex) pass and a semantic (vector) pass, then a deterministic Gemini re-rank.

## Speech-to-text

Hebrew transcription is done locally with **[faster-whisper](https://github.com/SYSTRAN/faster-whisper)**
running the **ivrit.ai fine-tuned Whisper model** `ivrit-ai/whisper-large-v3-turbo-ct2`.
This is a CTranslate2 build of OpenAI's Whisper large-v3-turbo, fine-tuned on the
[ivrit.ai](https://www.ivrit.ai) Hebrew speech corpus for substantially better accuracy
on spoken Hebrew than the base model.

## References

- **ivrit.ai** — open Hebrew speech dataset and models: <https://www.ivrit.ai>
  ([GitHub](https://github.com/ivrit-ai), [paper](https://arxiv.org/abs/2307.08720))
- **ivrit.ai fine-tuned Whisper model** — `ivrit-ai/whisper-large-v3-turbo-ct2`:
  <https://huggingface.co/ivrit-ai/whisper-large-v3-turbo-ct2>
- **Whisper** (OpenAI) — robust multilingual speech recognition:
  <https://github.com/openai/whisper> ([paper](https://arxiv.org/abs/2212.04356))
- **faster-whisper** — CTranslate2 reimplementation of Whisper:
  <https://github.com/SYSTRAN/faster-whisper>
- **multilingual-e5-small** — sentence embeddings for semantic search:
  <https://huggingface.co/intfloat/multilingual-e5-small>
- **FAISS** — vector similarity search: <https://github.com/facebookresearch/faiss>

## Running the full system

Start the services in this order (each folder's README has the details):

1. `search_engine/` — Flask service on `http://localhost:5000`
2. `backend/` — FastAPI service on `http://localhost:8000`
3. `frontend/` — Expo dev client / Android build

MongoDB must be running and reachable by both the backend and the search engine.

## License

Academic project. See each component folder for its own license note.
