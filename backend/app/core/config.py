"""Application settings loaded from environment variables / .env."""

from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/expense_tracker"

    clerk_issuer: str = ""
    clerk_jwks_url: str = ""
    # NoDecode: accept a plain comma-separated string instead of JSON.
    clerk_authorized_parties: Annotated[list[str], NoDecode] = []

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5-5"

    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    @field_validator("clerk_authorized_parties", "cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def jwks_url(self) -> str:
        if self.clerk_jwks_url:
            return self.clerk_jwks_url
        return f"{self.clerk_issuer.rstrip('/')}/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
