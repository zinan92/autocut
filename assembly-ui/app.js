import {
  activeBlocks,
  durationOfBlocks,
  moveBlockAfter,
  moveBlockBefore,
  nextPlayableBlock,
  previewQueue,
  queueIndexForBlock,
  queueStats,
  setBlockStatus,
} from "./app-core.mjs";

let assembly = null;
let dragId = null;
let selectedBlockId = null;
let currentQueue = [];
let queueIndex = 0;
let isAssemblyPlayback = false;
let isDirty = false;

const blocksEl = document.getElementById("blocks");
const statusEl = document.getElementById("status");
const videoEl = document.getElementById("video");
const sourcesEl = document.getElementById("sources");
const nowPlayingEl = document.getElementById("nowPlaying");
const queueEl = document.getElementById("queue");
const saveBtn = document.getElementById("saveBtn");
const exportBtn = document.getElementById("exportBtn");
const playAssemblyBtn = document.getElementById("playAssemblyBtn");
const stopBtn = document.getElementById("stopBtn");

const fmt = (n) => Number(n).toFixed(2);

const fmtDuration = (seconds) => {
  const totalSeconds = Math.round(Number(seconds));
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || response.statusText);
  return body;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(message, tone = "muted") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function markDirty(message = "Unsaved changes") {
  isDirty = true;
  document.body.classList.add("dirty");
  setStatus(`${message}. Preview queue updated; no render needed.`, "warn");
}

function markClean(message) {
  isDirty = false;
  document.body.classList.remove("dirty");
  setStatus(message, "ok");
}

function selectedBlock() {
  if (!selectedBlockId) return null;
  return assembly.blocks.find((block) => block.id === selectedBlockId) ?? null;
}

function renderSources() {
  sourcesEl.innerHTML = Object.values(assembly.sources)
    .map((source) => `
      <div class="sourceItem">
        <b>${escapeHtml(source.id)}</b>
        <span>${escapeHtml(source.label ?? source.id)}</span>
        <code>${escapeHtml(source.path)}</code>
      </div>
    `)
    .join("");
}

function renderQueue() {
  const stats = queueStats(assembly);
  const runs = stats.runs.map((run) => `
    <span class="runPill">${escapeHtml(run.source)} · ${run.blocks} blocks · ${fmtDuration(run.duration)}</span>
  `).join("");

  queueEl.innerHTML = `
    <div class="queueStats">
      <b>${stats.activeCount}/${stats.totalCount}</b> active
      <span>${fmtDuration(stats.duration)}</span>
      <span>${stats.deletedCount} deleted</span>
      ${isDirty ? "<span class=\"dirtyFlag\">unsaved</span>" : ""}
    </div>
    <div class="queueRuns">${runs || "<span class=\"emptyHint\">No active blocks</span>"}</div>
  `;
}

function renderBlocks() {
  blocksEl.innerHTML = "";
  for (const block of assembly.blocks) {
    const el = document.createElement("article");
    const selected = block.id === selectedBlockId ? " selected" : "";
    el.className = `block${block.status === "deleted" ? " deleted" : ""}${selected}`;
    el.draggable = true;
    el.dataset.id = block.id;
    el.innerHTML = `
      <div class="blockHead">
        <div>
          <span class="blockId">${escapeHtml(block.id)}</span>
          <span>${escapeHtml(block.source)} · ${fmt(block.start)}-${fmt(block.end)}s · ${fmtDuration(block.end - block.start)}</span>
        </div>
        <div class="miniActions">
          <button type="button" data-act="play">Play</button>
          <button type="button" data-act="${block.status === "deleted" ? "restore" : "delete"}">
            ${block.status === "deleted" ? "Restore" : "Delete"}
          </button>
        </div>
      </div>
      <div class="blockText">${escapeHtml(block.text)}</div>
    `;
    blocksEl.appendChild(el);
  }
  renderQueue();
}

function cueBlock(block, autoplay = false) {
  if (!block) return;
  const nextSrc = `/media/${encodeURIComponent(block.source)}`;
  selectedBlockId = block.id;

  const seek = () => {
    try {
      videoEl.currentTime = block.start;
    } catch (_) {}
    if (autoplay) {
      videoEl.play().catch((error) => {
        nowPlayingEl.textContent = `Playback blocked: ${error.message}`;
      });
    }
  };

  if (videoEl.dataset.source !== block.source) {
    videoEl.src = nextSrc;
    videoEl.dataset.source = block.source;
    videoEl.addEventListener("loadedmetadata", seek, { once: true });
  } else {
    seek();
  }
  nowPlayingEl.textContent = `${block.id} · ${block.source} · ${fmt(block.start)}-${fmt(block.end)}s`;
  renderBlocks();
}

function syncQueueAfterEdit() {
  if (!isAssemblyPlayback) return;
  const queue = previewQueue(assembly);
  const current = currentQueue[queueIndex];
  currentQueue = queue;
  queueIndex = Math.max(0, queueIndexForBlock(currentQueue, current?.id));
  if (queueIndex < 0) {
    const next = nextPlayableBlock(assembly, current?.id);
    queueIndex = next ? queueIndexForBlock(currentQueue, next.id) : 0;
  }
}

