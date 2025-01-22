from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth, credentials, initialize_app, get_app
from models import User
import os

# --- Configuration ---
class Settings(BaseModel):
    PROJECT_NAME: str = "My FastAPI App"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]  # Replace with your frontend origin(s)
    FIREBASE_SERVICE_ACCOUNT_KEY: str = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")

settings = Settings()

# --- Initialize Firebase Admin SDK ---
# Use environment variable for service account key (recommended for security)
if not os.path.exists("firebase_service_account.json"):
    with open("firebase_service_account.json", "w") as f:
        f.write(settings.FIREBASE_SERVICE_ACCOUNT_KEY)
try:
    cred = credentials.Certificate("firebase_service_account.json")
    firebase_admin = initialize_app(cred)
except ValueError:
    firebase_admin = get_app()

# --- FastAPI App Instance ---
app = FastAPI(title=settings.PROJECT_NAME)

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Authentication Middleware ---

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

# --- Example Protected Endpoint ---
@app.get("/protected", response_model=str)
async def protected_route(current_user: User = Depends(get_current_user)):
    """
    Example protected endpoint that requires a valid ID token.
    """
    return f"Hello, {current_user.uid}! This is a protected route."

# --- Placeholder Endpoint (Not Protected) ---
@app.get("/")
async def root():
    return {"message": "Hello World"}