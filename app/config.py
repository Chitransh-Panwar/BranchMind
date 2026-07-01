from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    
    groq_api_key:str
    groq_model:str

    class Config:
        env_file = ".env"
        extra="ignore"

settings = Settings()