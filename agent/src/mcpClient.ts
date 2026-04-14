import { spawn, ChildProcessWithoutNullStreams } from "child_process";

let proc: ChildProcessWithoutNullStreams | null = null;
let buffer = "";
let nextId = 1;

const pending = new Map<
  number,
  {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }
>();

function handleMessage(msg: any) {
  if (msg?.id != null && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)!;
    pending.delete(msg.id);

    if (msg.error) {
      reject(new Error(JSON.stringify(msg.error)));
    } else {
      resolve(msg.result);
    }
  }
}

function setupStdout() {
  if (!proc) return;

  proc.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) continue;

      try {
        const msg = JSON.parse(line);
        handleMessage(msg);
      } catch (err) {
        console.error("Failed to parse MCP message:", line);
      }
    }
  });

  proc.stderr.on("data", (d: Buffer) => {
    console.error("MCP stderr:", d.toString());
  });

  proc.on("exit", (code) => {
    for (const [, { reject }] of pending) {
      reject(new Error(`MCP process exited with code ${code}`));
    }
    pending.clear();
    proc = null;
  });
}

function sendRpc(method: string, params?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!proc) {
      reject(new Error("MCP process is not running"));
      return;
    }

    const id = nextId++;
    pending.set(id, { resolve, reject });

    const msg = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    proc.stdin.write(JSON.stringify(msg) + "\n");
  });
}

export async function startMcp() {
  if (proc) return;

  proc = spawn("node", ["../dist/server.js"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  setupStdout();

  await sendRpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "custom-mcp-agent",
      version: "1.0.0",
    },
  }).catch(() => null);
}

export async function listTools() {
  const result = await sendRpc("tools/list", {});
  return result?.tools ?? [];
}

export async function callTool(name: string, args: any) {
  return await sendRpc("tools/call", {
    name,
    arguments: args,
  });
}
