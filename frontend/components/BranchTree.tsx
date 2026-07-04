'use client'

import { useMemo, useCallback } from 'react'
import ReactFlow, {
  Node, Edge, Background, Controls,
  BackgroundVariant
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Branch, Checkpoint, Dependency } from '@/lib/api'

interface Props {
  branches: Branch[]
  checkpoints: Checkpoint[]
  dependencies: Dependency[]
  activeBranchId: string | null
  selectedCheckpointId: string | null
  onSelectBranch: (id: string) => void
  onSelectCheckpoint: (id: string | null) => void
}

const RELATIONSHIP_COLORS: Record<string, string> = {
  'requires': '#f87171',
  'builds on': '#34d399',
  'conflicts with': '#fbbf24',
  'extends': '#60a5fa',
}

function buildGraph(
  branches: Branch[],
  checkpoints: Checkpoint[],
  dependencies: Dependency[],
  activeBranchId: string | null,
  selectedCheckpointId: string | null
) {
  if (!branches.length) return { nodes: [], edges: [] }

  const root = branches.find(b => !b.parent_branch_id)
  if (!root) return { nodes: [], edges: [] }

  const levels: Record<string, number> = { [root.id]: 0 }
  const queue = [root.id]
  while (queue.length) {
    const id = queue.shift()!
    branches.filter(b => b.parent_branch_id === id).forEach(child => {
      levels[child.id] = levels[id] + 1
      queue.push(child.id)
    })
  }

  const byLevel: Record<number, string[]> = {}
  Object.entries(levels).forEach(([id, level]) => {
    byLevel[level] = [...(byLevel[level] || []), id]
  })

  const positions: Record<string, { x: number; y: number }> = {}
  Object.entries(byLevel).forEach(([level, ids]) => {
    ids.forEach((id, i) => {
      positions[id] = {
        x: (i - (ids.length - 1) / 2) * 260,
        y: parseInt(level) * 180,
      }
    })
  })

  const cpsByBranch: Record<string, Checkpoint[]> = {}
  checkpoints.forEach(c => {
    cpsByBranch[c.branch_id] = [...(cpsByBranch[c.branch_id] || []), c]
  })

  const nodes: Node[] = []
  const edges: Edge[] = []

  // branch nodes
  branches.forEach((b, i) => {
    const isActive = b.id === activeBranchId
    const bCps = cpsByBranch[b.id] || []
    nodes.push({
      id: b.id,
      position: positions[b.id] || { x: 0, y: 0 },
      data: {
        label: (
          <div className="text-center leading-relaxed">
            <div className="font-mono text-xs font-bold text-gray-200">
              {i === 0 ? 'main' : `branch-${i}`}
            </div>
            <div className="font-mono text-[10px] text-gray-500">{b.id.slice(0, 8)}</div>
            {bCps.length > 0 && (
              <div className="font-mono text-[10px] text-purple-400 mt-0.5">
                ◉ {bCps.length} checkpoint{bCps.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        ),
      },
      style: {
        background: '#1a1a1a',
        border: `2px solid ${isActive ? '#10b981' : '#7c3aed'}`,
        borderRadius: '8px',
        padding: '10px 16px',
        minWidth: '130px',
        cursor: 'pointer',
        boxShadow: isActive ? '0 0 16px rgba(16,185,129,0.25)' : 'none',
      },
    })
  })

  // checkpoint nodes
  checkpoints.forEach((c, idx) => {
    const base = positions[c.branch_id] || { x: 0, y: 0 }
    const isSelected = c.id === selectedCheckpointId
    const cpDeps = dependencies.filter(d => d.branch_id === c.branch_id)

    nodes.push({
      id: `cp-${c.id}`,
      position: { x: base.x + 160, y: base.y + idx * 60 },
      data: {
        label: (
          <div className="text-center">
            <div className="font-mono text-[10px] font-bold text-purple-300">checkpoint</div>
            <div className="font-mono text-[9px] text-gray-500">{c.id.slice(0, 8)}</div>
            {cpDeps.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {cpDeps.slice(0, 3).map((d, i) => (
                  <div key={i} className="font-mono text-[8px] leading-tight"
                    style={{ color: RELATIONSHIP_COLORS[d.relationship] || '#9ca3af' }}>
                    {d.from_decision} <span style={{ color: '#4b5563' }}>→</span> {d.relationship} <span style={{ color: '#4b5563' }}>→</span> {d.to_decision}
                  </div>
                ))}
                {cpDeps.length > 3 && (
                  <div className="font-mono text-[8px] text-gray-600">+{cpDeps.length - 3} more</div>
                )}
              </div>
            )}
          </div>
        ),
      },
      style: {
        background: isSelected ? '#2d1f4e' : '#151515',
        border: `2px solid ${isSelected ? '#a855f7' : '#4c1d95'}`,
        borderRadius: '6px',
        padding: '6px 10px',
        minWidth: '120px',
        cursor: 'pointer',
        boxShadow: isSelected ? '0 0 12px rgba(168,85,247,0.3)' : 'none',
      },
    })

    edges.push({
      id: `branch-cp-${c.id}`,
      source: c.branch_id,
      target: `cp-${c.id}`,
      style: { stroke: '#4c1d95', strokeWidth: 1.5, strokeDasharray: '4 3' },
    })
  })

  // branch parent edges
  branches.filter(b => b.parent_branch_id).forEach(b => {
    edges.push({
      id: `${b.parent_branch_id}->${b.id}`,
      source: b.parent_branch_id!,
      target: b.id,
      style: { stroke: '#7c3aed', strokeWidth: 2 },
      animated: b.id === activeBranchId,
    })
  })

  return { nodes, edges }
}

export default function BranchTree({
  branches, checkpoints, dependencies,
  activeBranchId, selectedCheckpointId,
  onSelectBranch, onSelectCheckpoint
}: Props) {
  const { nodes, edges } = useMemo(
    () => buildGraph(branches, checkpoints, dependencies, activeBranchId, selectedCheckpointId),
    [branches, checkpoints, dependencies, activeBranchId, selectedCheckpointId]
  )

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (node.id.startsWith('cp-')) {
      const cpId = node.id.replace('cp-', '')
      onSelectCheckpoint(cpId === selectedCheckpointId ? null : cpId)
    } else {
      onSelectCheckpoint(null)
      onSelectBranch(node.id)
    }
  }, [onSelectBranch, onSelectCheckpoint, selectedCheckpointId])

  if (!branches.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm font-mono">
        initializing...
      </div>
    )
  }

  return (
    <div style={{ flex: 1 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background color="#1e1e1e" variant={BackgroundVariant.Dots} gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  )
}