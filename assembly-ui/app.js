let assembly = null;
let dragId = null;
let currentQueue = [];
let queueIndex = 0;

const blocksEl = document.getElementById("blocks");
const statusEl = document.getElementById("status");
const videoEl = document.getElementById("video");
const sourcesEl = document.getElementById("sources");
const nowPlayingEl = document.getElementById("nowPlaying");

const fmt = (n) => Number(n).toFixed(2);

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || response.statusText);
  return body;
}

function activeBlocks() {
  return assembly.blocks.filter((block) => block.status !== "deleted");
}

function renderSources() {
  sourcesEl.innerHTML = Object.values(assembly.sources)
    .map((source) => `<div><b>${source.id}</b> ${source.path}</div>`)
    .join("");
}

function renderBlocks() {
  blocksEl.innerHTML = "";
  for (const block of assembly.blocks) {
    const el = document.createElement("article");
    el.className = `block${block.status === "deleted" ? " deleted" : ""}`;
    el.draggable = true;
    el.dataset.id = block.id;
    el.innerHTML = `
      <div class="blockHead">
        <div><span class="blockId">${block.id}</span> · ${block.source} · ${fmt(block.start)}-${fmt(block.end)}s</div>
        <div class="miniActions">
          <button data-act="play">Play</button>
          <button data-act="${block.status === "deleted" ? "restore" : "delete"}">${block.status === "deleted" ? "Restore" : "Delete"}</button>
        </div>
      </div>
      <div class="blockText">${escapeHtml(block.text)}</div>
    `;
    blocksEl.appendChild(el);
  }
  statusEl.textContent = `${activeBlocks().length}/${assembly.blocks.length} active blocks`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cueBlock(block, autoplay = false) {
  const source = assembly.sources[block.source];
  const nextSrc = `/media/${encodeURIComponent(block.source)}`;
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

  if (!videoEl.src.endsWith(nextSrc)) {
    videoEl.src = nextSrc;
    videoEl.addEventListener("loadedmetadata", seek, { once: true });
  } else {
    seek();
  }
  nowPlayingEl.textContent = `${block.id} · ${block.source} · ${fmt(block.start)}-${fmt(block.end)}s`;
}

function playBlock(block) {
  cueBlock(block, true);
}

function playQueue(index = 0) {
  currentQueue = activeBlocks();
  queueIndex = index;
  if (!currentQueue.length) return;
  playBlock(currentQueue[queueIndex]);
}

videoEl.addEventListener("timeupdate", () => {
  const block = currentQueue[queueIndex];
  if (!block) return;
  if (videoEl.currentTime >= block.end - 0.03) {
    queueIndex += 1;
    if (queueIndex >= currentQueue.length) {
      videoEl.pause();
      nowPlayingEl.textContent = "Assembly playback complete";
      currentQueue = [];
      return;
    }
    playBlock(currentQueue[queueIndex]);
  }
});

blocksEl.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const blockEl = event.target.closest(".block");
  const block = assembly.blocks.find((item) => item.id === blockEl.dataset.id);
  const act = button.dataset.act;
  if (act === "play") {
    currentQueue = [];
    playBlock(block);
  }
  if (act === "delete") {
    block.status = "deleted";
    renderBlocks();
  }
  if (act === "restore") {
    block.status = "active";
    renderBlocks();
  }
});

blocksEl.addEventListener("dragstart", (event) => {
  const blockEl = event.target.closest(".block");
  if (!blockEl) return;
  dragId = blockEl.dataset.id;
  blockEl.classList.add("dragging");
});

blocksEl.addEventListener("dragend", () => {
  document.querySelectorAll(".dragging").forEach((el) => el.classList.remove("dragging"));
  dragId = null;
});

blocksEl.addEventListener("dragover", (event) => {
  event.preventDefault();
  const over = event.target.closest(".block");
  if (!over || !dragId || over.dataset.id === dragId) return;
  const from = assembly.blocks.findIndex((block) => block.id === dragId);
  const to = assembly.blocks.findIndex((block) => block.id === over.dataset.id);
  const [moved] = assembly.blocks.splice(from, 1);
  assembly.blocks.splice(to, 0, moved);
  renderBlocks();
});

document.getElementById("playAssemblyBtn").addEventListener("click", () => playQueue(0));
document.getElementById("stopBtn").addEventListener("click", () => {
  currentQueue = [];
  videoEl.pause();
  nowPlayingEl.textContent = "Stopped";
});
document.getElementById("saveBtn").addEventListener("click", async () => {
  const result = await api("/api/assembly", {
    method: "POST",
    body: JSON.stringify(assembly),
  });
  statusEl.textContent = `Saved: ${result.path}`;
});
document.getElementById("exportBtn").addEventListener("click", async () => {
  const result = await api("/api/export", {
    method: "POST",
    body: JSON.stringify(assembly),
  });
  statusEl.textContent = `Exported: ${result.path} (${result.ranges} ranges)`;
});

async function load() {
  assembly = await api("/api/assembly");
  renderSources();
  renderBlocks();
  const first = activeBlocks()[0];
  if (first) cueBlock(first, false);
}

load().catch((error) => {
  statusEl.textContent = error.message;
});
