# Supabase support question — operator draft, not sent

Status: UNSENT. No execution or configuration change is requested by this artifact.

Subject: Managed Supavisor session-pooler upstream security and maintenance contract

For a client connecting with `sslmode=verify-full` to Supabase’s Supavisor session pooler, what transport/security controls protect the Supavisor-to-project-Postgres upstream connection?

Our historical records show client TLSv1.3 with successful hostname/CA verification, while the PostgreSQL backend reports `pg_stat_ssl.ssl=false`. We understand these describe different hops; we are not treating client TLS as proof of upstream protection.

Please confirm for the project identified privately in the support portal:

1. Is the upstream PostgreSQL transport TLS or non-TLS? If TLS, how are the backend certificate and hostname verified? If PostgreSQL TLS is absent, what other confidentiality/integrity protection, if any, covers that hop?
2. What private-network/infrastructure boundaries, access controls and authentication protect it, and how is tenant/project routing isolated? Please distinguish guarantees from configurable options.
3. Is backend `pg_stat_ssl=false` expected in this managed architecture? How does that observation map to your published network-encryption assurances?
4. Is session pooling supported for one-session transactional DDL plus a migration-ledger insert and transaction-scoped advisory lock? Are there relevant failover or session-timeout limitations?
5. Is an RR READ ONLY exporter plus separate `pg_dump --snapshot` clients and `pg_dumpall --roles-only --no-role-passwords` supported? Do all connections reach the same primary, and what capacity/timeout conditions apply while the exporter stays open?
6. Please provide an applicable official architecture/security reference or attributable written confirmation, including the service/version scope of the answer.

Safe context: shared session endpoint, port 5432; pinned PostgreSQL 17 client; no current connection or retry performed for this inquiry. The operator may supply the project reference privately. Do not attach passwords, connection URIs, service keys, tokens, cookies, private keys, raw SQL/ledger statements or database dumps.

This draft does not authorize sending a message, resetting a password, changing SSL enforcement, enabling an add-on, running a probe, or retrying capture.
