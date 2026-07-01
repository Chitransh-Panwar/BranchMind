"use client";

import { useMemo, useCallback } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import { Branch, Checkpoint } from "@/lib/api";

interface Props {
  branches: Branch[];
  checkpoints: Checkpoint[];
  activeBranchId: string | null;
  onSelectBranch: (id: string) => void;
}

function buildGraph(
  branches: Branch[],
  checkpoints: Checkpoint[],
  activeBranchId: string | null,
) {
  if (!branches.length) return { nodes: [], edges: [] };
  const root = branches.find((b) => !b.parent_branch_id);
  if (!root) return { nodes: [], edges: [] };

  const levels: Record<string, number> = { [root.id]: 0 };
  const queue = [root.id];
  while (queue.length) {
    const id = queue.shift()!;
    branches
      .filter((b) => b.parent_branch_id === id)
      .forEach((child) => {
        levels[child.id] = levels[id] + 1;
        queue.push(child.id);
      });
  }

  const byLevel: Record<number, string[]> = {};
  Object.entries(levels).forEach(([id, level]) => {
    byLevel[level] = [...(byLevel[level] || []), id];
  });

  const positions: Record<string, { x: number; y: number }> = {};
  Object.entries(byLevel).forEach(([level, ids]) => {
    ids.forEach((id, i) => {
      positions[id] = {
        x: (i - (ids.length - 1) / 2) * 220,
        y: parseInt(level) * 140,
      };
    });
  });

  const cpCount: Record<string, number> = {};
  checkpoints.forEach((c) => {
    cpCount[c.branch_id] = (cpCount[c.branch_id] || 0) + 1;
  });

  const nodes: Node[] = branches.map((b, i) => {
    const isActive = b.id === activeBranchId;
    return {
      id: b.id,
      position: positions[b.id] || { x: 0, y: 0 },
      data: {
        label: (
          <div className="text-center leading-relaxed">
            <div className="font-mono text-xs font-bold text-gray-200">
              {i === 0 ? "main" : `branch-${i}`}
            </div>
            <div className="font-mono text-[10px] text-gray-500">
              {b.id.slice(0, 8)}
            </div>
            {cpCount[b.id] ? (
              <div className="font-mono text-[10px] text-purple-400 mt-0.5">
                ◉ {cpCount[b.id]} checkpoint{cpCount[b.id] > 1 ? "s" : ""}
              </div>
            ) : null}
          </div>
        ),
      },
      style: {
        background: "#1a1a1a",
        border: `2px solid ${isActive ? "#10b981" : "#7c3aed"}`,
        borderRadius: "8px",
        padding: "10px 16px",
        minWidth: "130px",
        cursor: "pointer",
        boxShadow: isActive ? "0 0 16px rgba(16,185,129,0.25)" : "none",
      },
    }
  })

  const edges: Edge[] = branches
    .filter(b => b.parent_branch_id)
    .map(b => ({
      id: `${b.parent_branch_id}->${b.id}`,
      source: b.parent_branch_id!,
      target: b.id,
      style: { stroke: '#7c3aed', strokeWidth: 2 },
      animated: b.id === activeBranchId,
    }))

  return {nodes,edges}

}

export default function BranchTree({branches,checkpoints,activeBranchId,onSelectBranch}:Props) {
    const {nodes,edges}=useMemo(
        ()=>buildGraph(branches,checkpoints,activeBranchId),
        [branches,checkpoints,activeBranchId]
    )
    const onNodeClick=useCallback((_:any,node:Node)=>{
        onSelectBranch(node.id)
    },[onSelectBranch])
    if (!branches.length) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm font-mono">
                initializing...
            </div>
        )
    }
    return (
        <div style={{flex:1}}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodeClick={onNodeClick}
                fitView
                fitViewOptions={{ padding: 0.4 }}
                nodesDraggable={false}
                nodesConnectable={false}
            >
                <Background color="#1e1e1e" variant={BackgroundVariant.Dots} gap={20}/>
                <Controls/>
            </ReactFlow>
        </div>
    )
}
