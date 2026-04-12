from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/burnathon"
    clerk_secret_key: str = ""
    # Backend API JWKS (needs CLERK_SECRET_KEY). Alternative: Frontend API + "/.well-known/jwks.json" (no secret).
    clerk_jwks_url: str = "https://api.clerk.com/v1/jwks"
    upload_dir: str = str(Path(__file__).resolve().parent.parent / "uploads")
    whisper_model: str = "base"
    whisper_device: str = "cpu"
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "deepseek/deepseek-v3.2"
    storage_backend: str = "local"
    gcs_bucket: str = ""
    allowed_origins: list[str] = ["http://localhost:5173"]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
