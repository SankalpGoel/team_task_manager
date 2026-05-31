from __future__ import annotations

import logging
from typing import Iterable

from app.core.config import settings

log = logging.getLogger("email")


def _send_via_resend(to: list[str], subject: str, html: str) -> bool:
    try:
        import resend  # type: ignore

        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send({  # type: ignore[attr-defined]
            "from": settings.EMAIL_FROM,
            "to": to,
            "subject": subject,
            "html": html,
        })
        return True
    except Exception as e:  # pragma: no cover
        log.warning("Resend email failed: %s", e)
        return False


def send_email(to: str | Iterable[str], subject: str, html: str) -> bool:
    """Send an email. If RESEND_API_KEY is missing, log the message instead.

    Always returns True in dev so callers don't need to special-case missing keys.
    """
    recipients = [to] if isinstance(to, str) else list(to)
    if not settings.RESEND_API_KEY:
        log.info(
            "[email-dev] to=%s subject=%r\n%s",
            recipients,
            subject,
            html[:1000],
        )
        return True
    return _send_via_resend(recipients, subject, html)


def _wrap(content_html: str, *, action_label: str | None = None, action_url: str | None = None) -> str:
    btn = ""
    if action_label and action_url:
        btn = (
            f'<p style="margin:24px 0;"><a href="{action_url}" '
            f'style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;'
            f'border-radius:6px;text-decoration:none;font-weight:600;">{action_label}</a></p>'
        )
    return (
        '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#111;">'
        f'<h2 style="margin-top:0;">Team Task Manager</h2>{content_html}{btn}'
        '<hr style="margin-top:32px;border:none;border-top:1px solid #eee;" />'
        '<p style="font-size:12px;color:#666;">You are receiving this because of activity in your workspace.</p>'
        "</div>"
    )


def render_invite_email(workspace_name: str, inviter_name: str, accept_url: str, role: str) -> tuple[str, str]:
    subject = f"You're invited to {workspace_name} on Team Task Manager"
    html = _wrap(
        f"<p><strong>{inviter_name}</strong> invited you to join "
        f"<strong>{workspace_name}</strong> as <strong>{role}</strong>.</p>"
        "<p>Click the button below to accept the invitation.</p>",
        action_label="Accept invitation",
        action_url=accept_url,
    )
    return subject, html


def render_task_assigned_email(task_title: str, project_name: str, link: str) -> tuple[str, str]:
    subject = f"Task assigned: {task_title}"
    html = _wrap(
        f"<p>You were assigned to <strong>{task_title}</strong> in <strong>{project_name}</strong>.</p>",
        action_label="Open task",
        action_url=link,
    )
    return subject, html


def render_mention_email(actor_name: str, task_title: str, snippet: str, link: str) -> tuple[str, str]:
    subject = f"{actor_name} mentioned you on '{task_title}'"
    html = _wrap(
        f"<p><strong>{actor_name}</strong> mentioned you on <strong>{task_title}</strong>:</p>"
        f'<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444;">{snippet}</blockquote>',
        action_label="View comment",
        action_url=link,
    )
    return subject, html
