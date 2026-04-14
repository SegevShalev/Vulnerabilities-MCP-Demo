import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseDbFile, ParsedFile } from "./parser.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = resolve(__dirname, "..");

let vendors: ParsedFile;
let vulnerabilities: ParsedFile;

function matchesText(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.toLowerCase());
}

function getVendorName(vendorId: string): string | undefined {
  return vendors.records.find((v) => v.id === vendorId)?.name;
}

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

//ping mcp
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
          text: "pong ✅ MCP works",
        },
      ],
    };
  },
);

//list vendors
server.registerTool(
  "list_vendors",
  {
    description:
      "List all software vendors in the registry. Optionally filter by name or category.",
    inputSchema: z.object({
      name: z
        .string()
        .optional()
        .describe("Filter vendors whose name contains this text"),

      category: z
        .string()
        .optional()
        .describe('Filter by category (e.g. "Software", "Open Source")'),
    }),
  },
  async ({ name, category }) => {
    let results = vendors.records;

    if (name) {
      results = results.filter((v) => matchesText(v.name, name));
    }

    if (category) {
      results = results.filter((v) => matchesText(v.category, category));
    }

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No vendors found matching the given criteria.",
          },
        ],
      };
    }

    const formatted = results
      .map(
        (v) =>
          `• [${v.id}] ${v.name} — Category: ${v.category}, HQ: ${v.hq}, Founded: ${v.founded}`,
      )
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: `Found ${results.length} vendor(s):\n\n${formatted}`,
        },
      ],
    };
  },
);

//search vulnerabilities
server.registerTool(
  "search_vulnerabilities",
  {
    description:
      "Search and filter vulnerabilities. Supports filtering by severity, status, vendor, CVSS score range, date range, and keyword search across CVE ID and title.",

    inputSchema: z.object({
      keyword: z
        .string()
        .optional()
        .describe("Search keyword — matches CVE ID, title, affected versions"),

      severity: z
        .string()
        .optional()
        .describe("critical | high | medium | low"),

      status: z.string().optional().describe("open | patched"),

      vendor_id: z.string().optional().describe("Vendor ID or vendor name"),

      min_cvss: z.number().optional(),
      max_cvss: z.number().optional(),

      published_after: z.string().optional(),
      published_before: z.string().optional(),
    }),
  },

  async ({
    keyword,
    severity,
    status,
    vendor_id,
    min_cvss,
    max_cvss,
    published_after,
    published_before,
  }) => {
    let results = vulnerabilities.records;

    if (keyword) {
      results = results.filter(
        (v) =>
          matchesText(v.cve_id, keyword) ||
          matchesText(v.title, keyword) ||
          matchesText(v.affected_versions, keyword),
      );
    }

    if (severity) {
      results = results.filter(
        (v) => v.severity.toLowerCase() === severity.toLowerCase(),
      );
    }

    if (status) {
      results = results.filter(
        (v) => v.status.toLowerCase() === status.toLowerCase(),
      );
    }

    if (vendor_id) {
      const vendor =
        vendors.records.find(
          (v) => v.id.toLowerCase() === vendor_id.toLowerCase(),
        ) || vendors.records.find((v) => matchesText(v.name, vendor_id));

      if (!vendor) {
        return {
          content: [{ type: "text", text: `Vendor "${vendor_id}" not found.` }],
        };
      }

      results = results.filter((v) => v.vendor_id === vendor.id);
    }

    if (min_cvss !== undefined) {
      results = results.filter((v) => parseFloat(v.cvss_score) >= min_cvss);
    }

    if (max_cvss !== undefined) {
      results = results.filter((v) => parseFloat(v.cvss_score) <= max_cvss);
    }

    if (published_after) {
      const after = new Date(published_after);
      results = results.filter((v) => new Date(v.published) >= after);
    }

    if (published_before) {
      const before = new Date(published_before);
      results = results.filter((v) => new Date(v.published) <= before);
    }

    if (!results.length) {
      return {
        content: [
          {
            type: "text",
            text: "No vulnerabilities found matching the given criteria.",
          },
        ],
      };
    }

    const formatted = results
      .map((v) => {
        const vendorName = getVendorName(v.vendor_id) ?? v.vendor_id;

        return `* [${v.cve_id}] ${v.title}
Vendor: ${vendorName} | Severity: ${v.severity} | CVSS: ${v.cvss_score} | Status: ${v.status} | Published: ${v.published}`;
      })
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: `Found ${results.length} vulnerability(ies):\n\n${formatted}`,
        },
      ],
    };
  },
);

//get vulnerability
server.registerTool(
  "get_vulnerability",
  {
    description: "Get full details for a specific vulnerability by CVE ID",

    inputSchema: z.object({
      cve_id: z.string().describe('The CVE identifier (e.g. "CVE-2021-44228")'),
    }),
  },

  async ({ cve_id }) => {
    const vuln = vulnerabilities.records.find(
      (v) => v.cve_id.toLowerCase() === cve_id.toLowerCase(),
    );

    if (!vuln) {
      return {
        content: [
          {
            type: "text",
            text: `Vulnerability "${cve_id}" not found.`,
          },
        ],
      };
    }

    const vendorName = getVendorName(vuln.vendor_id) ?? vuln.vendor_id;

    const text = [
      `CVE ID: ${vuln.cve_id}`,
      `Title: ${vuln.title}`,
      `Vendor: ${vendorName} (${vuln.vendor_id})`,
      `Severity: ${vuln.severity}`,
      `CVSS Score: ${vuln.cvss_score}`,
      `Affected Versions: ${vuln.affected_versions}`,
      `Status: ${vuln.status}`,
      `Published: ${vuln.published}`,
    ].join("\n");

    return { content: [{ type: "text", text }] };
  },
);

//get stats
server.registerTool(
  "get_statistics",
  {
    description: "Get aggregate statistics about the vulnerability registry",

    inputSchema: z.object({}),
  },

  async () => {
    const total = vulnerabilities.records.length;

    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byVendor: Record<
      string,
      { total: number; open: number; critical: number }
    > = {};

    for (const v of vulnerabilities.records) {
      bySeverity[v.severity] = (bySeverity[v.severity] ?? 0) + 1;
      byStatus[v.status] = (byStatus[v.status] ?? 0) + 1;

      const vendorName = getVendorName(v.vendor_id) ?? v.vendor_id;

      if (!byVendor[vendorName]) {
        byVendor[vendorName] = { total: 0, open: 0, critical: 0 };
      }

      byVendor[vendorName].total++;
      if (v.status === "open") byVendor[vendorName].open++;
      if (v.severity === "critical") byVendor[vendorName].critical++;
    }

    const text = [
      `Total vulnerabilities: ${total}`,
      `Total vendors: ${vendors.records.length}`,
      "",
      "By severity:",
      Object.entries(bySeverity)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join("\n"),
      "",
      "By status:",
      Object.entries(byStatus)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join("\n"),
      "",
      "By vendor:",
      Object.entries(byVendor)
        .map(
          ([name, stats]) =>
            `  ${name}: ${stats.total} total, ${stats.open} open, ${stats.critical} critical`,
        )
        .join("\n"),
    ].join("\n");

    return { content: [{ type: "text", text }] };
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
