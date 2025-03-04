from fastapi import FastAPI, Depends, Request
import time
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from core.security import get_current_user
from models import User
from api.routes import users, groups, memberships, elections, enhanced_groups, enhanced_group_details, enhanced_election_details  # Import your routers
import logging

app = FastAPI(title=settings.PROJECT_NAME)
logger = logging.getLogger("uvicorn")  # or configure your own logger

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
enhanced_groups.include_enhanced_groups_routes(app) # ADD this line - call the function to include routes
enhanced_group_details.include_enhanced_group_details_routes(app)
enhanced_election_details.include_enhanced_election_routes(app)
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(groups.router, prefix="/groups", tags=["groups"])  
app.include_router(memberships.router, prefix="/memberships", tags=["memberships"])
app.include_router(elections.router, prefix="/groups/{group_id}/elections", tags=["elections"])
# ... other protected routes

# --- Placeholder Endpoint (Not Protected) ---

@app.middleware("http")
async def log_request_latency(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"{request.method} {request.url} completed in {duration:.2f} seconds")
    return response


@app.get("/healthz")
async def health_check():
    """
    Health check endpoint for Render.
    Returns 200 OK if the application is healthy.
    """
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"message": "Hello World"}
