from app.utils.position import STEP, compute_position


def test_empty_column_uses_step():
    assert compute_position(None, None) == STEP


def test_insert_at_end():
    assert compute_position(1024.0, None) == 1024.0 + STEP


def test_insert_at_start():
    assert compute_position(None, 1024.0) == 1024.0 - STEP


def test_insert_between_is_midpoint():
    assert compute_position(1000.0, 2000.0) == 1500.0


def test_midpoint_stays_strictly_between():
    before, after = 1024.0, 1025.0
    pos = compute_position(before, after)
    assert before < pos < after


def test_repeated_bisection_keeps_ordering():
    lo, hi = 0.0, 1024.0
    for _ in range(10):
        mid = compute_position(lo, hi)
        assert lo < mid < hi
        hi = mid  # keep inserting just after `lo`
