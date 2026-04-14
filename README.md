# Vulnerabilities-MCP-Demo

This project is a local MCP (Model Context Protocol) server that exposes tools for searching and working with a vulnerability dataset

The server is built using Node.js and TypeScript and is designed to run via stdio transport for integration with MCP Inspector or compatible clients.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

#### Setup

```bash
npm install
```

```bash
npm build
```

```bash
npm start
```

#### 2. MCP JSON Config

Add the following configuration to your MCP client (e.g. Cursor / MCP Inspector):

```json
{
  "mcpServers": {
    "vuln-server": {
      "command": "node",
      "args": ["<path to folder>/dist/server.js"]
    }
  },
  "preferences": {
    "coworkScheduledTasksEnabled": false,
    "ccdScheduledTasksEnabled": false,
    "coworkWebSearchEnabled": true,
    "sidebarMode": "chat"
  }
}
```

Might need to restart your MCP client and allowing it to use tools.

## 🧰 MCP Tools

This server exposes a vulnerability registry through the Model Context Protocol.

Tools are designed to be used both directly (via MCP Inspector) and naturally via LLM interaction.

---

### 1. `ping`

Health check tool.

**Returns:**

- `pong` if the server is running correctly

---

### 2. `list_vendors`

Returns all vendors in the registry.

**Supports optional filtering:**

- by name
- by category

**Example usage (natural language):**

- "list all vendors"
- "show me open source vendors"
- "find vendors with 'Microsoft' in the name"

---

### 3. `search_vulnerabilities`

Search vulnerabilities using flexible filters.

Supports:

- keyword search (CVE ID, title, affected versions)
- severity filter (critical / high / medium / low)
- status filter (open / patched)
- vendor filtering (by ID or name)
- CVSS score range
- publication date range

**Example usage:**

- "show high severity vulnerabilities in Apache"
- "find CVEs related to SQL injection"
- "list open vulnerabilities with CVSS above 8"

---

### 4. `get_vulnerability`

Fetch full details for a specific CVE ID.

**Example usage:**

- "get details for CVE-2021-44228"
- "what is CVE-2023-xxxx?"

---

### 5. `get_statistics`

Returns aggregated insights about the dataset.

Includes:

- total vulnerabilities
- breakdown by severity
- breakdown by status
- per-vendor summary (open / critical counts)

**Example usage:**

- "show vulnerability statistics"
- "give me a security overview of the dataset"

## ⚙️ Design Decisions

### 1. MCP-first tool design

Each capability is implemented as a standalone MCP tool, aligning with the MCP model of:

> tool = isolated capability with schema + handler

This naturally maps to a **command-style architecture**, where each tool represents a single action on the dataset.

---

### 2. Minimal architecture (time-driven decision)

The project uses a simple one time in-memory dataset loaded at startup.

This decision prioritizes:

- fast development
- predictable behavior in MCP Inspector
- easy debugging

---

### 3. Stateless runtime model

The server is stateless:

- data is loaded at startup
- no runtime mutation persistence
- no external dependencies

This makes execution deterministic and safe for LLM tool use.

---

### 4. Natural language compatibility

Although tools use strict schemas internally, they are designed to be triggered through natural language via Claude / MCP clients.

This is why tool descriptions emphasize intent rather than strict API contracts.

---

The current implementation focuses on clarity and a minimal, working MCP integration. Given more time, I would evolve it in a few natural directions that reflect production-grade design decisions.

First, I would further refine the project structure beyond the current separation of store, tools, and utils. This separation will improve maintainability and clarity, Given the time constraints and the decision to work with MCP Inspector for faster iteration, the current structure was chosen as a pragmatic balance between simplicity and organization.

On the data layer, I would add hot-reload support for the database files, allowing the MCP server to detect changes in the underlying .db files without requiring a full restart. This would make the system more suitable for real-time analyst workflows.

On the tool design side, I would expand the current set of tools with higher-level analytical capabilities, such as a security overview tool that aggregates vulnerability data across vendors and provides a system-wide risk snapshot. In addition, I would consider adding a capability discovery tool, allowing the LLM to understand what types of questions it can ask the system and how to best interact with it.

Overall, these improvements represent natural extensions of the current design rather than changes to its core approach, which intentionally prioritizes simplicity and correctness within the given time constraints.
