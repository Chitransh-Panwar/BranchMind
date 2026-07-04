"use client";

import { useState, useEffect, useCallback } from "react";
import Chat from "./Chat";
import BranchTree from "./BranchTree";
import * as api from "@/lib/api";

export default function Main() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<api.Message[]>([]);
  const [branches, setBranches] = useState<api.Branch[]>([]);
  const [checkpoints, setCheckpoints] = useState<api.Checkpoint[]>([]);
  const [sending, setSending] = useState(false);
  const [showQuery, setShowQuery] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [queryResult, setQueryResult] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [dependencies, setDependencies] = useState<api.Dependency[]>([]);

  const refreshTree = useCallback(async () => {
    if (!sessionId) return;
    const [treeData, depsData] = await Promise.all([
      api.getTree(sessionId),
      api.getDependencies(sessionId),
    ]);
    setBranches(treeData.branches);
    setCheckpoints(treeData.checkpoints);
    setDependencies(depsData.dependencies);
  }, [sessionId]);

  useEffect(() => {
    api.createSession().then(({ session_id, root_branch_id }) => {
      setSessionId(session_id);
      setActiveBranchId(root_branch_id);
    });
  }, []);

  useEffect(() => {
    if (!activeBranchId || !sessionId) return;
    api.getMessages(activeBranchId).then(setMessages);
    refreshTree();
  }, [activeBranchId, sessionId, refreshTree]);

  const handleSend = async (content: string) => {
    if (!activeBranchId || sending) return;
    setSending(true);
    setMessages((prev) => [
      ...prev,
      {
        id: "temp",
        branch_id: activeBranchId,
        role: "user",
        content,
        seq: 0,
        created_at: new Date().toISOString(),
      },
    ]);
    await api.sendMessage(activeBranchId, content);
    const updated = await api.getMessages(activeBranchId);
    setMessages(updated);
    setSending(false);
  };

  const handleCheckpoint = async () => {
    if (!activeBranchId) return;
    await api.createCheckpoint(activeBranchId);
    await refreshTree();
  };

  const handleFork = async () => {
    if (!activeBranchId) return;
    const branchCps = checkpoints.filter((c) => c.branch_id === activeBranchId);
    if (!branchCps.length) {
      alert("Checkpoint this branch first before forking.");
      return;
    }
    const latest = branchCps[branchCps.length - 1];
    const { branch_id } = await api.forkBranch(latest.id);
    await refreshTree();
    await new Promise((r) => setTimeout(r, 1500));
    setActiveBranchId(branch_id);
  };

  const handleRevert = async () => {
    if (!selectedCheckpointId || reverting) return;
    setReverting(true);
    await api.revertToCheckpoint(selectedCheckpointId);
    const cp = checkpoints.find((c) => c.id === selectedCheckpointId);
    if (cp) {
      setActiveBranchId(cp.branch_id);
      await new Promise((r) => setTimeout(r, 500));
      const updated = await api.getMessages(cp.branch_id);
      setMessages(updated);
    }
    await refreshTree();
    setSelectedCheckpointId(null);
    setReverting(false);
  };

  const handleQuery = async () => {
    if (!sessionId || !queryInput.trim()) return;
    setQuerying(true);
    setQueryResult(null);
    const { results } = await api.queryGraph(sessionId, queryInput);
    const text = results.flatMap((r: any) => r.search_result).join("\n");
    setQueryResult(text || "No results found.");
    setQuerying(false);
  };

  const canFork = checkpoints.some((c) => c.branch_id === activeBranchId);

  return (
    <div className="flex flex-col h-screen bg-[#0d0d0d]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#2a2a2a] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-purple-400 font-mono font-bold text-base">
            ⎇ BranchMind
          </span>
          <span className="text-[11px] text-gray-600 font-mono hidden sm:block">
            git-style version control for conversations
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCheckpoint}
            disabled={!activeBranchId}
            className="px-3 py-1.5 text-xs font-mono bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 rounded hover:border-purple-500 hover:text-purple-400 disabled:opacity-40 transition-colors"
          >
            ◉ checkpoint
          </button>
          <button
            onClick={handleFork}
            disabled={!canFork}
            className="px-3 py-1.5 text-xs font-mono bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 rounded hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-40 transition-colors"
          >
            ⎇ fork
          </button>
          {selectedCheckpointId && (
            <button
              onClick={handleRevert}
              disabled={reverting}
              className="px-3 py-1.5 text-xs font-mono bg-[#1a1a1a] border border-red-500/50 text-red-400 rounded hover:bg-red-500/10 disabled:opacity-40 transition-colors"
            >
              {reverting ? "reverting..." : "↩ revert here"}
            </button>
          )}
          <button
            onClick={() => {
              setShowQuery(!showQuery);
              setQueryResult(null);
            }}
            className="px-3 py-1.5 text-xs font-mono bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 rounded hover:border-blue-500 hover:text-blue-400 transition-colors"
          >
            ◎ query graph
          </button>
        </div>
      </div>

      {/* Query Bar */}
      {showQuery && (
        <div className="px-6 py-3 border-b border-[#2a2a2a] bg-[#111] shrink-0 space-y-2">
          <div className="flex gap-2">
            <input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="ask across all branches... e.g. what did we decide about the database?"
              className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-1.5 text-sm font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleQuery}
              disabled={querying || !queryInput.trim()}
              className="px-4 py-1.5 text-xs font-mono bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-40 transition-colors"
            >
              {querying ? "asking..." : "ask"}
            </button>
          </div>
          {queryResult && (
            <div className="bg-[#1a1a1a] border border-blue-500/30 rounded px-3 py-2 text-sm font-mono text-blue-300 leading-relaxed">
              {queryResult}
            </div>
          )}
        </div>
      )}

      {/* Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat */}
        <div className="w-1/2 border-r border-[#2a2a2a] flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-[#2a2a2a] shrink-0">
            <span className="text-[11px] font-mono text-gray-500">
              active:{" "}
              <span className="text-emerald-400">
                {activeBranchId?.slice(0, 8) ?? "..."}
              </span>
            </span>
          </div>
          <Chat messages={messages} onSend={handleSend} sending={sending} />
        </div>

        {/* Tree */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-[#2a2a2a] shrink-0">
            <span className="text-[11px] font-mono text-gray-500">
              <span className="text-purple-400">{branches.length}</span>{" "}
              branches ·{" "}
              <span className="text-gray-500">{checkpoints.length}</span>{" "}
              checkpoints
              {selectedCheckpointId && (
                <span className="text-red-400 ml-3">
                  ↩ click revert to restore this checkpoint
                </span>
              )}
            </span>
          </div>
          <BranchTree
            branches={branches}
            checkpoints={checkpoints}
            dependencies={dependencies}
            activeBranchId={activeBranchId}
            selectedCheckpointId={selectedCheckpointId}
            onSelectBranch={(id) => {
              setSelectedCheckpointId(null);
              setActiveBranchId(id);
              setMessages([]);
            }}
            onSelectCheckpoint={setSelectedCheckpointId}
          />
        </div>
      </div>
    </div>
  );
}
