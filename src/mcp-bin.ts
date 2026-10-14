#!/usr/bin/env node
import { startMcp } from "./mcp.js";
startMcp().catch((error: unknown) => { console.error(error); process.exit(1); });
