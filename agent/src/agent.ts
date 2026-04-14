import readlineSync from "readline-sync";
import { llm, MODEL } from "./llm.js";
import { startMcp, listTools, callTool } from "./mcpClient.js";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ToolChoice =
  | { type: "tool"; tool: string; args: Record<string, any> }
  | { type: "final"; answer: string };

const MAX_STEPS = 6;

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

async function askModel(messages: ChatMessage[]): Promise<string> {
  const res = await llm.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages,
  });

  return res.choices[0]?.message?.content?.trim() || "";
}

async function runAgent(userQuery: string) {
  const tools = await listTools();

  const toolsText =
    tools.length === 0
      ? "No MCP tools available."
      : tools
          .map((t: any) => {
            const inputSchema = t.inputSchema
              ? JSON.stringify(t.inputSchema)
              : "{}";
            return `- ${t.name}: ${t.description || "No description"}\n  inputSchema: ${inputSchema}`;
          })
          .join("\n");

  const systemPrompt = `
You are a Vulnerability Intelligence Analyst.

You can use MCP tools when needed.
Use ONLY the available MCP tools for factual/tool-based information.
Do not invent tool results, vulnerabilities, CVEs, hosts, ports, or findings.
If the user asks something that requires tool data, use a tool.
If enough information is already available from prior tool results, give a final answer.

Available tools:
${toolsText}

You must respond in EXACTLY one JSON object, with no markdown and no extra text.

If you want to call a tool, respond with:
{"type":"tool","tool":"tool_name","args":{}}

If you want to give the final answer, respond with:
{"type":"final","answer":"your answer"}

Rules:
- Never output anything except a single valid JSON object.
- Tool args must match the tool schema as closely as possible.
- Keep final answers concise but useful.
`.trim();

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userQuery },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const raw = await askModel(messages);

    let parsed = safeJsonParse<ToolChoice>(raw);
    if (!parsed) {
      const extracted = extractJsonObject(raw);
      if (extracted) parsed = safeJsonParse<ToolChoice>(extracted);
    }

    if (!parsed) {
      messages.push({
        role: "assistant",
        content: raw,
      });
      messages.push({
        role: "user",
        content:
          'Your previous reply was invalid. Reply with exactly one valid JSON object using either {"type":"tool","tool":"name","args":{}} or {"type":"final","answer":"text"}.',
      });
      continue;
    }

    if (parsed.type === "final") {
      return parsed.answer;
    }

    if (parsed.type === "tool") {
      const result = await callTool(parsed.tool, parsed.args ?? {});

      messages.push({
        role: "assistant",
        content: JSON.stringify(parsed),
      });

      messages.push({
        role: "user",
        content: `Tool "${parsed.tool}" returned:\n${JSON.stringify(
          result,
          null,
          2,
        )}\n\nNow decide whether to call another tool or return the final answer as JSON.`,
      });

      continue;
    }

    messages.push({
      role: "user",
      content:
        'Invalid response shape. Reply with exactly one JSON object using {"type":"tool",...} or {"type":"final",...}.',
    });
  }

  return "I could not complete the analysis reliably within the tool-step limit.";
}

async function run() {
  await startMcp();

  while (true) {
    const q = readlineSync.question("\nExplore vulnerabilities: ");
    if (!q.trim()) continue;

    try {
      const answer = await runAgent(q);
      console.log("\nAnswer:\n", answer);
    } catch (err: any) {
      console.error("\nAgent error:\n", err?.message || err);
    }
  }
}

run();
