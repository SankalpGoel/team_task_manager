from app.api.routes.ai import _parse_lines
from app.api.routes.comments import MENTION_RE
from app.utils.pagination import PageParams


def test_parse_lines_strips_bullets_and_numbers():
    text = "- First task\n2. Second task\n* Third\n\n• Fourth"
    assert _parse_lines(text) == ["First task", "Second task", "Third", "Fourth"]


def test_parse_lines_caps_at_ten():
    text = "\n".join(f"- item {i}" for i in range(20))
    assert len(_parse_lines(text)) == 10


def test_parse_lines_ignores_blank_lines():
    assert _parse_lines("\n\n  \n") == []


def test_mention_regex_extracts_handles():
    body = "hey @alice and @bob.smith, also email @carol@acme.test"
    handles = [m.group(1) for m in MENTION_RE.finditer(body)]
    assert "alice" in handles
    assert "bob.smith" in handles
    # local part of the email-form mention is captured
    assert "carol" in handles


def test_mention_regex_no_false_positive_on_plain_text():
    assert [m.group(1) for m in MENTION_RE.finditer("no mentions here")] == []


def test_page_params_offset():
    assert PageParams(page=1, size=20).offset == 0
    assert PageParams(page=3, size=25).offset == 50
