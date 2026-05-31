"""Seed the database with a demo workspace, three role accounts, projects, tasks, etc.

Run AFTER `alembic upgrade head`. Idempotent: skips if demo workspace already exists.

    python seed.py
"""
from __future__ import annotations

import asyncio
import logging
import random
import sys
from datetime import date, datetime, timedelta, timezone
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Allow `python seed.py` from the backend directory
sys.path.insert(0, ".")

from app.core.database import SessionLocal, engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models import (  # noqa: E402
    ActivityLog,
    Comment,
    Label,
    Membership,
    Mention,
    Project,
    Role,
    Subtask,
    Task,
    TaskLabel,
    TaskPriority,
    TaskStatus,
    User,
    Workspace,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("seed")

DEMO_SLUG = "acme-inc"
PASSWORD = "Password123"


async def _get_or_create_user(db: AsyncSession, email: str, full_name: str) -> User:
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user:
        return user
    user = User(email=email, full_name=full_name, password_hash=hash_password(PASSWORD))
    db.add(user)
    await db.flush()
    return user


async def seed() -> None:
    async with SessionLocal() as db:  # type: AsyncSession
        existing = (await db.execute(select(Workspace).where(Workspace.slug == DEMO_SLUG))).scalar_one_or_none()
        if existing:
            log.info("Demo workspace already exists (slug=%s); skipping.", DEMO_SLUG)
            return

        admin = await _get_or_create_user(db, "admin@acme.test", "Ada Admin")
        manager = await _get_or_create_user(db, "manager@acme.test", "Mark Manager")
        member = await _get_or_create_user(db, "member@acme.test", "Mia Member")

        workspace = Workspace(name="Acme Inc", slug=DEMO_SLUG, owner_id=admin.id)
        db.add(workspace)
        await db.flush()

        db.add_all([
            Membership(user_id=admin.id, workspace_id=workspace.id, role=Role.ADMIN),
            Membership(user_id=manager.id, workspace_id=workspace.id, role=Role.MANAGER),
            Membership(user_id=member.id, workspace_id=workspace.id, role=Role.MEMBER),
        ])
        await db.flush()

        labels = [
            Label(workspace_id=workspace.id, name="bug", color="#ef4444"),
            Label(workspace_id=workspace.id, name="feature", color="#22c55e"),
            Label(workspace_id=workspace.id, name="design", color="#a855f7"),
            Label(workspace_id=workspace.id, name="backend", color="#3b82f6"),
            Label(workspace_id=workspace.id, name="urgent", color="#f97316"),
        ]
        db.add_all(labels)
        await db.flush()

        projects = [
            Project(workspace_id=workspace.id, name="Website Relaunch",
                    description="Marketing site redesign and migration.", created_by=admin.id),
            Project(workspace_id=workspace.id, name="Mobile App",
                    description="iOS + Android client.", created_by=manager.id),
            Project(workspace_id=workspace.id, name="Internal Tooling",
                    description="Admin dashboards, ops scripts.", created_by=admin.id),
        ]
        db.add_all(projects)
        await db.flush()

        today = date.today()
        statuses = list(TaskStatus)
        priorities = list(TaskPriority)
        users = [admin, manager, member]

        task_seed: list[tuple[Project, str, str, TaskStatus, TaskPriority, int | None, User | None]] = [
            (projects[0], "Set up design system tokens", "Use Figma variables for colors + spacing.", TaskStatus.DONE, TaskPriority.MEDIUM, -10, admin),
            (projects[0], "Build homepage hero", "New animated hero with product video.", TaskStatus.IN_PROGRESS, TaskPriority.HIGH, 3, manager),
            (projects[0], "Migrate blog from WordPress", "Export → MDX → deploy.", TaskStatus.TODO, TaskPriority.MEDIUM, 14, member),
            (projects[0], "Fix mobile nav overflow", "Hamburger menu clips at <380px.", TaskStatus.IN_REVIEW, TaskPriority.HIGH, -2, manager),
            (projects[0], "SEO audit", "Run Lighthouse + Ahrefs.", TaskStatus.TODO, TaskPriority.LOW, 21, None),

            (projects[1], "Auth: biometric login (iOS)", "Use FaceID/TouchID.", TaskStatus.IN_PROGRESS, TaskPriority.URGENT, 5, member),
            (projects[1], "Push notifications", "FCM + APNS.", TaskStatus.TODO, TaskPriority.HIGH, 7, manager),
            (projects[1], "App icon iteration", "Round 3 of color tests.", TaskStatus.IN_REVIEW, TaskPriority.LOW, 1, admin),
            (projects[1], "Profile screen polish", "Avatar upload, edit bio.", TaskStatus.DONE, TaskPriority.MEDIUM, -5, member),
            (projects[1], "Onboarding swipe deck", "3 screens, skippable.", TaskStatus.TODO, TaskPriority.MEDIUM, 10, admin),

            (projects[2], "Backups: nightly Postgres dump", "S3 + 30 day retention.", TaskStatus.DONE, TaskPriority.HIGH, -7, admin),
            (projects[2], "On-call rotation page", "Internal wiki.", TaskStatus.TODO, TaskPriority.LOW, None, None),
            (projects[2], "Refund workflow UI", "Admin can issue refunds.", TaskStatus.IN_PROGRESS, TaskPriority.MEDIUM, 2, manager),
            (projects[2], "Audit log viewer", "Read-only activity stream.", TaskStatus.IN_REVIEW, TaskPriority.MEDIUM, 4, admin),
            (projects[2], "Quarterly metrics export", "CSV + email.", TaskStatus.DONE, TaskPriority.LOW, -3, member),
        ]

        # Group positions per (project, status) so the board orders cleanly
        positions: dict[tuple, float] = {}
        tasks: List[Task] = []
        for proj, title, desc, status_, prio, dd_offset, assignee in task_seed:
            key = (proj.id, status_)
            positions[key] = positions.get(key, 0.0) + 1000.0
            due_date = today + timedelta(days=dd_offset) if dd_offset is not None else None
            t = Task(
                project_id=proj.id,
                title=title,
                description=desc,
                status=status_,
                priority=prio,
                assignee_id=(assignee.id if assignee else None),
                due_date=due_date,
                position=positions[key],
                created_by=admin.id,
            )
            db.add(t)
            tasks.append(t)
        await db.flush()

        # Subtasks on the first 4 tasks
        for t in tasks[:4]:
            for i, title in enumerate(["Draft", "Review", "Implement", "Verify"]):
                db.add(Subtask(task_id=t.id, title=title, is_done=(i < 2), position=(i + 1) * 1000.0))

        # Labels on a handful of tasks
        random.seed(42)
        for t in tasks:
            picks = random.sample(labels, k=random.randint(0, 2))
            for lbl in picks:
                db.add(TaskLabel(task_id=t.id, label_id=lbl.id))

        await db.flush()

        # Comments incl. a mention
        c1 = Comment(task_id=tasks[1].id, author_id=manager.id, body="Started this — going for a punchy hero.")
        c2 = Comment(task_id=tasks[1].id, author_id=admin.id, body=f"Looks great @{member.full_name} — please review.")
        db.add_all([c1, c2])
        await db.flush()
        db.add(Mention(comment_id=c2.id, user_id=member.id))

        # Activity log entries
        now = datetime.now(timezone.utc)
        verbs = [
            ("project.created", "project", projects[0].id, admin.id),
            ("project.created", "project", projects[1].id, manager.id),
            ("task.created", "task", tasks[0].id, admin.id),
            ("task.moved", "task", tasks[1].id, manager.id),
            ("task.assigned", "task", tasks[5].id, manager.id),
            ("member.joined", "user", manager.id, manager.id),
            ("member.joined", "user", member.id, member.id),
            ("comment.created", "comment", c1.id, manager.id),
            ("comment.created", "comment", c2.id, admin.id),
            ("task.completed", "task", tasks[0].id, admin.id),
        ]
        for i, (verb, target_type, target_id, actor) in enumerate(verbs):
            db.add(ActivityLog(
                workspace_id=workspace.id,
                actor_id=actor,
                verb=verb,
                target_type=target_type,
                target_id=target_id,
                meta=None,
                created_at=now - timedelta(hours=i * 3),
            ))

        await db.commit()
        log.info("Seeded demo workspace 'Acme Inc'. Demo creds (password=%s):", PASSWORD)
        log.info("  admin@acme.test    (admin)")
        log.info("  manager@acme.test  (manager)")
        log.info("  member@acme.test   (member)")


async def main() -> None:
    try:
        await seed()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
