from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")
    
    PROJECT_NAME: str = "My FastAPI App"
    # Load the raw string from the environment (or .env) using an alias.
    allowed_origins: str = Field("", alias="ALLOWED_ORIGINS")
    
    @property
    def ALLOWED_ORIGINS(self) -> list[str]:
        # Convert the comma-separated string into a list.
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

# Usage
settings = Settings()
