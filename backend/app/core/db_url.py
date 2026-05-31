from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# libpq-style query params that asyncpg does NOT accept through SQLAlchemy's URL.
# Managed Postgres providers (Neon, Supabase, etc.) routinely append these, so we
# strip them from the URL and translate SSL intent into asyncpg connect_args.
_SSL_ENABLE = {"require", "verify-ca", "verify-full", "prefer", "allow", "true", "1"}
_SSL_DISABLE = {"disable", "false", "0"}


def normalize_asyncpg_url(url: str) -> tuple[str, dict]:
    """Return (clean_url, connect_args) safe for create_async_engine with asyncpg.

    - Ensures the +asyncpg driver is present.
    - Removes ``sslmode`` / ``ssl`` / ``channel_binding`` query params (asyncpg via
      SQLAlchemy rejects them) and converts SSL intent to ``connect_args={"ssl": ...}``.
    """
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)

    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))

    sslmode = query.pop("sslmode", None)
    ssl_param = query.pop("ssl", None)
    query.pop("channel_binding", None)  # asyncpg doesn't take this via the DSN

    connect_args: dict = {}
    raw = (sslmode or ssl_param or "").lower()
    if raw in _SSL_ENABLE:
        connect_args["ssl"] = True
    elif raw in _SSL_DISABLE:
        connect_args["ssl"] = False

    # Pooled endpoints (Neon "-pooler", Supabase pgbouncer) run PgBouncer in
    # transaction mode, which is incompatible with asyncpg's prepared-statement
    # cache. Disable it to avoid "prepared statement ... already exists" errors.
    if "-pooler" in parts.netloc or "pgbouncer" in parts.netloc:
        connect_args["statement_cache_size"] = 0

    clean = urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
    )
    return clean, connect_args
