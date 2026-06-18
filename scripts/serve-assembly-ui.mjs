#!/usr/bin/env node
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import {
  applyAssemblyEdit,
  assemblyToEdl,
  assertAssemblyIntegrity,
} from "../packages/assembly/index.mjs";
import { readJson, requireFile, writeJson } from "../packages/shared/json.mjs";
import { parseArgs } from "./args.mjs";

const args = parseArgs(process.argv.slice(2));
const assemblyPath = resolve(args.assembly ?? args._[0] ?? "remotion-host-overlay-work/assembly/assembly.json");
const edlPath = resolve(args.out ?? "remotion-host-overlay-work/assembly/edl.json");
const port = Number(args.port ?? 8898);
const uiDir = resolve("assembly-ui");

requireFile(assemblyPath, "assembly");
assertAssemblyIntegrity(readJson(assemblyPath));

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};

const sendJson = (res, status, value) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
};

const sendStatic = (res, path) => {
  if (!existsSync(path)) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": mime[extname(path)] ?? "application/octet-stream" });
  createReadStream(path).pipe(res);
};

const sendMedia = (req, res, sourceId) => {
  const assembly = readJson(assemblyPath);
  const source = assembly.sources[sourceId];
  if (!source) {
    res.writeHead(404);
    res.end("source not found");
    return;
  }
  const path = source.path;
  const stat = statSync(path);
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, {
      "content-length": stat.size,
      "content-type": mime[extname(path)] ?? "video/mp4",
    });
    createReadStream(path).pipe(res);
    return;
  }

  const [startRaw, endRaw] = range.replace(/bytes=/, "").split("-");
  const start = Number(startRaw);
  const end = endRaw ? Number(endRaw) : stat.size - 1;
  res.writeHead(206, {
    "content-range": `bytes ${start}-${end}/${stat.size}`,
    "accept-ranges": "bytes",
    "content-length": end - start + 1,
    "content-type": mime[extname(path)] ?? "video/mp4",
  });
  createReadStream(path, { start, end }).pipe(res);
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname === "/") return sendStatic(res, join(uiDir, "index.html"));
    if (url.pathname === "/app.css") return sendStatic(res, join(uiDir, "app.css"));
    if (url.pathname === "/app.js") return sendStatic(res, join(uiDir, "app.js"));

    if (url.pathname === "/api/assembly" && req.method === "GET") {
      return sendJson(res, 200, readJson(assemblyPath));
    }

    if (url.pathname === "/api/assembly" && req.method === "POST") {
      const baseAssembly = readJson(assemblyPath);
      const proposedAssembly = JSON.parse(await readBody(req));
      const assembly = applyAssemblyEdit(baseAssembly, proposedAssembly);
      writeJson(assemblyPath, assembly);
      return sendJson(res, 200, { ok: true, path: assemblyPath });
    }

    if (url.pathname === "/api/export" && req.method === "POST") {
      const baseAssembly = readJson(assemblyPath);
      const proposedAssembly = JSON.parse(await readBody(req));
      const assembly = applyAssemblyEdit(baseAssembly, proposedAssembly);
      writeJson(assemblyPath, assembly);
      const edl = assemblyToEdl(assembly);
      writeJson(edlPath, edl);
      return sendJson(res, 200, { ok: true, path: edlPath, ranges: edl.ranges.length });
    }

    if (url.pathname.startsWith("/media/")) {
      return sendMedia(req, res, decodeURIComponent(url.pathname.slice("/media/".length)));
    }

    res.writeHead(404);
    res.end("not found");
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Assembly UI: http://localhost:${port}`);
  console.log(`Assembly: ${assemblyPath}`);
});
