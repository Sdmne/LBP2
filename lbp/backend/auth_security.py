import hashlib
import hmac
import secrets

try:
    import bcrypt
except ImportError:  # pragma: no cover
    bcrypt = None


PASSWORD_ITERATIONS = 210_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    if not encoded:
        return False
    if encoded.startswith(("$2a$", "$2b$", "$2y$")):
        if bcrypt is None:
            return False
        bcrypt_hash = encoded
        if bcrypt_hash.startswith("$2y$"):
            bcrypt_hash = "$2b$" + bcrypt_hash[4:]
        try:
            return bcrypt.checkpw(password.encode("utf-8"), bcrypt_hash.encode("utf-8"))
        except ValueError:
            return False
    try:
        scheme, iterations, salt, digest = encoded.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations))
        return hmac.compare_digest(candidate.hex(), digest)
    except (ValueError, TypeError):
        return False


def password_needs_rehash(encoded: str) -> bool:
    if not encoded or encoded.startswith(("$2a$", "$2b$", "$2y$")):
        return True
    try:
        scheme, iterations, _, _ = encoded.split("$", 3)
        return scheme != "pbkdf2_sha256" or int(iterations) < PASSWORD_ITERATIONS
    except (ValueError, TypeError):
        return True


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
