from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth, credentials, initialize_app, get_app
from models import User
import os

# --- Initialize Firebase Admin SDK ---
# Use environment variable for service account key (recommended for security)
# Make sure to define FIREBASE_SERVICE_ACCOUNT_KEY in your environment variables
FIREBASE_SERVICE_ACCOUNT_KEY = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")
if not os.path.exists("firebase_service_account.json"):
    with open("firebase_service_account.json", "w") as f:
        f.write(FIREBASE_SERVICE_ACCOUNT_KEY)
try:
    cred = credentials.Certificate("firebase_service_account.json")
    firebase_admin = initialize_app(cred)
except ValueError:
    firebase_admin = get_app()

# HTTPBearer scheme for token extraction
token_bearer = HTTPBearer()

async def get_current_user(token: HTTPAuthorizationCredentials = Depends(token_bearer)) -> User:
    """
    Middleware to verify the Firebase ID token and extract user information.
    """
    try:
        decoded_token = auth.verify_id_token(token.credentials)
        user_data = {
            "uid": decoded_token["uid"],
            "email": decoded_token.get("email"),  # Use .get() to handle cases where email might not be present
            # Extract other relevant data from the decoded token
        }
        return User(**user_data)
    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        print(e)  # Log the error for debugging purposes
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )