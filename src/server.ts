import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseDbFile, ParsedFile } from "./parser.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// אם הקבצים יושבים ב-root של הפרויקט:
const DATA_DIR = resolve(__dirname, "..");

let vendors: ParsedFile;
let vulnerabilities: ParsedFile;

function loadData() {
  vendors = parseDbFile(resolve(DATA_DIR, "vendors.db"));
  vulnerabilities = parseDbFile(resolve(DATA_DIR, "vulnerabilities.db"));
  console.error(
    `Loaded ${vendors.records.length} vendors, ${vulnerabilities.records.length} vulnerabilities`,
  );
}

const server = new McpServer(
  { name: "vulnerability-registry", version: "1.0.0" },
  {
    capabilities: { logging: {} },
    instructions:
      "This server exposes a vulnerability registry database. " +
      "Use list_vendors to discover available vendors. " +
      "Use search_vulnerabilities to filter CVEs by severity, status, vendor, date range, or keyword. " +
      "Use get_vulnerability to get full details on a specific CVE. " +
      "Use get_statistics for aggregate summaries.",
  },
);

server.registerTool(
  "ping",
  {
    description: "Health check tool. Returns pong if server is alive.",
    inputSchema: z.object({}),
  },
  async () => {
    return {
      content: [
        {
          type: "text",
          text: "pong 🟢 server is alive",
        },
      ],
    };
  },
);

async function main() {
  loadData();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Vulnerability Registry MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
