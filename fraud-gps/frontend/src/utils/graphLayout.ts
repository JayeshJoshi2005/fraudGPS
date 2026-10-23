import type { GraphData } from '../types';

/** Lay out transaction hops without treating shared identifiers as money flow. */
export function flowPositions(graph: GraphData, width: number, height: number, start?: string) {
  const ids = graph.nodes.map(({ data }) => data.id).sort();
  const outgoing = new Map(ids.map((id) => [id, new Set<string>()]));
  const incoming = new Map(ids.map((id) => [id, new Set<string>()]));
  for (const { data } of graph.edges) {
    if (data.kind !== 'transaction' || !outgoing.has(data.source) || !incoming.has(data.target))
      continue;
    outgoing.get(data.source)!.add(data.target);
    incoming.get(data.target)!.add(data.source);
  }
  const levels = new Map<string, number>();
  const roots =
    start && outgoing.has(start)
      ? [start]
      : ids.filter((id) => !incoming.get(id)!.size && outgoing.get(id)!.size);
  function visit(root: string, depth: number) {
    levels.set(root, depth);
    const queue = [root];
    for (let i = 0; i < queue.length; i++) {
      const source = queue[i];
      for (const target of [...outgoing.get(source)!].sort()) {
        if (levels.has(target)) continue;
        levels.set(target, levels.get(source)! + 1);
        queue.push(target);
      }
    }
  }
  roots.forEach((root) => {
    if (!levels.has(root)) visit(root, 0);
  });
  // Keep disconnected transaction components (including cycles) visible.
  for (const id of ids) {
    if (!levels.has(id) && (outgoing.get(id)!.size || incoming.get(id)!.size)) visit(id, 0);
  }
  const lastHop = Math.max(0, ...levels.values());
  // Identifier-only peers get their own column; they never change transaction depth.
  ids.forEach((id) => {
    if (!levels.has(id)) levels.set(id, lastHop + 1);
  });
  const columns = [...new Set(levels.values())]
    .sort((a, b) => a - b)
    .map((level) => ids.filter((id) => levels.get(id) === level));
  // Order each column by its parents, keeping split branches next to one another.
  const order = new Map<string, number>();
  columns.forEach((column) => {
    const parentOrder = (id: string) => {
      const parents = [...incoming.get(id)!].filter((parent) => order.has(parent));
      return parents.length
        ? parents.reduce((sum, parent) => sum + order.get(parent)!, 0) / parents.length
        : Number.MAX_SAFE_INTEGER;
    };
    column.sort((a, b) => parentOrder(a) - parentOrder(b) || a.localeCompare(b));
    column.forEach((id, index) => order.set(id, index));
  });
  // On short laptop screens, wrap crowded hops into adjacent, staggered columns.
  const maxRows =
    height < 600 && width >= 640 ? Math.max(3, Math.floor((height - 110) / 65)) : Infinity;
  const groups = columns.map((column) => ({
    column,
    count: Math.ceil(column.length / maxRows) || 1,
  }));
  const slots = groups.reduce((sum, group) => sum + group.count, 0);
  const rows = Math.max(1, ...groups.map(({ column, count }) => Math.ceil(column.length / count)));
  const wrapped = groups.some(({ count }) => count > 1);
  const usableHeight = Math.max(height - 160, (rows - 1) * (wrapped ? 100 : 78));
  const naturalHeight = usableHeight + Math.max(0, ...groups.map(({ count }) => count - 1)) * 50;
  const expectedZoom = wrapped ? Math.min(1, (height - 110) / (naturalHeight + 100)) : 1;
  const usableWidth = Math.max((width - 180) / expectedZoom, (slots - 1) * (wrapped ? 150 : 190));
  const positions: Record<string, { x: number; y: number }> = {};
  let offset = 0;
  groups.forEach(({ column, count }) => {
    column.forEach((id, index) => {
      const subcolumn = index % count;
      const row = Math.floor(index / count);
      const rowCount = Math.ceil((column.length - subcolumn) / count);
      positions[id] = {
        x: slots === 1 ? usableWidth / 2 : ((offset + subcolumn) * usableWidth) / (slots - 1),
        y:
          (rowCount === 1 ? usableHeight / 2 : (row * usableHeight) / (rowCount - 1)) +
          (count > 1 ? subcolumn * 50 : 0),
      };
    });
    offset += count;
  });
  return positions;
}
