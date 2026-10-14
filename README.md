# agentic-consent

Record, check, and revoke consent for a contact and a channel.

One core. Three faces: a CLI, an npm library, and an MCP server. The local
file store needs no vendor. Dry run is the default.

## Install

```sh
npm install agentic-consent
```

## Quick start

Preview a consent record. This does not write anything.

```sh
npx agentic-consent grant --contact ada@example.com --channel email
```

Use `--live` to write to the local store.

```sh
npx agentic-consent grant --contact ada@example.com --channel email --live
npx agentic-consent check --contact ada@example.com --channel email
npx agentic-consent revoke --contact ada@example.com --channel email --live
```

Channels are `email`, `sms`, `phone`, `chat`, and `mail`.

## Three uses

### CLI

```sh
agentic-consent check --contact +15551234567 --channel sms
```

Pass `--store ./consent.json` to choose the local file. A vendor is only used
with `--endpoint` and `--live`. Set `AGENTIC_CONSENT_API_KEY` or pass
`--api-key`; missing keys and vendor errors are returned clearly.

### Library

```ts
import { grantConsent, checkConsent } from "agentic-consent";

await grantConsent({ contact: "ada@example.com", channel: "email" });
await checkConsent({ contact: "ada@example.com", channel: "email" });
```

### MCP

```sh
npx agentic-consent-mcp
```

Discover `grant_consent`, `check_consent`, and `revoke_consent`. The MCP tools
return the same JSON shapes as the CLI and library.
