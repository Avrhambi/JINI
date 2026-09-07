import pytest
import mongomock
from unittest.mock import MagicMock
from bson import ObjectId
import config.db as db # [cite: 8]


@pytest.fixture(autouse=True)
def cleanup_fastapi_overrides():
    """Ensures no overrides leak between tests."""
    yield
    from server import app
    app.dependency_overrides.clear()

@pytest.fixture(autouse=True)
def mock_mongodb(monkeypatch):
    """
    Replaces real MongoDB with mongomock.
    Ensures that every test starts with a clean, in-memory database.
    """
    mock_client = mongomock.MongoClient()
    mock_db = mock_client.jini_backend_db
    # Redirecting the collections used  
    monkeypatch.setattr(db, "users_collection", mock_db.users)
    monkeypatch.setattr(db, "calls_collection", mock_db.calls)
    return mock_db

@pytest.fixture
def create_test_user(mock_mongodb):
    """
    A helper fixture to create a real user in the mock DB.
    This allows testing real JWT generation and validation.
    """
    from services.user import create_user_service  
    
    user_data = {
        "email": "test@jini.com",
        "password": "123",
        "first_name": "Avraham",
        "last_name": "CS"
    }
    
    user = create_user_service(user_data)
    return user