@AGENTS.md

## Claude-specific notes

- Claude owns `contracts/`, `packages/shared/` and `services/indexer/`. Do not edit `apps/web/` unless the user asks; leave requests in `docs/requests.md`.
- After any contract change: run `forge test`, then regenerate ABIs into `packages/shared` and update `docs/contracts.md` if the external API changed.
