import os 
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

async def ingest_exchange(session_id:str,branch_id:str,user_content:str,assistant_content:str):
    dataset_name=_dataset_for_session(session_id)
    print("cognify started. ")
    text=f"User: {user_content}\nAssistant: {assistant_content}"
    item =DataItem(
        data=text,
        label=f"branch-{branch_id}",
        external_metadata={"branch_id":branch_id},
    )
    await cognee.add(item,dataset_name=dataset_name)
    await cognee.cognify(datasets=[dataset_name])
    print("cognify completed")

async def query_graph(session_id:str,question:str):
    dataset_name=_dataset_for_session(session_id)
    results=await cognee.search(
        query_text=question,
        query_type=cognee.SearchType.GRAPH_COMPLETION,
        datasets=[dataset_name],
    )
    print("graph query completed ")
    return results 