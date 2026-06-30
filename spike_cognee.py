import asyncio 
import os 
import time
os.environ["LLM_PROVIDER"]="custom"
os.environ["LLM_MODEL"]="openrouter/owl-alpha"
os.environ["LLM_ENDPOINT"]="https://openrouter.ai/api/v1"
os.environ["LLM_API_KEY"]="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"

os.environ["EMBEDDING_PROVIDER"] = "fastembed"
os.environ["EMBEDDING_MODEL"] = "sentence-transformers/all-MiniLM-L6-v2"
os.environ["EMBEDDING_DIMENSIONS"] = "384"

os.environ["COGNEE_SKIP_CONNECTION_TEST"] = "true"

import cognee 
async def main():
    print("pruning any stale state ....")
    await cognee.prune.prune_data()
    await cognee.prune.prune_system(metadata=True)

    print("Adding test content ...")
    t0=time.time()
    await cognee.add([
        "We decided to use PostgreSQL instead of MongoDB for the main database, "
        "because we need strong relational consistency for the billing system."
    ])
    print(f"add() done in {time.time() - t0:.1f}s")
    print("Running cognify (entity/relation extraction)... ")
    t0=time.time()
    await cognee.cognify()
    print(f"cognify() done. in {time.time() - t0:.1f}s")

    print("Querying the graph... ")
    t0=time.time()
    results = await cognee.search(
        query_text="What database did we decide to use and why?",
        query_type=cognee.SearchType.GRAPH_COMPLETION,
    )
    print(f"search() done in {time.time() - t0:.1f}s")
    print("RESULT:", results)


if __name__ == "__main__":
    asyncio.run(main())

