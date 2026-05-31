from __future__ import annotations

import re
from typing import Annotated

from email_validator import EmailNotValidError, validate_email
from pydantic import AfterValidator

_BASIC_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_email(value: str) -> str:
    """Validate + normalize an email.

    Like Pydantic's EmailStr, but tolerant of RFC 6761 special-use TLDs
    (.test / .example / .localhost / .invalid). The app's demo accounts use
    ``@acme.test``; stock EmailStr rejects those both on input and when
    serializing stored users, which would make the demo unusable.
    """
    v = value.strip()
    try:
        result = validate_email(v, check_deliverability=False)
        return getattr(result, "normalized", None) or result.email
    except EmailNotValidError as exc:
        msg = str(exc).lower()
        if ("special-use" in msg or "reserved" in msg) and _BASIC_EMAIL.match(v):
            return v.lower()
        raise ValueError(str(exc)) from exc


# Drop-in replacement for pydantic.EmailStr used across request/response schemas.
Email = Annotated[str, AfterValidator(_normalize_email)]
