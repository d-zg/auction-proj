# File: backend/core/config.py
from pydantic import BaseModel
import os

class Settings(BaseModel):
    PROJECT_NAME: str = "My FastAPI App"
    ALLOWED_ORIGINS: list[str] = []

    def __init__(self, **data):
        super().__init__(**data)
        origins_str = os.getenv("ALLOWED_ORIGINS", "")
        self.ALLOWED_ORIGINS = [origin.strip() for origin in origins_str.split(",") if origin.strip()]

settings = Settings()