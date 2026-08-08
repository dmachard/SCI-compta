from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://scicompta:scicompta@db:5432/scicompta"
    SECRET_KEY: str = "change-me-to-a-random-secret-key"
    UPLOAD_DIR: str = "uploads"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h

    model_config = {"env_file": ".env"}


settings = Settings()
