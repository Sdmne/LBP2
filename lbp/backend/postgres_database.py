"""PostgreSQL access layer with a narrow compatibility bridge for legacy MySQL SQL.

The application uses DB-API ``%s`` parameters throughout, which psycopg also
supports.  The translator is deliberately limited to the MySQL constructs
present in the application; new SQL must be written in PostgreSQL syntax.
"""

from __future__ import annotations

import re
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row


UPSERT_CONFLICT_COLUMNS = {
    "app_entities": "entity_type, source_key",
    "conversations": "profile_a_id, profile_b_id",
    "profile_matches": "profile_a_id, profile_b_id",
    "profile_likes": "actor_profile_id, target_profile_id",
    "profile_blocks": "blocker_profile_id, blocked_profile_id",
    "media_files": "storage_key",
    "conversation_hidden": "conversation_id, profile_id",
}


def translate_sql(statement: str) -> str:
    """Translate the legacy MySQL subset used by the FastAPI service."""
    sql = statement.strip()
    sql = re.sub(r"`([^`]+)`", r"\1", sql)
    # MySQL preserves the spelling of unquoted result aliases, while
    # PostgreSQL folds them to lowercase. The legacy API exposes camelCase
    # aliases directly as JSON keys, so quote only mixed-case aliases before
    # the statement reaches psycopg. SQL type names such as JSONB and CHAR do
    # not match this lower-leading mixed-case pattern.
    sql = re.sub(r"\bAS\s+([a-z_][A-Za-z0-9_]*[A-Z][A-Za-z0-9_]*)\b", r'AS "\1"', sql)
    sql = re.sub(r"\bUTC_TIMESTAMP\(\)", "(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')", sql, flags=re.I)
    sql = re.sub(r"\bUTC_DATE\(\)", "CURRENT_DATE", sql, flags=re.I)
    sql = re.sub(r"\bCAST\((.*?)\s+AS\s+UNSIGNED\)", r"CAST(\1 AS INTEGER)", sql, flags=re.I | re.S)
    sql = re.sub(r"\bCAST\((.*?)\s+AS\s+CHAR\)", r"CAST(\1 AS TEXT)", sql, flags=re.I | re.S)
    sql = re.sub(r"\bCAST\((.*?)\s+AS\s+CHARACTER\)", r"CAST(\1 AS TEXT)", sql, flags=re.I | re.S)
    sql = re.sub(r"\bCAST\((.*?)\s+AS\s+CHAR\s*\)", r"CAST(\1 AS TEXT)", sql, flags=re.I | re.S)
    sql = re.sub(r"\bIFNULL\(", "COALESCE(", sql, flags=re.I)
    sql = re.sub(r"\bJSON_OBJECT\(", "jsonb_build_object(", sql, flags=re.I)
    sql = re.sub(r"\bJSON_ARRAY\(", "jsonb_build_array(", sql, flags=re.I)
    sql = re.sub(r"\s+REGEXP\s+", " ~ ", sql, flags=re.I)
    sql = re.sub(r"\bSTR_TO_DATE\((.*?),\s*'%Y-%m-%d'\)", r"TO_DATE(\1, 'YYYY-MM-DD')", sql, flags=re.I)
    sql = re.sub(r"\bDATE_FORMAT\((.*?),\s*'%Y-%m-%d'\)", r"TO_CHAR(\1, 'YYYY-MM-DD')", sql, flags=re.I)
    sql = re.sub(
        r"\bDATE_SUB\(\s*CURRENT_DATE\s*,\s*INTERVAL\s+(\d+)\s+YEAR\s*\)",
        lambda match: f"(CURRENT_DATE - INTERVAL '{match.group(1)} years')",
        sql,
        flags=re.I,
    )
    sql = re.sub(
        r"\bDATE_SUB\(\s*\(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'\)\s*,\s*INTERVAL\s+%s\s+SECOND\s*\)",
        "((CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - make_interval(secs => %s))",
        sql,
        flags=re.I,
    )
    # MySQL accepts bare interval quantities (``INTERVAL 30 DAY``) and
    # parameterized quantities (``INTERVAL %s SECOND``). PostgreSQL needs an
    # interval literal for constants and ``make_interval`` for parameters.
    # Do the parameterized variants first so the following literal conversion
    # cannot turn a placeholder into part of a quoted string.
    interval_units = {
        "SECOND": "secs",
        "MINUTE": "mins",
        "HOUR": "hours",
        "DAY": "days",
        "MONTH": "months",
        "YEAR": "years",
    }
    for mysql_unit, pg_argument in interval_units.items():
        sql = re.sub(
            rf"\bINTERVAL\s+%s\s+{mysql_unit}\b",
            f"make_interval({pg_argument} => %s)",
            sql,
            flags=re.I,
        )
    sql = re.sub(
        r"\bINTERVAL\s+(\d+)\s+(SECOND|MINUTE|HOUR|DAY|MONTH|YEAR)\b",
        lambda match: f"INTERVAL '{match.group(1)} {match.group(2).lower()}'",
        sql,
        flags=re.I,
    )
    sql = re.sub(r"\bINSERT\s+IGNORE\s+INTO\b", "INSERT INTO", sql, flags=re.I)
    ignored_insert = bool(re.match(r"^INSERT\s+INTO\b", sql, flags=re.I)) and "INSERT IGNORE" in statement.upper()

    if "ON DUPLICATE KEY UPDATE" in sql.upper():
        table_match = re.search(r"\bINSERT\s+INTO\s+([a-z_]+)", sql, flags=re.I)
        table = table_match.group(1).lower() if table_match else ""
        conflict_columns = UPSERT_CONFLICT_COLUMNS.get(table)
        if not conflict_columns:
            raise ValueError(f"PostgreSQL conflict target is not configured for {table or 'this INSERT'}")
        sql = re.sub(
            r"\bON\s+DUPLICATE\s+KEY\s+UPDATE\b",
            f"ON CONFLICT ({conflict_columns}) DO UPDATE SET",
            sql,
            flags=re.I,
        )
        sql = re.sub(r"\bVALUES\(([^)]+)\)", r"EXCLUDED.\1", sql, flags=re.I)
        if table == "conversations":
            sql = sql.replace("COALESCE(EXCLUDED.match_id, match_id)", "COALESCE(EXCLUDED.match_id, conversations.match_id)")
        if table == "profile_likes":
            sql = sql.replace(
                "IF(status = 'ACTIVE', created_at, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))",
                "CASE WHEN profile_likes.status = 'ACTIVE' THEN profile_likes.created_at ELSE (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') END",
            )
        if table == "app_entities":
            sql = re.sub(r"updated_at\s*=\s*updated_at", "updated_at = app_entities.updated_at", sql, flags=re.I)
    elif ignored_insert:
        sql = f"{sql.rstrip(';')} ON CONFLICT DO NOTHING"

    return sql


