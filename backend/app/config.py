from pathlib import Path
import json

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


def _parse_allowed_origins(raw: str) -> list[str]:
    """Allow ALLOWED_ORIGINS to be either a JSON array or comma-separated string."""
    value = raw.strip()
    if not value:
        return ["http://localhost:5173"]
    if value.startswith("["):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError as exc:
            raise ValueError(
                "ALLOWED_ORIGINS must be valid JSON (for example "
                '["https://app.example.com"]) or comma-separated origins '
                "(for example https://a.com,https://b.com)."
            ) from exc
        if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
            raise ValueError("ALLOWED_ORIGINS JSON must be an array of strings")
        return parsed
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/burnathon"
    clerk_secret_key: str = ""
    # Backend API JWKS (needs CLERK_SECRET_KEY). Alternative: Frontend API + "/.well-known/jwks.json" (no secret).
    clerk_jwks_url: str = "https://api.clerk.com/v1/jwks"
    upload_dir: str = str(Path(__file__).resolve().parent.parent / "uploads")
    whisper_model: str = "base"
    whisper_device: str = "cpu"
    openrouter_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("OPENROUTER_API_KEY", "OPENAI_API_KEY"),
    )
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "deepseek/deepseek-v3.2"
    storage_backend: str = "local"
    gcs_bucket: str = ""
    tavily_api_key: str = Field(default="", validation_alias="TAVILY_API_KEY")
    embeddings_model_name: str = Field(
        default="BAAI/bge-small-en-v1.5",
        validation_alias="EMBEDDINGS_MODEL_NAME",
    )
    embeddings_dim: int = 384
    allowed_origins_raw: str = Field(
        default="http://localhost:5173",
        validation_alias="ALLOWED_ORIGINS",
        exclude=True,
    )

    @property
    def allowed_origins(self) -> list[str]:
        return _parse_allowed_origins(self.allowed_origins_raw)

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
