# JINI Backend Server

A FastAPI-based backend server for managing voice calls, transcriptions, and intelligent call search. JINI provides user authentication, call management, and AI-powered search capabilities for voice recordings.

## 🚀 Features

- **User Authentication**: Sign up, login, and Google authentication
- **Call Management**: Upload, delete, rename, and organize voice calls
- **Transcription**: Automatic speech-to-text transcription of uploaded calls
- **Smart Search**: AI-powered semantic search across call transcripts
- **Favorites**: Mark and manage favorite calls
- **Call Metadata**: Store and manage call details (date, caller, type, number, etc.)
- **Performance Optimized**: Response compression, async operations, ORJSON for fast serialization
- **CORS Enabled**: Cross-origin resource sharing support for frontend integration

## 📋 Prerequisites

- Python 3.8+
- MongoDB (local or cloud instance)
- Search Service running on port 5000 (for call transcription and search)

## 🛠️ Installation & Setup

#### Step 1: Install Python 3.10

Install Python 3.10 on your computer. You can download it from [python.org](https://www.python.org/downloads/).

#### Step 2: Clone Project and Checkout Backend Branch

```bash
git clone https://github.com/Avrhambi/JINI.git
cd JINI
git checkout backend-updated
```

#### Step 3: Set Up PowerShell Profile

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

#### Step 4: Initialize the Project

Navigate to the JINI project folder and run:

```powershell
cd path/to/JINI
jini init
```

This command will:
- Create a virtual environment (venv folder)
- Activate the virtual environment
- Verify Python 3.10 is installed
- Install all dependencies from `config/requirements.txt`

#### Step 5: Configure Environment Variables

Create a `.env` file in the project root with:

```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=jini
SEARCH_SERVICE_URL=http://localhost:5000
SECRET_KEY=your_jwt_secret_key
ALGORITHM=HS256
```

### Running the Application

Once setup is complete, simply run:

```powershell
jini run
```

This command will:
- Activate the virtual environment
- Start the FastAPI server on `http://localhost:8000`

## 🚀 Running the Server

### Quick Start

Once you've completed the setup, run the application with:

```powershell
jini run
```

The server will start at `http://localhost:8000`

### API Documentation

Once the server is running, access the interactive API documentation:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### Manual Start (Alternative)

If you prefer to run the server without the `jini` command, you can use:

```bash
# Using Uvicorn directly
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

## 📁 Project Structure

```
JINI/
├── config/              # Configuration files
│   ├── db.py           # MongoDB connection and setup
│   └── requirements.txt # Python dependencies
├── controllers/         # Business logic handlers
│   ├── auth.py         # Authentication logic
│   ├── user.py         # User management logic
│   └── call.py         # Call management logic
├── models/             # Data models and schemas
│   ├── auth.py         # Auth-related models
│   ├── user.py         # User-related models
│   └── call.py         # Call-related models
├── routes/             # API endpoint definitions
│   ├── auth.py         # Authentication endpoints
│   ├── user.py         # User endpoints
│   └── call.py         # Call endpoints
├── services/           # External service integrations
│   ├── call.py         # Call service integration
│   └── user.py         # User service operations
├── middleware/         # Middleware handlers
│   └── auth.py         # JWT authentication middleware
├── utils/              # Utility functions
│   ├── auth_utils.py   # Authentication utilities
│   └── __init__.py
├── tests/              # Test files
│   └── test_server.py  # Server tests
├── server.py           # Main FastAPI application
├── manage.bat          # Batch script for Windows
└── README.md           # This file
```

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

### Authentication Endpoints

- **POST** `/auth/signup` - Create a new user account
- **POST** `/auth/login` - Login with email and password
- **POST** `/auth/login/google` - Login using Google OAuth
- **PUT** `/auth/refresh` - Refresh JWT token

## 📞 Call Management Endpoints

### Upload a Call

```
POST /calls/upload
Requires: audio_file, metadata (original_name, display_name, number, type, caller_name, date)
```

### Search Calls

```
POST /calls/search
Body: { "query": "search term" }
```

### Delete a Call

```
DELETE /calls/delete
Body: { "call_id": "..." }
```

### Rename a Call

```
PUT /calls/rename
Body: { "call_id": "...", "new_name": "..." }
```

### Manage Favorites

```
POST /calls/favorites/add       # Add call to favorites
DELETE /calls/favorites/remove  # Remove from favorites
GET /calls/favorites            # Get all favorite calls
```

## 👤 User Endpoints

- **GET** `/users/profile` - Get current user profile
- **PUT** `/users/profile` - Update user profile
- **DELETE** `/users/account` - Delete user account

## 🔧 Core Technologies

| Technology | Purpose |
|---|---|
| **FastAPI** | Modern web framework for building APIs |
| **Uvicorn** | ASGI server for running FastAPI |
| **MongoDB** | NoSQL database for storing user and call data |
| **PyJWT** | JWT token generation and verification |
| **Passlib + Bcrypt** | Secure password hashing |
| **Google Auth** | Google OAuth 2.0 integration |
| **HTTPX** | Async HTTP client for external service calls |
| **Pydantic** | Data validation and settings management |

## 📊 Database Schema

### Users Collection
```json
{
  "_id": ObjectId,
  "email": "user@example.com",
  "password_hash": "bcrypt_hash",
  "name": "User Name",
  "created_at": timestamp,
  "updated_at": timestamp
}
```

### Calls Collection
```json
{
  "_id": ObjectId,
  "user_id": "user_id",
  "original_name": "file.wav",
  "visible_name": "Call with John",
  "number": "+1234567890",
  "type": "incoming/outgoing",
  "caller": "John Doe",
  "date": "2026-02-15",
  "file_path": "/audio/file.wav",
  "transcript": "transcribed text...",
  "created_at": timestamp
}
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017` |
| `DATABASE_NAME` | Database name | `jini` |
| `SEARCH_SERVICE_URL` | Search service base URL | `http://localhost:5000` |
| `SECRET_KEY` | JWT secret key | - |
| `ALGORITHM` | JWT algorithm | `HS256` |

## 🧪 Testing

### Running Tests

Run all tests in the tests folder:

```bash
pytest tests/
```

Run tests with verbose output:

```bash
pytest tests/ -v
```

Run a specific test file:

```bash
pytest tests/test_jini_backend.py -v
```

### Test Suite Overview

The test suite located in the `tests/` folder includes comprehensive tests for the JINI backend using pytest and mongomock for database mocking.

#### Test Files

- **`tests/test_jini_backend.py`** - Main test suite with authentication and call management tests
- **`tests/conftest.py`** - Pytest fixtures and MongoDB mocking configuration
- **`tests/recordings/`** - Sample audio files for testing call uploads

#### Test Coverage

##### Authentication Tests

1. **`test_signup_and_login_success`** - Verifies complete authentication flow
   - Tests user signup with email, password, and name
   - Tests login with correct credentials
   - Validates both access and refresh token generation

2. **`test_refresh_token_logic`** - Validates token refresh mechanism
   - Ensures new access token is generated when refreshing
   - Verifies new token differs from the old one
   - Checks token_type is correctly set to "bearer"
   - Tests token refresh works with valid refresh token

3. **`test_invalid_token_access`** - Validates authentication security
   - Ensures requests fail with invalid tokens
   - Returns 401 Unauthorized status
   - Tests middleware properly rejects malformed tokens

##### Call Management Tests

4. **`test_call_lifecycle_with_real_user`** - Tests complete call record workflow with authenticated user
   - **Login**: Obtains valid JWT token for test user
   - **Upload**: Creates a new call record with audio file and metadata
   - **Favorite**: Adds call to user's favorite list
   - **List**: Retrieves and verifies all favorite calls
   - **Delete**: Removes call from database
   - Validates status codes and response data at each step

### Test Configuration

#### Fixtures (`tests/conftest.py`)

**`cleanup_fastapi_overrides`** - Automatic cleanup fixture
- Automatically runs after each test (autouse=True)
- Clears FastAPI dependency overrides to prevent test pollution
- Ensures no state leaks between tests

**`mock_mongodb`** - Automatic MongoDB mocking fixture
- Automatically used in all tests (autouse=True)
- Replaces real MongoDB with mongomock (in-memory mock)
- Mocks both `users_collection` and `calls_collection`
- Provides a clean database for each test run

**`create_test_user`** - Test user creation fixture
- Creates a real user in the mock database using actual user service
- Returns user object with email, password, and full name
- Allows testing real JWT generation and validation
- Useful for testing authenticated endpoints

#### Example Fixture Usage

```python
def test_some_feature(mock_mongodb, create_test_user):
    """Test with both database mocking and a real test user."""
    # create_test_user automatically exists in mock_mongodb
    # You can now use their credentials to test authentication
    pass
```

### Example Test Data

#### Sample Call Upload
```json
{
  "original_name": "test_call_01.wav",
  "display_name": "Call 1",
  "number": "050",
  "type": "in",
  "caller_name": "Me",
  "date": "2026"
}
```

#### Test User
```json
{
  "email": "test@jini.com",
  "password": "123",
  "first_name": "Avraham",
  "last_name": "CS"
}
```

### Testing Best Practices

1. **Use Fixtures**: Leverage `mock_mongodb` and `create_test_user` fixtures
2. **Test Client**: Use `TestClient` from FastAPI for making requests:
   ```python
   from fastapi.testclient import TestClient
   client = TestClient(app)
   ```
3. **Cleanup**: Overrides are automatically cleaned up by the `cleanup_fastapi_overrides` fixture
4. **Real Tokens**: Use `create_test_user` fixture to test with real JWT tokens instead of mocking

### Continuous Integration

Tests should be executed before deploying to production. Use:

```bash
pytest tests/ -v
```

### Dependencies for Testing

- `pytest` - Testing framework
- `mongomock` - In-memory MongoDB mock for testing
- `fastapi.testclient` - TestClient for API testing

## 📈 Performance Features

- **GZip Compression**: Responses over 1000 bytes are compressed
- **ORJSON**: Fast JSON serialization for responses
- **Async Operations**: Non-blocking I/O for better concurrency
- **Connection Pooling**: MongoDB connection pool for database efficiency

## 🐛 Troubleshooting

### MongoDB Connection Error
```
❌ Could not connect to MongoDB
```
**Solution**: Ensure MongoDB is running and the connection string in `.env` is correct.

### Search Service Error
Ensure the search service is running on `http://localhost:5000`

### JWT Token Expired
Get a new token using the `/auth/refresh` endpoint with your refresh token.

## 📝 Logging

Check the console output for server logs. Key events logged:
- Database connection status
- Request handling and errors
- Service integration issues

## 🤝 Integration with Search Service

The backend integrates with an external search service for:
1. Call transcription (speech-to-text)
2. Semantic search across transcripts

Ensure the search service is running before uploading calls.

## 📦 Dependencies

See [requirements.txt](config/requirements.txt) for complete list of dependencies with versions.

### Key Dependencies:
- `fastapi==0.111.1` - Web framework
- `pymongo==4.4.1` - MongoDB driver
- `PyJWT==2.8.0` - JWT tokens
- `httpx` - Async HTTP client
- `pydantic[email]==2.11.1` - Data validation

## 🔄 Middleware

### CORS Middleware
Configured to allow requests from any origin. Modify in `server.py` for production:

```python
allow_origins=["https://yourdomain.com"]  # Specify domains
```

### GZip Compression
Automatically compresses responses larger than 1000 bytes.

### Authentication Middleware
Verifies JWT tokens for protected routes.

## 📋 API Response Format

All responses are in JSON format with standard structure:

**Success Response (200):**
```json
{
  "status": "success",
  "data": { ... }
}
```

**Error Response (4xx/5xx):**
```json
{
  "status": "error",
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

## 🚀 Deployment

For production deployment:

1. Set secure environment variables
2. Use a production ASGI server (Gunicorn, etc.)
3. Configure MongoDB with authentication
4. Enable HTTPS/SSL
5. Set specific CORS origins
6. Implement rate limiting
7. Monitor logs and errors

## 📞 Support

For issues or questions, check the test files in the `tests/` directory for example usage.

## 📄 License

Proprietary - JINI Project

---

**Last Updated**: February 2026
