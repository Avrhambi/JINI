import pytest

@pytest.fixture
def search_client():
    """Provides a Flask test client with testing configurations."""
    from server import app
    app.config['TESTING'] = True
    return app.test_client()

# --- UPLOAD TESTS ---

def test_upload_success_and_alignment(search_client, mock_ai_and_db):
    """Success: Verify that audio upload is processed through Mocks."""
    file_name = "user_a_private.wav"
    user_id = "user_A"

    expected_transcript = "אכלתם גם? כן. איך היה? כן. מה אגיד ומה אומר? את יודעת שזה נראה לי בגלל שאנחנו לא רואים אור יום? כי גם אני הרגשתי פתאום שניהיה לי פיגמנטציה מתחת לעיניים ובשפם, ואף פעם לא הייתה..."
    expected_transcript = expected_transcript.replace(" ", "").replace(".", "").replace(",", "").replace("?", "").replace("!", "").replace("_", "")

    with open(f"tests/recordings/{file_name}", "rb") as audio:
        data = {'user_id': user_id, 'file': (audio, file_name)}
        response = search_client.post('/upload', data=data, content_type='multipart/form-data')
        response_transcript = response.json["transcript"].replace(" ", "").replace(".", "").replace(",", "").replace("?", "").replace("!", "").replace("_", "")

        assert response.status_code == 200
        assert response_transcript == expected_transcript

def test_upload_missing_data(search_client):
    """Failure: Ensure upload fails when user_id or file is missing."""
    # Test missing file
    response = search_client.post('/upload', data={'user_id': 'user_A'})
    assert response.status_code == 400
    assert "error" in response.json


# --- SEARCH & ISOLATION TESTS ---

def test_search_user_isolation(search_client, mock_ai_and_db):
    """Security: Prove that search results are strictly isolated by user_id."""
    # Manually inject private data for User A
    mock_ai_and_db.windows.insert_one({
        "user_id": "user_A",
        "file_name": "private.wav",
        "window_text": "secret military info",
        "embedding": [0.1] * 384
    })

    # User B searches for the secret content - result must be empty
    response = search_client.get('/search?q=secret&user_id=user_B')
    assert response.status_code == 200
    assert len(response.json["results"]) == 0

def test_search_no_results(search_client, mock_ai_and_db):
    """Success: Ensure the system handles queries with no matches gracefully."""
    # Perform search on an empty database
    response = search_client.get('/search?q=nonexistent&user_id=user_A')
    
    assert response.status_code == 200
    assert response.json["results"] == []

def test_search_missing_parameters(search_client):
    """Failure: Ensure search fails when required query parameters are missing."""
    # Missing query 'q'
    response = search_client.get('/search?user_id=user_A')
    assert response.status_code == 400