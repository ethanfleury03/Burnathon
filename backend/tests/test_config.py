"""Regression tests for Settings parsing and env compatibility."""

from __future__ import annotations

import importlib
import os

import pytest


ALLOWED = "ALLOWED_ORIGINS"
OPENROUTER = "OPENROUTER_API_KEY"
OPENAI = "OPENAI_API_KEY"


def _reload_config():
    import app.config as config_module

    return importlib.reload(config_module)


@pytest.fixture
def clean_env(monkeypatch):
    for key in (ALLOWED, OPENROUTER, OPENAI):
        monkeypatch.delenv(key, raising=False)
    yield monkeypatch


def test_default_when_unset(clean_env):
    config = _reload_config()
    assert config.settings.allowed_origins == ["http://localhost:5173"]


def test_single_origin(clean_env):
    clean_env.setenv(ALLOWED, "https://burnathon.app")
    config = _reload_config()
    assert config.settings.allowed_origins == ["https://burnathon.app"]


def test_comma_separated(clean_env):
    clean_env.setenv(ALLOWED, "https://a.com,https://b.com")
    config = _reload_config()
    assert config.settings.allowed_origins == ["https://a.com", "https://b.com"]


def test_json_array(clean_env):
    clean_env.setenv(ALLOWED, '["https://a.com","https://b.com"]')
    config = _reload_config()
    assert config.settings.allowed_origins == ["https://a.com", "https://b.com"]


def test_empty_string_falls_back_to_default(clean_env):
    clean_env.setenv(ALLOWED, "")
    config = _reload_config()
    assert config.settings.allowed_origins == ["http://localhost:5173"]


def test_invalid_json_array_raises(clean_env):
    clean_env.setenv(ALLOWED, "[https://oops]")
    config = _reload_config()
    with pytest.raises(ValueError):
        _ = config.settings.allowed_origins


def test_openrouter_api_key_falls_back_to_openai_key(clean_env):
    clean_env.setenv(OPENAI, "legacy-key")
    config = _reload_config()
    assert config.settings.openrouter_api_key == "legacy-key"


def test_openrouter_api_key_prefers_openrouter_env(clean_env):
    clean_env.setenv(OPENAI, "legacy-key")
    clean_env.setenv(OPENROUTER, "preferred-key")
    config = _reload_config()
    assert config.settings.openrouter_api_key == "preferred-key"


def test_allowed_origins_not_a_settings_field(clean_env):
    config = _reload_config()
    field_names = set(type(config.settings).model_fields.keys())
    assert "allowed_origins" not in field_names
    assert "allowed_origins_raw" in field_names


@pytest.fixture(autouse=True)
def _restore_config_after_test():
    yield
    for key in (ALLOWED, OPENROUTER, OPENAI):
        os.environ.pop(key, None)
    _reload_config()
