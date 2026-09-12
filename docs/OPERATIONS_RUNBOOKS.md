# Operations Runbooks

## Purpose

This document provides operational procedures for diagnosing and responding
to common wallet-platform failures.

It complements `docs/INCIDENT_RESPONSE.md`.

These procedures are intended for local development and future production
adaptation. Production infrastructure, alert routing, credentials, and
recovery procedures must be defined before production use.

---

# Operational Safety Rules

Before troubleshooting:

- Do not place seed phrases, mnemonics, private keys, master keys, signing
  material, access tokens, refresh tokens, passwords, or API credentials into
  logs, tickets, screenshots, chat, or incident reports.
- Do not copy secret material into diagnostic commands.
- Do not disable authentication or security controls to make a failing
  operation succeed.
- Preserve relevant logs and timestamps before destructive remediation.
- Prefer read-only diagnostics before restarting or modifying state.
- Treat PostgreSQL as the authoritative application/ledger data store.
- Treat Valkey as ephemeral coordination/cache infrastructure.
- Never treat a client or client-optimistic transaction state as authoritative
  settlement.
- `provider` and `ledger` are the authoritative settlement sources.
- Signing failures must not be bypassed by moving private-key material into
  the backend or another untrusted process.
- Do not treat local development recovery procedures as production recovery
  procedures without explicit review.

---

# Observability Stack

Local operational components:

| Component  | Local endpoint           |
| ---------- | ------------------------ |
| API        | `http://127.0.0.1:3000`  |
| Prometheus | `http://127.0.0.1:9090`  |
| Grafana    | `http://127.0.0.1:3001`  |
| Loki       | `http://127.0.0.1:3100`  |
| Alloy      | `http://127.0.0.1:12345` |
| PostgreSQL | `127.0.0.1:5433`         |
| Valkey     | configured local port    |

The API exposes Prometheus metrics through port `9464`.

Useful API metrics include:

- `http_server_request_count_total`
- `http_server_request_error_count_total`
- `http_server_request_duration_bucket`

Prometheus alerts include:

- `CryptoWalletApiDown`
- `CryptoWalletApiHighErrorRate`
- `CryptoWalletApiHighLatency`

Grafana provides the local API operations dashboard and Loki-backed API
log visibility.

---

# General Diagnostic Sequence

Use this sequence before making a destructive change:

1. Confirm the symptom and approximate start time.
2. Check API health.
3. Check the relevant Prometheus target and alert state.
4. Inspect structured API logs through Grafana/Loki or the local log file.
5. Check the health of the affected dependency.
6. Determine whether the failure is transient, dependency-related, or
   application-state-related.
7. Prefer restarting only the affected local component.
8. Re-run health and observability checks after remediation.
9. Preserve relevant timestamps and error messages for incident records.
10. Never bypass security or signing boundaries to restore availability.

---

# Runbook: RPC Provider Outage

## Symptoms

Possible indicators:

- `CryptoWalletApiDown` or elevated API errors.
- RPC requests timing out or failing.
- Increased provider failure counts.
- Provider circuit state becomes `open`.
- Provider consistency checks report mismatched values.
- Transaction state cannot be authoritatively confirmed.

## Initial diagnosis

1. Check the API:

````powershell
curl.exe -s "http://127.0.0.1:3000/health"

2. Check the Prometheus target:

```powershell
curl.exe -s "http://127.0.0.1:9090/api/v1/targets"


Then **only verify the file and formatting**:

```powershell
(Get-Content docs/OPERATIONS_RUNBOOKS.md).Count
````