function playBlock(block) {
  isAssemblyPlayback = false;
  currentQueue = [];
  queueIndex = 0;
  cueBlock(block, true);
}

function playQueue(index = 0) {
  currentQueue = previewQueue(assembly);
  queueIndex = index;
  isAssemblyPlayback = true;
  if (!currentQueue.length) {
    nowPlayingEl.textContent = "No active blocks";
    return;
  }
  cueBlock(currentQueue[queueIndex], true);
}

function selectBlock(block) {
  isAssemblyPlayback = false;
  currentQueue = [];
  queueIndex = 0;
  cueBlock(block, false);
}

function applyAssembly(nextAssembly, message) {
  assembly = nextAssembly;
  const selected = selectedBlock();
  if (!selected || selected.status === "deleted") {
    selectedBlockId = nextPlayableBlock(assembly, selectedBlockId)?.id ?? null;
  }
  syncQueueAfterEdit();
  renderBlocks();
  markDirty(message);
}

videoEl.addEventListener("timeupdate", () => {
  if (!isAssemblyPlayback) return;
  const block = currentQueue[queueIndex];
  if (!block) return;
  if (videoEl.currentTime >= block.end - 0.03) {
    currentQueue = previewQueue(assembly);
    queueIndex += 1;
    if (queueIndex >= currentQueue.length) {
      videoEl.pause();
      nowPlayingEl.textContent = "Assembly playback complete";
      currentQueue = [];
      isAssemblyPlayback = false;
      return;
    }
    cueBlock(currentQueue[queueIndex], true);
  }
});

blocksEl.addEventListener("click", (event) => {
  const blockEl = event.target.closest(".block");
  if (!blockEl) return;
  const block = assembly.blocks.find((item) => item.id === blockEl.dataset.id);
  if (!block) return;

  const button = event.target.closest("button");
  if (!button) {
    selectBlock(block);
    return;
  }

  const act = button.dataset.act;
  if (act === "play") {
    playBlock(block);
  }
  if (act === "delete") {
    applyAssembly(setBlockStatus(assembly, block.id, "deleted"), `Deleted ${block.id}`);
  }
  if (act === "restore") {
    applyAssembly(setBlockStatus(assembly, block.id, "active"), `Restored ${block.id}`);
  }
});

blocksEl.addEventListener("dragstart", (event) => {
  const blockEl = event.target.closest(".block");
  if (!blockEl) return;
  dragId = blockEl.dataset.id;
  blockEl.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", dragId);
});

blocksEl.addEventListener("dragend", () => {
  document.querySelectorAll(".dragging, .dropBefore, .dropAfter").forEach((el) => {
    el.classList.remove("dragging", "dropBefore", "dropAfter");
  });
  dragId = null;
});

blocksEl.addEventListener("dragover", (event) => {
  const over = event.target.closest(".block");
  if (!over || !dragId || over.dataset.id === dragId) return;
  event.preventDefault();
  document.querySelectorAll(".dropBefore, .dropAfter").forEach((el) => {
    el.classList.remove("dropBefore", "dropAfter");
  });
  const rect = over.getBoundingClientRect();
  const after = event.clientY > rect.top + rect.height / 2;
  over.classList.add(after ? "dropAfter" : "dropBefore");
});

blocksEl.addEventListener("drop", (event) => {
  const over = event.target.closest(".block");
  if (!over || !dragId || over.dataset.id === dragId) return;
  event.preventDefault();
  const rect = over.getBoundingClientRect();
  const after = event.clientY > rect.top + rect.height / 2;
  const next = after
    ? moveBlockAfter(assembly, dragId, over.dataset.id)
    : moveBlockBefore(assembly, dragId, over.dataset.id);
  applyAssembly(next, `Moved ${dragId}`);
});

playAssemblyBtn.addEventListener("click", () => playQueue(0));

stopBtn.addEventListener("click", () => {
  currentQueue = [];
  isAssemblyPlayback = false;
  videoEl.pause();
  nowPlayingEl.textContent = "Stopped";
});

saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  try {
    const result = await api("/api/assembly", {
      method: "POST",
      body: JSON.stringify(assembly),
    });
    markClean(`Saved: ${result.path}`);
  } catch (error) {
    setStatus(`Save failed: ${error.message}`, "error");
  } finally {
    saveBtn.disabled = false;
  }
});

exportBtn.addEventListener("click", async () => {
  exportBtn.disabled = true;
  try {
    const result = await api("/api/export", {
      method: "POST",
      body: JSON.stringify(assembly),
    });
    markClean(`Exported: ${result.path} (${result.ranges} ranges)`);
  } catch (error) {
    setStatus(`Export failed: ${error.message}`, "error");
  } finally {
    exportBtn.disabled = false;
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!isDirty) return;
  event.preventDefault();
  event.returnValue = "";
});

async function load() {
  assembly = await api("/api/assembly");
  selectedBlockId = activeBlocks(assembly)[0]?.id ?? null;
  renderSources();
  renderBlocks();
  const first = selectedBlock();
  if (first) cueBlock(first, false);
  markClean(`Loaded ${activeBlocks(assembly).length}/${assembly.blocks.length} active blocks · ${fmtDuration(durationOfBlocks(activeBlocks(assembly)))}`);
}

load().catch((error) => {
  setStatus(error.message, "error");
});
