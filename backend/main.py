from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from core.security import get_current_user
from models import User
from api.routes import users, groups, memberships  # Import your routers

app = FastAPI(title=settings.PROJECT_NAME)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(groups.router, prefix="/groups", tags=["groups"])  
app.include_router(memberships.router, prefix="/memberships", tags=["memberships"])
# ... other protected routes

# --- Placeholder Endpoint (Not Protected) ---
@app.get("/")
async def root():
    return {"message": "Hello World"}
