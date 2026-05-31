from __future__ import annotations

STEP = 1024.0


def compute_position(before: float | None, after: float | None) -> float:
    """Fractional-style positioning.

    Given the position of the task that should come BEFORE the new one and the position
    of the task that should come AFTER it, return a float in between.
    """
    if before is None and after is None:
        return STEP
    if before is None:
        # New first item — place before the current first
        return float(after) - STEP  # type: ignore[arg-type]
    if after is None:
        # New last item — place after the current last
        return float(before) + STEP
    return (float(before) + float(after)) / 2.0
