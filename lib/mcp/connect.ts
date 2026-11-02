/**
 * Connect commands for each AI client (step 6). Pure. The base URL comes
 * from NEXT_PUBLIC_APP_URL; server names carry the strategy name so
 * several strategies can be connected at once.
 */
export type ConnectClient = "claude-code" | "claude" | "cursor" | "vscode" | "codex" | "chatgpt";

export const CONNECT_CLIENTS: { id: ConnectClient; label: string }[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "claude", label: "Claude" },
  { id: "cursor", label: "Cursor" },
  { id: "vscode", label: "VS Code" },
  { id: "codex", label: "Codex" },
  { id: "chatgpt", label: "ChatGPT" },
];

/** "studio" for the account server, "studio-<slug>" for a strategy's. */
export function serverAlias(strategyName?: string | null, strategyId?: string | null): string {
  if (!strategyId) return "studio";
  const slug = (strategyName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/, "");
  return slug ? `studio-${slug}` : `studio-${strategyId.slice(0, 8)}`;
}

export function serverPath(strategyId?: string | null): string {
  return strategyId ? `/mcp/s/${strategyId}` : "/mcp";
}

export interface ConnectInstruction {
  client: ConnectClient;
  /** A shell command or a URL to copy, when there is one. */
  copy: string | null;
  /** Whether `copy` is a link to open rather than a command. */
  isLink: boolean;
  steps: string[];
}

export function connectInstructions(baseUrl: string, alias: string, path: string): ConnectInstruction[] {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const cursorConfig = typeof btoa === "function" ? btoa(JSON.stringify({ url })) : Buffer.from(JSON.stringify({ url })).toString("base64");
  return [
    {
      client: "claude-code",
      copy: `claude mcp add --transport http ${alias} ${url} -s user`,
      isLink: false,
      steps: ["Run the command in a terminal.", "In Claude Code type /mcp, pick the server and Authenticate.", "Approve in the browser with your Studio account."],
    },
    {
      client: "claude",
      copy: url,
      isLink: false,
      steps: ["Open Settings, Connectors, Add custom connector.", `Name it ${alias} and paste the URL.`, "Choose sign in now and approve in the browser."],
    },
    {
      client: "cursor",
      copy: `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(alias)}&config=${encodeURIComponent(cursorConfig)}`,
      isLink: true,
      steps: ["Open the link; Cursor asks to install the server.", "Click the server in Settings, MCP, then Sign in and approve."],
    },
    {
      client: "vscode",
      copy: `code --add-mcp '${JSON.stringify({ name: alias, type: "http", url })}'`,
      isLink: false,
      steps: ["Run the command, or add the same entry to mcp.json.", "Start the server from the MCP panel and approve in the browser."],
    },
    {
      client: "codex",
      copy: `codex mcp add ${alias} --url ${url}`,
      isLink: false,
      steps: ["Run the command.", `Then run: codex mcp login ${alias}`, "Approve in the browser."],
    },
    {
      client: "chatgpt",
      copy: url,
      isLink: false,
      steps: ["In ChatGPT open Plugins, then Add custom MCP server.", `Name it ${alias}, paste the URL, choose OAuth.`, "Approve in the browser. Custom servers need a Pro, Business or Enterprise plan."],
    },
  ];
}
