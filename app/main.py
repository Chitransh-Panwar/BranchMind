from fastapi import FastAPI
from app.routers import session

app = FastAPI(title="Branchmind")
app.include_router(session.router)

@app.get("/health")
def health():
    return {"status": "ok"}