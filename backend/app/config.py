import json
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings


def _parse_allowed_origins(raw: str) -> list[str]:
    """Env value for ALLOWED_ORIGINS: JSON array or comma-separated URLs (no JSON quoting issues in systemd)."""
    s = raw.strip()
    if not s:
        return ["http://localhost:5173"]
    if s.startswith("["):
        try:
            data = json.loads(s)
        except json.JSONDecodeError as e:
            raise ValueError(
                "ALLOWED_ORIGINS must be valid JSON (e.g. [\"https://a.com\"]) "
                "or comma-separated origins (e.g. https://a.com,https://b.com). "
                f"JSON error: {e}"
            ) from e
        if not isinstance(data, list):
            raise ValueError("ALLOWED_ORIGINS JSON must be an array of strings")
        if not all(isinstance(x, str) for x in data):
            raise ValueError("ALLOWED_ORIGINS JSON array must contain only strings")
        return data
    return [x.strip() for x in s.split(",") if x.strip()]


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
    # ALLOWED_ORIGINS is stored as a plain string and parsed by _parse_allowed_origins()
    # via the `allowed_origins` @property below, so systemd/.env values never hit pydantic's
    # built-in json.loads for list[str] fields. Do NOT rename this field to `allowed_origins`
    # (even as a computed_field) — the env source would then call json.loads on the raw value.
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
