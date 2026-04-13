import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

async function main() {
  const server = new Server(
    {
      name: "vuln-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "ping",
        description: "Test MCP connection",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name === "ping") {
      return {
        content: [{ type: "text", text: "pong ✅ MCP works" }],
      };
    }

    throw new Error("Unknown tool");
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
