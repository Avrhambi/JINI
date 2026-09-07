import pytest
import mongomock
from unittest.mock import MagicMock
import numpy as np
import os
import faiss

@pytest.fixture(autouse=True)
def mock_ai_and_db(monkeypatch):
    """Mocks DB and Gemini, but LEAVES Whisper real for integration testing."""
    
    # Mock MongoDB 
    mock_client = mongomock.MongoClient()
    mock_db = mock_client.HebrewAudioSearch
    monkeypatch.setattr("storage.pymongo.MongoClient", lambda uri: mock_client)
    
    # Mock SentenceTransformer 
    mock_embedder = MagicMock()
    mock_embedder.encode.return_value = np.zeros((10, 384), dtype='float32')
    monkeypatch.setattr("server.SentenceTransformer", lambda name: mock_embedder)


    # Mock Google GenAI 
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = '{"exact_keywords": ["test"], "semantic_focus": "test"}'
    mock_genai_client.models.generate_content.return_value = mock_response
    monkeypatch.setattr("google.genai.Client", lambda api_key: mock_genai_client)

    # reset FAISS Index 
    from server import storage
    storage.index = faiss.IndexFlatIP(384)
    storage.doc_ids, storage.user_ids = [], []

    return mock_db

@pytest.fixture(scope="session", autouse=True)
def cleanup_after_tests():
    """Cleanup temporary files created during the upload process."""
    yield
    current_dir = os.getcwd()
    for f in os.listdir(current_dir):
        if f.startswith("temp_"):
            try: os.remove(os.path.join(current_dir, f))
            except: pass