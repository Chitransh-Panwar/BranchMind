from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.routers import session
import cognee

@asynccontextmanager
async def lifespan(app:FastAPI):
    await cognee.prune.prune_system(metadata=True)
    yield

app = FastAPI(title="Branchmind",lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin=["https://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(session.router)

@app.get("/health")
def health():
    return {"status": "ok"}