# R5D read-only acceptance helper

`acceptance.py` is a fixed acceptance observer, not an execution runner. It uses
only READ ONLY PostgreSQL catalog/count queries, `pm2 jlist`, Tailscale status,
local file hashing and anonymous HTTP GET/HEAD. No production write RPC, Agent
POST, Provider request, process control, artifact replacement or backup exists
in this helper.

The helper consumes the recorded observation budget in
`/tmp/uply-r5d-observation.json` and stops at its deadline. It compares current
state with immutable R5C evidence and locked migration sources. Full SQL is
compared in memory; only safe metadata is published. `catalog_contract.py`
contains the static R5B source-derived catalog assertions. The transport uses
an ephemeral private credential mount, TLS verify-full and
`default_transaction_read_only=on`; it has no arbitrary-SQL command-line input.

`--seal-only` performs no production observation: it seals the already completed
acceptance evidence under the authorized private operations path. This option
was used after the filesystem sandbox blocked the initial private receipt
creation. It still enforces the original observation deadline and exclusive
receipt creation. Private receipt writes require filesystem permission, not a
new production-change authorization. The receipt seals observation evidence;
subsequent report/gates/workspace validation have separate evidence files.

Historical R5C state is never rewritten. The original observation authorization
is not reusable as a production maintenance grant. Do not rerun or extend the
budget to imply a new authorization. No deployment or migration CLI is exposed.
