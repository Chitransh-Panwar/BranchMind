const BASE=process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface Message {
    id:string
    branch_id:string
    role:'user' | 'assistant'
    content:string
    seq:number
    created_at:string
}

export interface Branch {
    id:string
    session_id:string
    parent_branch_id:string | null
    created_at:string
}

export interface Checkpoint {
    id:string
    branch_id:string 
    parent_checkpoint_id:string | null 
    last_message_seq:number
    created_at:string
}
export const createSession=()=>
    fetch(`${BASE}/sessions`,{method:'POST'}).then(r=>r.json()) as Promise<{session_id:string;root_branch_id:string}>

export const getMessage=(branchId:string,content:string) => 
    fetch(`${BASE}/branches/${branchId}/messages`).then(r=>r.json()) as Promise<Message[]>

export const sendMessage=(branchId:string,content:string) =>
    fetch(`${BASE}/branches/${branchId}/messages`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({content}),
    }).then(r=>r.json()) as Promise<Message>

export const createCheckpoint = (branchId:string) => 
    fetch(`${BASE}/branches/${branchId}/checkpoints`,{method:'POST'}).then(r=>r.json()) as Promise<Checkpoint>

export const forkBranch=(checkpointId:string) =>
    fetch(`${BASE}/checkpoints/${checkpointId}/branch`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({})
    }).then(r=>r.json()) as Promise<{branch_id:string}>

export const getTree=(sessionId:string) =>
    fetch(`${BASE}/sessions/${sessionId}/tree`).then(r => r.json()) as Promise<{ branches: Branch[]; checkpoints: Checkpoint[] }>

export const queryGraph=(sessionId:string,question:string) =>
    fetch(`${BASE}/sessions/${sessionId}/query`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({})
    }).then(r=>r.json()) as Promise<{results:any}> 