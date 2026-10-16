# agentic-consent

agentic-consent keeps a local opt-in consent ledger for email, SMS, phone, chat, and mail. It supports Mailchimp, Twilio, and Intercom live adapters for consent, CASL records, unsubscribe, and STOP workflows. The default command is a dry run. It exits 0 and never uses the network.

One core. Three faces: CLI, npm library, and MCP server. The local file store needs no vendor.

## Install

```sh
npm install agentic-consent
```

## Quick start

Preview a consent record. This does not write or use the network.

```sh
npx agentic-consent grant --contact ada@example.com --channel email
```

Use `--live` to write to the local ledger.

```sh
npx agentic-consent grant --contact ada@example.com --channel email --live
npx agentic-consent check --contact ada@example.com --channel email
npx agentic-consent revoke --contact ada@example.com --channel email --live
```

Channels are `email`, `sms`, `phone`, `chat`, and `mail`.

## Live vendors

Pass `--live` only when you intend to call a vendor. Set the listed environment key. These are live HTTPS commands.

| Brand | Environment key | Live command |
| --- | --- | --- |
| Mailchimp | `AGENTIC_CONSENT_API_KEY` | `agentic-consent grant --contact ada@example.com --channel email --live --endpoint https://us1.api.mailchimp.com/3.0` |
| Twilio | `AGENTIC_CONSENT_API_KEY` | `agentic-consent revoke --contact +15551234567 --channel sms --live --endpoint https://messaging.twilio.com` |
| Intercom | `AGENTIC_CONSENT_API_KEY` | `agentic-consent grant --contact ada@example.com --channel chat --live --endpoint https://api.intercom.io` |

Use the library adapters for their vendor-specific API paths. Mailchimp manages email opt-in and unsubscribe. Twilio supports SMS STOP records. Intercom stores chat consent attributes.

## Three uses

### CLI

```sh
agentic-consent check --contact +15551234567 --channel sms
```

Pass `--store ./consent.json` to choose the local file. A vendor is only used with `--endpoint` and `--live`. Set `AGENTIC_CONSENT_API_KEY` or pass `--api-key`.

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

Discover `grant_consent`, `check_consent`, and `revoke_consent`. The MCP tools return the same JSON shapes as the CLI and library.
