# JINI search engine environment: pinned Python + pinned packages + baked-in models + sample recording.
# Secrets (API keys) are NOT baked in; pass them at run time with --env-file.
FROM python:3.11.9-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/opt/hf-cache

WORKDIR /app

# dependencies first, so code changes don't invalidate this (slow) layer
# torch is pinned as +cpu, which only exists on PyTorch's index
COPY requirements.lock .
RUN pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.lock

# bake the models into the image's Hugging Face cache (HF_HOME)
RUN python -c "from faster_whisper import download_model; download_model('ivrit-ai/whisper-large-v3-turbo-ct2')" \
 && python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/multilingual-e5-small')"

# models are in the image now: forbid runtime downloads so a missing model fails loudly
ENV HF_HUB_OFFLINE=1

COPY server.py search_engine.py storage.py transcribe_sample.py env.example ./
COPY tests/recordings/user_a_private.wav tests/recordings/
COPY --chmod=755 entrypoint.sh .

ENTRYPOINT ["/app/entrypoint.sh"]
