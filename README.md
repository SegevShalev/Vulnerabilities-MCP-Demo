# Vulnerabilities-MCP-Demo

This project is a local MCP (Model Context Protocol) server that exposes tools for searching and working with a vulnerability dataset

The server is built using Node.js and TypeScript and is designed to run via stdio transport for integration with MCP compatible clients or MCP Inspector

## 🔧 Architecture

load files → parse metadata → build in-memory indexes → expose MCP tools

## 🚀 Getting Started

### Prerequisites

- Node.js 18+

- npm or yarn

#### Setup

```bash
npm  install
```

```bash
npm  build
```

```bash
npm  start
```

#### MCP JSON Config

Add the following configuration to your MCP client configuration

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

#### Agent Layer

Or you can also use CLI agent, using Llama model

```bash
cd  agent
```

```bash
npm  install
```

```bash
npm  build
```

```bash
npm  start
```

## 🧰 MCP Tools

This server exposes a vulnerability registry through the Model Context Protocol.

Tools are designed to be used both directly and naturally via LLM interaction.

---

### 1. `ping`

MCP server Health check tool.

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

### 1. MCP standalone tool design

Each capability is implemented as a standalone MCP tool, aligning with the MCP model of:

> tool = isolated capability with schema + handler

This naturally maps to a **command-style architecture**, where each tool represents a single action on the dataset.

---

### 2. Minimal architecture

The project uses a simple one time in-memory dataset loaded at startup.

This decision prioritizes:

- reduces repeated disk I/O

- keeps tool latency predictable as the dataset grows

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

Overall, these improvements represent natural extensions of the current design rather than changes to its core approach, which intentionally prioritizes simplicity and correctness within the given time constraints.
