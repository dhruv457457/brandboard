@AGENTS.md

## Claude-specific notes

- Claude owns everything: `contracts/`, `packages/`, `apps/web/`, `supabase/`. Antigravity only works on tasks explicitly assigned in `docs/requests.md`.
- After any contract change: run `forge test`, then regenerate ABIs into `packages/shared` and update `docs/contracts.md` if the external API changed.
