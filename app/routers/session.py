from fastapi import APIRouter,HTTPException,BackgroundTasks
from app.cognee_client import ingest_exchange,query_graph
from pydantic import BaseModel
import httpx
import hashlib
from app.db import supabase
from app.config import settings

router =APIRouter()

class MessageCreate(BaseModel):
    content:str

class BranchCreate(BaseModel):
    name:str | None = None

class QueryRequest(BaseModel):
    question:str
@router.get("/sessions/{session_id}/tree")
def get_tree(session_id: str):
    session = supabase.table("sessions").select("id").eq("id", session_id).execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="session not found")

    branches = supabase.table("branches").select("*").eq("session_id", session_id).order("created_at").execute()
    if not branches.data:
        return {"branches": [], "checkpoints": []}

    branch_ids = [b["id"] for b in branches.data]
    checkpoints = supabase.table("checkpoints").select("*").in_("branch_id", branch_ids).order("created_at").execute()

    return {"branches": branches.data, "checkpoints": checkpoints.data}

@router.post("/sessions")
def create_session():
    session = supabase.table("sessions").insert({}).execute()
    session_id = session.data[0]["id"]

    branch = supabase.table("branches").insert({
        "session_id": session_id,
        "parent_branch_id": None,
    }).execute()
    branch_id = branch.data[0]["id"]

    return {"session_id": session_id, "root_branch_id": branch_id}

@router.get("/branches/{branch_id}/messages")
def get_messages(branch_id:str):
    result =supabase.table("messages").select("*").eq("branch_id",branch_id).order("seq").execute()
    return result.data

@router.post("/branches/{branch_id}/checkpoints")
def create_checkpoints(branch_id:str):
    branch=supabase.table("branches").select("id,session_id").eq("id",branch_id).execute()
    if not branch.data:
        raise HTTPException(status_code=404,detail="Branch not found ")
    messages=supabase.table("messages").select("seq,role,content").eq("branch_id",branch_id).order("seq").execute()
    if not messages.data:
        raise HTTPException(status_code=400,detail="cannot checkpoint an empty branch ")
    last_seq=messages.data[-1]["seq"]
    raw="".join(f"{m['role']}:{m['content']}" for m in messages.data)
    message_hash=hashlib.sha256(raw.encode()).hexdigest()
    last_checkpoint=supabase.table("checkpoints").select("id").eq("branch_id",branch_id).order("created_at",desc=True).limit(1).execute()
    parent_checkpoint_id=last_checkpoint.data[0]["id"] if last_checkpoint.data else None
    checkpoint=supabase.table("checkpoints").insert({
        "branch_id":branch_id,
        "parent_checkpoint_id":parent_checkpoint_id,
        "message_hash":message_hash,
        "last_message_seq":last_seq
    }).execute()
    return checkpoint.data[0]

@router.post("/checkpoints/{checkpoint_id}/branch")
def fork_branch(checkpoint_id:str,body:BranchCreate):

    checkpoint=supabase.table("checkpoints").select("*").eq("id",checkpoint_id).execute()
    if not checkpoint.data:
        raise HTTPException(status_code=404,detail="checkpoint not found ")
    checkpoint=checkpoint.data[0]
    source_branch=supabase.table("branches").select("session_id").eq("id",checkpoint["branch_id"]).execute()
    session_id=source_branch.data[0]["session_id"]
    new_branch=supabase.table("branches").insert({
        "session_id":session_id,
        "parent_branch_id":checkpoint["branch_id"],
    }).execute()
    new_branch_id=new_branch.data[0]["id"]
    source_messages=supabase.table("messages").select("role,content").eq("branch_id",checkpoint["branch_id"]).lte("seq",checkpoint["last_message_seq"]).order("seq").execute()

    row_to_copy=[
        {"branch_id":new_branch_id,"role":m["role"],"content":m["content"]} for m in source_messages.data
    ]
    if row_to_copy:
        supabase.table("messages").insert(row_to_copy).execute()

    return{"branch_id":new_branch_id,"forked_from_checkpoint":checkpoint_id,"messages_copied":len(row_to_copy)}

@router.post("/branches/{branch_id}/messages")
async def post_messages(branch_id:str,msg:MessageCreate,background_tasks:BackgroundTasks):
    branch =supabase.table("branches").select("id,session_id").eq("id",branch_id).execute()
    if not branch.data:
        raise HTTPException(status_code=404,detail="branch not found")
    session_id=branch.data[0]["session_id"]
    supabase.table("messages").insert({
        "branch_id":branch_id,
        "role":"user",
        "content":msg.content,
    }).execute()

    history=supabase.table("messages").select("role,content").eq("branch_id",branch_id).order("seq").execute()
    llm_messages=[{"role":m["role"],"content":m["content"]} for m in history.data]
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json={"model": settings.groq_model, "messages": llm_messages,"max_tokens":250},
        )
    if resp.status_code!=200:
        raise HTTPException(status_code=502,detail=f"OpenRouter error: {resp.text}")
    reply_content=resp.json()["choices"][0]["message"]["content"]
    saved=supabase.table("messages").insert({
        "branch_id":branch_id,
        "role":"assistant",
        "content":reply_content
    }).execute()

    background_tasks.add_task(ingest_exchange,session_id,branch_id,msg.content,reply_content)
    return saved.data[0]

@router.post("/sessions/{session_id}/query")
async def query_session(session_id: str, body: QueryRequest):
    session = supabase.table("sessions").select("id").eq("id", session_id).execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="session not found")

    results = await query_graph(session_id, body.question)
    if results is None:
        results=[]
    return {"results": results}