import pytest
from fastapi.testclient import TestClient
from server import app
from middleware.auth import verify_token
import time

client = TestClient(app)

# --- AUTHENTICATION TESTS ---

def test_signup_and_login_success(mock_mongodb):
    """Success: Verify full auth flow using mock database."""
    signup_data = {"email": "test@jini.com", "password": "123", "first_name": "Avraham", "last_name": "CS"}
    resp = client.post("/auth/signup", json=signup_data)
    assert resp.status_code == 200 
    assert "access_token" in resp.json()
    assert "refresh_token" in resp.json()


    login_data = {"email": "test@jini.com", "password": "123"}
    resp_login = client.post("/auth/login", json=login_data)
    assert resp_login.status_code == 200
    assert "access_token" in resp_login.json()
    assert "refresh_token" in resp_login.json()

def test_refresh_token_logic(mock_mongodb, create_test_user):
    """
    Success: Verify that access token changes after refresh.
    Uses 'create_test_user' fixture to ensure the user exists in DB first.
    """
    # 1. Login with the user created by the fixture to get initial tokens
    login_data = {"email": create_test_user.email, "password": "123"}
    login_resp = client.post("/auth/login", json=login_data)
    auth_data = login_resp.json()
    
    old_access_token = auth_data["access_token"]
    refresh_token = auth_data["refresh_token"]

    # to ensure the new token will have a different timestamp
    time.sleep(1.1)

    # 2. Request new access token using refresh token
    resp = client.put("/auth/refresh", data={"refresh_token": refresh_token})
    
    assert resp.status_code == 200
    new_access_token = resp.json()["access_token"]
    
    # Verify token actually changed and is valid
    assert new_access_token != old_access_token
    assert resp.json()["token_type"] == "bearer"

def test_invalid_token_access(mock_mongodb):
    """Failure: Request fails when an invalid token is provided."""
    headers = {"Authorization": "Bearer this_is_not_a_valid_token"}
    # This call triggers the real verify_token middleware
    response = client.get("/calls/favorites", headers=headers)
    
    # Should fail with 401 Unauthorized
    assert response.status_code == 401
    assert "detail" in response.json()


# --- CALL MANAGEMENT TESTS ---

def test_call_lifecycle_with_real_user(mock_mongodb, create_test_user):
    """
    Success: Lifecycle using a user created via fixture.
    This test verifies that the system correctly identifies the user from the JWT.
    """
    # 1. Login to get a valid token for the fixture-created user
    login_data = {"email": create_test_user.email, "password": "123"}
    login_resp = client.post("/auth/login", json=login_data)
    token = login_resp.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    file_name = "test_call_01.wav" 
    
    # 2. Upload call record
    with open(f"tests/recordings/{file_name}", "rb") as f:
        data = {
            "original_name": file_name, 
            "display_name": "Call 1", 
            "number": "050", 
            "type": "in", 
            "caller_name": "Me", 
            "date": "2026"
        }
        upload_resp = client.post("/calls/upload", data=data, files={"audio_file": (file_name, f, "audio/wav")}, headers=headers)
        assert upload_resp.status_code == 200

    # 3. Add to favorites
    fav_resp = client.put("/calls/favorites/add", data={"original_name": file_name}, headers=headers)
    assert fav_resp.status_code == 200

    # 4. Verify file is in the favorite list
    list_resp = client.get("/calls/favorites", headers=headers)
    assert file_name in list_resp.json()

    # 5. Delete call record
    del_resp = client.request("DELETE", "/calls/delete", data={"original_name": file_name}, headers=headers)
    assert del_resp.status_code == 200