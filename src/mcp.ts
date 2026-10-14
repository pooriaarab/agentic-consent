import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkConsent, grantConsent, revokeConsent, type ConsentStore, type VendorConsentAdapter } from "./core.js";
import { VERSION } from "./version.js";
const shape = { contact: z.string(), channel: z.enum(["email", "sms", "phone", "chat", "mail"]), source: z.string().optional() };
const result = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
export function createMcpServer(deps: { store?: ConsentStore; vendor?: VendorConsentAdapter } = {}) {
 const server = new McpServer({ name: "agentic-consent", version: VERSION });
 server.registerTool("grant_consent", { description: "Record consent. Dry run is the default.", inputSchema: { ...shape, live: z.boolean().optional() } }, async ({ live, ...input }) => result(await grantConsent(input, { ...deps, dryRun: !live })));
 server.registerTool("check_consent", { description: "Check consent for a contact and channel.", inputSchema: shape }, async (input) => result(await checkConsent(input, deps)));
 server.registerTool("revoke_consent", { description: "Revoke consent. Dry run is the default.", inputSchema: { ...shape, live: z.boolean().optional() } }, async ({ live, ...input }) => result(await revokeConsent(input, { ...deps, dryRun: !live })));
 return server;
}
export async function startMcp(): Promise<void> { const server = createMcpServer(); await server.connect(new StdioServerTransport()); }
