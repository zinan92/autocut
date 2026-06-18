export const cloneAssembly = (assembly) => ({
  ...assembly,
  sources: { ...assembly.sources },
  blocks: assembly.blocks.map((block) => ({ ...block })),
});

export const activeBlocks = (assembly) =>
  assembly.blocks.filter((block) => block.status !== "deleted");

export const previewQueue = (assembly) => activeBlocks(assembly);

export const durationOfBlocks = (blocks) =>
  Number(blocks.reduce((sum, block) => sum + Number(block.end) - Number(block.start), 0).toFixed(3));

export const sourceRuns = (blocks) => {
  const runs = [];
  for (const block of blocks) {
    const last = runs.at(-1);
    if (last?.source === block.source) {
      last.blocks += 1;
      last.duration = Number((last.duration + block.end - block.start).toFixed(3));
    } else {
      runs.push({
        source: block.source,
        blocks: 1,
        duration: Number((block.end - block.start).toFixed(3)),
      });
    }
  }
  return runs;
};

export const moveBlockBefore = (assembly, movingId, beforeId) => {
  if (!movingId || !beforeId || movingId === beforeId) return cloneAssembly(assembly);

  const next = cloneAssembly(assembly);
  const from = next.blocks.findIndex((block) => block.id === movingId);
  const to = next.blocks.findIndex((block) => block.id === beforeId);
  if (from < 0 || to < 0) {
    throw new Error(`Cannot move block: ${movingId} -> ${beforeId}`);
  }

  const [moved] = next.blocks.splice(from, 1);
  const adjustedTo = from < to ? to - 1 : to;
  next.blocks.splice(adjustedTo, 0, moved);
  return next;
};

export const moveBlockAfter = (assembly, movingId, afterId) => {
  if (!movingId || !afterId || movingId === afterId) return cloneAssembly(assembly);

  const next = cloneAssembly(assembly);
  const from = next.blocks.findIndex((block) => block.id === movingId);
  const to = next.blocks.findIndex((block) => block.id === afterId);
  if (from < 0 || to < 0) {
    throw new Error(`Cannot move block: ${movingId} -> ${afterId}`);
  }

  const [moved] = next.blocks.splice(from, 1);
  const adjustedTo = from < to ? to : to + 1;
  next.blocks.splice(adjustedTo, 0, moved);
  return next;
};

export const setBlockStatus = (assembly, blockId, status) => {
  if (!["active", "deleted"].includes(status)) {
    throw new Error(`Invalid block status: ${status}`);
  }

  const next = cloneAssembly(assembly);
  const block = next.blocks.find((item) => item.id === blockId);
  if (!block) throw new Error(`Unknown block: ${blockId}`);
  block.status = status;
  return next;
};

export const blockIndexById = (assembly, blockId) =>
  assembly.blocks.findIndex((block) => block.id === blockId);

export const nextPlayableBlock = (assembly, blockId) => {
  const index = blockIndexById(assembly, blockId);
  const queue = previewQueue(assembly);
  if (index < 0) return queue[0] ?? null;

  const after = assembly.blocks.slice(index + 1).find((block) => block.status !== "deleted");
  if (after) return after;

  const before = assembly.blocks.slice(0, index).reverse().find((block) => block.status !== "deleted");
  return before ?? null;
};

export const queueIndexForBlock = (queue, blockId) =>
  queue.findIndex((block) => block.id === blockId);

export const queueStats = (assembly) => {
  const queue = previewQueue(assembly);
  return {
    activeCount: queue.length,
    totalCount: assembly.blocks.length,
    deletedCount: assembly.blocks.length - queue.length,
    duration: durationOfBlocks(queue),
    runs: sourceRuns(queue),
  };
};
