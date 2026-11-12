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
| `requirements.lock` | Pinned runtime dependencies used by the Docker image |
| `Dockerfile`, `entrypoint.sh`, `transcribe_sample.py` | Container image, start-up script, sample transcription (see [Docker](#docker)) |
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

## Docker

The search engine's environment is packaged as one image that runs the same way on any
machine with Docker. Scope: this service only, because it holds everything heavy and
environment-specific (Whisper model, embedder, sample recording, config). The backend
would follow the same pattern.

```bash
docker build -t jini-search-engine search_engine/
docker run --rm --env-file search_engine/.env jini-search-engine
```

On start the container prints its environment variables (secret values shown as `***`),
then transcribes the sample recording offline. A real run is in
[`docker-run-output.txt`](docker-run-output.txt).

### What is in the image (build time)

| Item | How it gets in |
|---|---|
| Python 3.11.9 | `FROM python:3.11.9-slim`, a pinned tag (3.14 is too new for the ML wheels) |
| Packages | `requirements.lock`: 83 exact versions, frozen inside `python:3.11.9-slim` |
| CPU-only torch | `torch==2.15.0+cpu` from PyTorch's index (`--extra-index-url`); drops ~19 CUDA packages |
| Whisper model `ivrit-ai/whisper-large-v3-turbo-ct2` | downloaded in a `RUN` step into `HF_HOME=/opt/hf-cache` |
| Embedder `intfloat/multilingual-e5-small` | same `RUN` step; needed by `server.py`, not by the sample run |
| Code + `env.example` | `COPY` |
| Sample recording | `COPY tests/recordings/user_a_private.wav` (39 s) |
| Non-secret settings | `ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 HF_HOME=/opt/hf-cache HF_HUB_OFFLINE=1` |
| Entry point | `entrypoint.sh` → `transcribe_sample.py` |

Image size is 4.11 GB: about 2.0 GB of models and 1.9 GB of Python packages.
`HF_HUB_OFFLINE=1` is set after the models are baked in. A missing model then fails
loudly instead of being downloaded silently, and the image runs without network access.

### What is passed at run time, and why

| Variable | Secret | Why at run time |
|---|---|---|
| `FLASH_2_API_KEY`, `FLASH_2.5_API_KEY` | yes | Anything in an image layer can be read by anyone who has the image, so keys must never be baked in |
| `SYSTEM_INSTRUCTIONS`, `REFINE_PROMT` | no | Prompts change more often than code, so they can change without a rebuild |

They are passed with `docker run --env-file .env`
([docs](https://docs.docker.com/reference/cli/docker/container/run/)).
`.dockerignore` excludes `.env`, so it never enters the build context
([docs](https://docs.docker.com/build/concepts/context/)).

### Image vs. container

An image is a read-only, immutable package of everything needed to run the app: files,
libraries, configuration. It is built once and does not change. A container is a running,
isolated process created from an image, with its own writable layer and the run-time
settings (env vars, mounts) supplied at start, so many containers can run from one image
and be discarded without affecting it. Sources: Docker docs,
[What is an image?](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/)
and [What is a container?](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/).

### Gotchas found while building (tested)

- **Dotted env var name.** `FLASH_2.5_API_KEY` is passed by `--env-file` and read by
  Python's `os.getenv`, but Debian's `/bin/sh` (dash) silently drops it from child
  processes. That is why `entrypoint.sh` uses bash and lists variables with `env -0`.
- **`--env-file` is literal.** Quotes are kept as part of the value, and a multi-line
  value is cut at the first newline. Write `KEY=value`, not `KEY="value"` as
  `env.example` does.
- **Line endings.** `core.autocrlf=true` on Windows would check out `entrypoint.sh` with
  CRLF and break the shebang. `.gitattributes` forces LF for `*.sh`.
- **No system ffmpeg needed.** `av` (PyAV) bundles its own FFmpeg libraries. The slim
  image has no `ffmpeg` binary and the transcription still works.
- **Don't import `server.py`** for the sample run. It connects to MongoDB at import time
  (`create_index` in `Storage.__init__`).

### Not sure

- **Other CPU architectures.** Tested only on x86-64 (Windows + Docker Desktop). I would
  check Apple Silicon/ARM with `docker build --platform linux/arm64`, since not every
  pinned wheel may exist for ARM.
- **Memory needed.** Ran fine with 3.8 GiB given to Docker, but I didn't measure the
  peak. I would check with `docker stats` during a run.
- **Running the full server in the container.** Not tested. `server.py` hard-codes
  `mongodb://localhost:27017`, which points at the container itself. I would check by
  making the URI an env var and running MongoDB in a second container on a shared
  network.
- **Base image pinned by tag, not digest.** A tag can be re-pushed. Pinning
  `python:3.11.9-slim@sha256:…` would be stricter, but I am not sure it is worth the
  update friction here.
- **Masking rule.** Values are masked when the name matches `KEY|SECRET|TOKEN|PASSWORD`.
  It also masks the base image's public `GPG_KEY` (harmless), and would miss a secret
  with another name.

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
