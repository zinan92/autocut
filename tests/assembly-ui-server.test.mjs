import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { makeBlock } from "../packages/assembly/index.mjs";

const makeAssembly = () => ({
  version: 1,
  kind: "remotion-assembly",
  sources: {
    part1: { id: "part1", label: "part1", path: "/tmp/part1.mp4", duration: 10 },
    part2: { id: "part2", label: "part2", path: "/tmp/part2.mp4", duration: 10 },
  },
  blocks: [
    makeBlock({ id: "part1_001", source: "part1", start: 0, end: 3, text: "one" }),
    makeBlock({ id: "part2_001", source: "part2", start: 1, end: 4, text: "two" }),
    makeBlock({ id: "part1_002", source: "part1", start: 4, end: 7, text: "three" }),
  ],
});

const waitForServer = async (child, port) => new Promise((resolveReady, rejectReady) => {
  let output = "";
  const timer = setTimeout(() => {
    rejectReady(new Error(`Timed out waiting for assembly UI server. Output: ${output}`));
  }, 5000);

  const onData = (chunk) => {
    output += chunk.toString();
    if (output.includes(`http://localhost:${port}`)) {
      clearTimeout(timer);
      resolveReady();
    }
  };

  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  child.once("exit", (code) => {
    clearTimeout(timer);
    rejectReady(new Error(`Assembly UI server exited early with ${code}. Output: ${output}`));
  });
});

test("assembly UI server persists reorder/delete, exports EDL, and rejects text edits", async () => {
  const dir = mkdtempSync(join(tmpdir(), "assembly-ui-server-test-"));
  const assemblyPath = join(dir, "assembly.json");
  const edlPath = join(dir, "edl.json");
  writeFileSync(assemblyPath, JSON.stringify(makeAssembly(), null, 2), "utf8");

  const port = 21000 + Math.floor(Math.random() * 10000);
  const child = spawn(process.execPath, [
    resolve("scripts/serve-assembly-ui.mjs"),
    "--assembly",
    assemblyPath,
    "--out",
    edlPath,
    "--port",
    String(port),
  ], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForServer(child, port);
    const baseUrl = `http://localhost:${port}`;

    const coreResponse = await fetch(`${baseUrl}/app-core.mjs`);
    assert.equal(coreResponse.status, 200);
    assert.match(await coreResponse.text(), /previewQueue/);

    const loaded = await (await fetch(`${baseUrl}/api/assembly`)).json();
    assert.deepEqual(loaded.blocks.map((block) => block.id), [
      "part1_001",
      "part2_001",
      "part1_002",
    ]);

    const proposed = {
      ...loaded,
      blocks: [
        { ...loaded.blocks[1], status: "deleted" },
        loaded.blocks[0],
        loaded.blocks[2],
      ],
    };

    const saveResponse = await fetch(`${baseUrl}/api/assembly`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(proposed),
    });
    assert.equal(saveResponse.status, 200);

    const saved = JSON.parse(readFileSync(assemblyPath, "utf8"));
    assert.deepEqual(saved.blocks.map((block) => block.id), [
      "part2_001",
      "part1_001",
      "part1_002",
    ]);
    assert.equal(saved.blocks[0].status, "deleted");

    const exportResponse = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(saved),
    });
    assert.equal(exportResponse.status, 200);
    assert.equal(existsSync(edlPath), true);
    const edl = JSON.parse(readFileSync(edlPath, "utf8"));
    assert.deepEqual(edl.ranges.map((range) => range.blockId), ["part1_001", "part1_002"]);

    const tampered = {
      ...saved,
      blocks: [{ ...saved.blocks[0], text: "rewritten" }, ...saved.blocks.slice(1)],
    };
    const tamperResponse = await fetch(`${baseUrl}/api/assembly`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(tampered),
    });
    assert.equal(tamperResponse.status, 400);
    assert.match((await tamperResponse.json()).error, /immutable field: text/);
  } finally {
    child.kill("SIGTERM");
  }
});
