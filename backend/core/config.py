from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "My FastAPI App"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]
    # Other settings like database URLs, API keys, etc.

settings = Settings()