import os 
import json
import httpx
from app.db import supabase
from app.config import settings

os.environ["LLM_PROVIDER"]="custom"
os.environ["LLM_MODEL"] = "groq/llama-3.3-70b-versatile"
os.environ["LLM_API_KEY"] = settings.groq_api_key

os.environ["EMBEDDING_PROVIDER"] = "fastembed"
os.environ["EMBEDDING_MODEL"] = "sentence-transformers/all-MiniLM-L6-v2"
os.environ["EMBEDDING_DIMENSIONS"] = "384"

os.environ["COGNEE_SKIP_CONNECTION_TEST"] = "true"

import cognee
from cognee.tasks.ingestion.data_item import DataItem

def _dataset_for_session(session_id:str)->str:
    return f"session_{session_id}"

async def extract_dependencies(session_id: str, branch_id: str, user_content: str, assistant_content: str):
    from app.config import settings as s
    
    prompt = f"""Analyze this conversation exchange and extract any decision dependencies.
A dependency is when one decision requires, builds on, or is influenced by another decision.

Exchange:
User: {user_content}
Assistant: {assistant_content}

Respond ONLY with a JSON array. Each item must have:
- from_decision: the decision that depends on something (short phrase)
- to_decision: the decision it depends on (short phrase)
- relationship: one of "requires", "builds on", "conflicts with", "extends"

If no dependencies exist return an empty array [].
Return raw JSON only, no markdown, no explanation."""

    import json, httpx
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {s.groq_api_key}"},
            json={
                "model": s.groq_model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 512,
                "temperature": 0,
            }
        )

    if resp.status_code != 200:
        print("DEPENDENCY EXTRACTION FAILED:", resp.text)
        return

    raw = resp.json()["choices"][0]["message"]["content"].strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    print("DEPENDENCY RAW:", raw)

    try:
        deps = json.loads(raw)
    except Exception as e:
        print("DEPENDENCY PARSE ERROR:", e)
        return

    if not deps:
        return

    rows = [
        {
            "session_id": session_id,
            "branch_id": branch_id,
            "from_decision": d["from_decision"],
            "to_decision": d["to_decision"],
            "relationship": d["relationship"],
        }
        for d in deps
        if all(k in d for k in ["from_decision", "to_decision", "relationship"])
    ]

    if rows:
        supabase.table("decision_dependencies").insert(rows).execute()
        print(f"INSERTED {len(rows)} dependencies")

async def ingest_exchange(session_id: str, branch_id: str, user_content: str, assistant_content: str):
    print("cognify started...")
    dataset_name = _dataset_for_session(session_id)
    text = f"User: {user_content}\nAssistant: {assistant_content}"

    item = DataItem(
        data=text,
        label=f"branch-{branch_id}",
        external_metadata={"branch_id": branch_id},
    )

    await cognee.add(item, dataset_name=dataset_name)
    await cognee.cognify(datasets=[dataset_name])
    await extract_dependencies(session_id, branch_id, user_content, assistant_content)
    print("cognify ended ....")

async def query_graph(session_id:str,question:str):
    dataset_name=_dataset_for_session(session_id)
    results=await cognee.search(
        query_text=question,
        query_type=cognee.SearchType.GRAPH_COMPLETION,
        datasets=[dataset_name],
    )
    print("graph query completed ")
    return results 