class PostgreSQLCursor:
    def __init__(self, cursor: Any):
        self._cursor = cursor
        self.lastrowid: int | None = None

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount

    def execute(self, statement: str, params: Any = None):
        sql = translate_sql(statement)
        insert = bool(re.match(r"^INSERT\s+INTO\b", sql, flags=re.I))
        needs_identity = (
            insert
            and " RETURNING " not in sql.upper()
            and "ON CONFLICT DO NOTHING" not in sql.upper()
        )
        if needs_identity:
            sql = f"{sql.rstrip(';')} RETURNING id"
        self._cursor.execute(sql, params)
        self.lastrowid = None
        if needs_identity:
            row = self._cursor.fetchone()
            if row and row.get("id") is not None:
                self.lastrowid = int(row["id"])
        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def close(self) -> None:
        self._cursor.close()


class PostgreSQLConnection:
    def __init__(self, connection: psycopg.Connection[Any]):
        self._connection = connection

    def cursor(self, dictionary: bool = True) -> PostgreSQLCursor:
        del dictionary
        return PostgreSQLCursor(self._connection.cursor(row_factory=dict_row))

    def commit(self) -> None:
        self._connection.commit()

    def rollback(self) -> None:
        self._connection.rollback()

    def close(self) -> None:
        self._connection.close()


@contextmanager
def postgres_cursor(config: dict[str, Any]) -> Iterator[tuple[PostgreSQLConnection, PostgreSQLCursor]]:
    connect_config = dict(config)
    # mysql-connector called this setting ``database``; psycopg calls it
    # ``dbname``. Keep the app-level configuration stable during migration.
    if "database" in connect_config:
        connect_config["dbname"] = connect_config.pop("database")
    connection = PostgreSQLConnection(psycopg.connect(**connect_config))
    cursor = connection.cursor()
    try:
        yield connection, cursor
    finally:
        cursor.close()
        connection.close()
