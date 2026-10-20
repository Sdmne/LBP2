"""UTC deadlines and retained profile settings for account deletion."""
from datetime import datetime, timedelta, timezone

TRASH_STATUSES = frozenset({"DELETION_PENDING", "PENDING_DELETION", "DELETED"})
VISIBILITY_FIELDS = ("visibleInCatalog", "isVisibleInCatalog")


def utc_datetime(value):
    try:
        result = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return result.replace(tzinfo=timezone.utc) if result.tzinfo is None else result.astimezone(timezone.utc)
    except (ValueError, TypeError, OverflowError):
        return None


def deletion_deadline(data, days=30):
    requested = utc_datetime(data.get("requestedAt"))
    stored = utc_datetime(data.get("deleteAfter"))
    if not requested or not stored:
        return None
    return min(stored, requested + timedelta(days=days))


def can_restore_account(status, request_status, data, now):
    deadline = deletion_deadline(data)
    current = utc_datetime(now)
    return str(status).upper() in TRASH_STATUSES and request_status == "PENDING" and deadline is not None and current is not None and current < deadline


def restored_profile_data(current, retained, email, restored_at):
    result = dict(current)
    for key in ("deletionRequestedAt", "deletionScheduledFor", "deletionReason", "deletedAt", "isDeleted", "deleted", *VISIBILITY_FIELDS):
        result.pop(key, None)
    result.update({key: retained[key] for key in VISIBILITY_FIELDS if key in retained})
    result.update(email=email, deletionRestoredAt=restored_at, restoredAt=restored_at)
    return result
