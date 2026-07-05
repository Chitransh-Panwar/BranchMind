# ⎇ BranchMind

> Git-style version control for LLM conversations — checkpoint, fork, revert, and query across branches with a live knowledge graph.

---

## What is it?

LLM conversations are linear. You can't go back, explore an alternative direction, or ask "what did we decide earlier?" across different threads. BranchMind fixes this.

Every conversation is a branch. You checkpoint it, fork it into parallel directions, switch between them freely, and query a shared knowledge graph that remembers decisions made across all branches — not just the one you're on.

---

## How the Knowledge Graph Works

### Cognee Integration

BranchMind uses [Cognee](https://github.com/topoteretes/cognee) as its knowledge graph engine. Cognee runs a full entity/relation extraction pipeline on every conversation exchange and stores the result in an internal graph database — giving BranchMind persistent, queryable memory across all branches of a session.

#### Configuration

Cognee is configured entirely via environment variables before import, using Groq as the LLM provider through LiteLLM's custom provider path, and FastEmbed for local embeddings:

```python
os.environ["LLM_PROVIDER"] = "groq"
os.environ["LLM_MODEL"] = "groq/llama-3.3-70b-versatile"
os.environ["LLM_API_KEY"] = settings.groq_api_key

os.environ["EMBEDDING_PROVIDER"] = "fastembed"
os.environ["EMBEDDING_MODEL"] = "sentence-transformers/all-MiniLM-L6-v2"
os.environ["EMBEDDING_DIMENSIONS"] = "384"

os.environ["COGNEE_SKIP_CONNECTION_TEST"] = "true"
```

FastEmbed runs fully locally (ONNX, CPU) — no embedding API key, no rate limits, no cost.

#### Dataset Scoping

Each BranchMind session gets its own isolated Cognee dataset — `session_{session_id}`. This ensures two different sessions never bleed into each other's knowledge graph. All branches within a session share the same dataset, which is what enables cross-branch querying.

```python
dataset_name = f"session_{session_id}"
```

#### Ingestion Pipeline (per message exchange)

Every user+assistant exchange is ingested as a background task so the chat response is returned immediately without blocking:

```python
# runs as FastAPI BackgroundTask after every reply
async def ingest_exchange(session_id, branch_id, user_content, assistant_content):
    item = DataItem(
        data=f"User: {user_content}\nAssistant: {assistant_content}",
        label=f"branch-{branch_id}",
        external_metadata={"branch_id": branch_id},
    )
    await cognee.add(item, dataset_name=dataset_name)
    await cognee.cognify(datasets=[dataset_name])
```

`cognify()` runs Cognee's full pipeline:
- Document classification
- Chunk extraction
- Entity + relationship extraction via structured LLM calls (Groq)
- Vector embedding via FastEmbed
- Graph storage in Cognee's internal Kuzu graph database

Average `cognify()` time with Groq: **~3.5 seconds**.

#### Cross-Branch Query

Queries use `GRAPH_COMPLETION` search type — Cognee retrieves relevant graph nodes via vector similarity, walks the graph edges, then uses the LLM to synthesize a natural language answer from the subgraph:

```python
results = await cognee.search(
    query_text=question,
    query_type=cognee.SearchType.GRAPH_COMPLETION,
    datasets=[dataset_name],
)
```

This is what powers the "ask across all branches" feature — decisions made on any branch are in the same dataset graph, so a single query surfaces answers from the full session history regardless of which branch they were made on.

#### Dependency Extraction

After every `cognify()` pass, a second lightweight Groq call runs a structured extraction prompt to detect decision dependencies:

```python
# extracts relationships like:
# { from: "prisma orm", to: "postgresql", relationship: "requires" }
```

Supported relationship types: `requires`, `builds on`, `conflicts with`, `extends`.

Results are stored in Supabase's `decision_dependencies` table and rendered as color-coded labels inside checkpoint nodes in the React Flow tree:
- 🔴 `requires`
- 🟢 `builds on`
- 🟡 `conflicts with`
- 🔵 `extends`

---

---

## Features

- **Checkpoint** — snapshot a conversation at any point
- **Fork** — branch off from any checkpoint into a new direction
- **Switch** — click any node in the tree to jump to that branch
- **Revert** — click a checkpoint and roll the branch back to that state
- **Cross-branch query** — ask "what did we decide about X?" and get answers pulled from all branches via a knowledge graph
- **Dependency tagging** — automatically detects and displays which decisions build on, require, or conflict with others
- **Live branch tree** — React Flow visualization showing branches, checkpoints, and dependency labels in real time

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI + Python |
| Database | Supabase (PostgreSQL) |
| Knowledge Graph | Cognee 1.2.2 |
| LLM (chat) | Groq — `llama-3.3-70b-versatile` |
| LLM (extraction) | Groq — `llama-3.3-70b-versatile` |
| Embeddings | FastEmbed (local, `all-MiniLM-L6-v2`) |
| Frontend | Next.js 14 + React Flow + Tailwind |

---

## Project Structure

```
BranchMind/
  app/
    main.py              # FastAPI entrypoint + CORS
    config.py            # Pydantic settings
    db.py                # Supabase client
    cognee_client.py     # Cognee + dependency extraction
    routers/
      session.py         # All API endpoints
  frontend/
    app/                 # Next.js app router
    components/
      Main.tsx           # Root layout + state
      Chat.tsx           # Chat panel
      BranchTree.tsx     # React Flow tree
    lib/
      api.ts             # API client
  spike_cognee.py        # Cognee integration test
  requirements.txt
  .env
```

---

## Setup

### Backend

```bash
python3 -m venv myvenv
source myvenv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file:
```
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_KEY=your_service_role_key
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile
```

Run the schema in your Supabase SQL editor (see `schema.sql`).

Start the server:
```bash
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the dev server:
```bash
npm run dev
```

Open `localhost:3000`.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/sessions` | Create a new session + root branch |
| POST | `/branches/:id/messages` | Send a message, get LLM reply |
| GET | `/branches/:id/messages` | Get message history |
| POST | `/branches/:id/checkpoints` | Checkpoint the branch |
| POST | `/checkpoints/:id/branch` | Fork a new branch |
| POST | `/checkpoints/:id/revert` | Revert branch to checkpoint |
| GET | `/sessions/:id/tree` | Get branches + checkpoints |
| GET | `/sessions/:id/dependencies` | Get decision dependencies |
| POST | `/sessions/:id/query` | Query the knowledge graph |


## Database Schema

```
sessions        → id, created_at
branches        → id, session_id, parent_branch_id, created_at
checkpoints     → id, branch_id, parent_checkpoint_id, message_hash, last_message_seq, created_at
messages        → id, branch_id, role, content, flagged_bad, seq, created_at
decision_dependencies → id, session_id, branch_id, from_decision, to_decision, relationship, created_at
```

---

## Built in 7 days — solo hackathon project.