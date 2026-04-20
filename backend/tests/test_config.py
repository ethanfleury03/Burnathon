"""Regression tests for app.config.Settings, especially ALLOWED_ORIGINS parsing.

History: pydantic-settings would call json.loads() on the env value for any field
typed list[str] (including a @computed_field named `allowed_origins`), so values
like `[https://brainrip.app]` or `""` crashed Settings() at import time. These
tests exercise the env-var shapes real deployments send so any future regression
fails in CI instead of at `alembic upgrade head` on a production server.
"""

from __future__ import annotations

import importlib
import os

import pytest


ALLOWED = "ALLOWED_ORIGINS"


def _reload_config():
    """Reload app.config so Settings() re-reads os.environ."""
    import app.config as config_module

    return importlib.reload(config_module)


@pytest.fixture
def clean_env(monkeypatch):
    monkeypatch.delenv(ALLOWED, raising=False)
    yield monkeypatch


def test_default_when_unset(clean_env):
    config = _reload_config()
    assert config.settings.allowed_origins == ["http://localhost:5173"]


def test_single_origin(clean_env):
    clean_env.setenv(ALLOWED, "https://brainrip.app")
    config = _reload_config()
    assert config.settings.allowed_origins == ["https://brainrip.app"]


def test_comma_separated(clean_env):
    clean_env.setenv(ALLOWED, "https://brainrip.app,https://www.brainrip.app")
    config = _reload_config()
    assert config.settings.allowed_origins == [
        "https://brainrip.app",
        "https://www.brainrip.app",
    ]


def test_comma_separated_trims_whitespace(clean_env):
    clean_env.setenv(ALLOWED, " https://a.com , https://b.com ")
    config = _reload_config()
    assert config.settings.allowed_origins == ["https://a.com", "https://b.com"]


def test_json_array(clean_env):
    clean_env.setenv(ALLOWED, '["https://brainrip.app"]')
    config = _reload_config()
    assert config.settings.allowed_origins == ["https://brainrip.app"]


def test_json_array_multiple(clean_env):
    clean_env.setenv(ALLOWED, '["https://a.com", "https://b.com"]')
    config = _reload_config()
    assert config.settings.allowed_origins == ["https://a.com", "https://b.com"]


def test_empty_string_falls_back_to_default(clean_env):
    """Regression: `ALLOWED_ORIGINS=` in backend.env used to crash json.loads('')."""
    clean_env.setenv(ALLOWED, "")
    config = _reload_config()
    assert config.settings.allowed_origins == ["http://localhost:5173"]


def test_bracketed_but_not_valid_json_raises(clean_env):
    """Regression: `ALLOWED_ORIGINS=[https://oops]` must fail loudly, not silently."""
    clean_env.setenv(ALLOWED, "[https://oops]")
    config = _reload_config()
    with pytest.raises(ValueError) as excinfo:
        _ = config.settings.allowed_origins
    assert "ALLOWED_ORIGINS" in str(excinfo.value)


def test_json_non_array_raises(clean_env):
    """A JSON object (not an array) should be rejected once the array path kicks in."""
    clean_env.setenv(ALLOWED, '[{"origin": "https://a.com"}]')
    config = _reload_config()
    with pytest.raises(ValueError):
        _ = config.settings.allowed_origins


def test_allowed_origins_not_a_settings_field(clean_env):
    """Guard against accidentally turning `allowed_origins` into a pydantic field.

    If a future refactor annotates `allowed_origins: list[str]` or wraps the property
    in @computed_field, pydantic-settings will start calling json.loads on the env
    value again and all the cases above will break. This test catches that at import
    time instead of at deploy time.
    """
    config = _reload_config()
    field_names = set(type(config.settings).model_fields.keys())
    assert "allowed_origins" not in field_names, (
        "`allowed_origins` must stay a @property, not a pydantic field; otherwise "
        "ALLOWED_ORIGINS env values go through json.loads and break for plain URLs."
    )
    assert "allowed_origins_raw" in field_names


@pytest.fixture(autouse=True)
def _restore_config_after_test():
    """Ensure downstream tests see a fresh Settings() built from the real test env."""
    yield
    os.environ.pop(ALLOWED, None)
    _reload_config()
