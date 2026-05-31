import { useMutation } from "@tanstack/react-query";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  AtSign,
  BarChart3,
  Briefcase,
  Check,
  CheckSquare,
  Crown,
  Github,
  LayoutGrid,
  Loader2,
  Play,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  Zap,
} from "lucide-react";

import { Reveal } from "@/components/Reveal";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { login } from "@/features/auth/api";
import { getApiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

const FEATURES = [
  { icon: LayoutGrid, title: "Visual Kanban boards", body: "Drag tasks across To-do → Done with smooth, persistent ordering." },
  { icon: Zap, title: "Real-time updates", body: "See teammates' changes the instant they happen, powered by WebSockets." },
  { icon: ShieldCheck, title: "Role-based access", body: "Admin, manager & member roles scoped per workspace. Multi-tenant by design." },
  { icon: Sparkles, title: "AI assistance", body: "Draft descriptions, break work into subtasks, and summarize projects in a click." },
  { icon: AtSign, title: "Mentions & comments", body: "Discuss in threaded comments and @mention teammates with instant alerts." },
  { icon: BarChart3, title: "Analytics dashboard", body: "Track status, completion trends, and team workload at a glance." },
];

const STATS = [
  { value: "3", label: "Roles per workspace" },
  { value: "Realtime", label: "Live collaboration" },
  { value: "AI", label: "In every task" },
  { value: "100%", label: "Type-safe stack" },
];

const ROLES = [
  {
    icon: Crown,
    name: "Admin",
    tagline: "Full control of the workspace.",
    perks: [
      "Invite, remove & re-role members",
      "Create projects & manage labels",
      "Delete any task or project",
      "Owners can rename or delete the workspace",
    ],
    accent: "text-amber-500",
    ring: "ring-amber-500/20",
  },
  {
    icon: Briefcase,
    name: "Manager",
    tagline: "Drives the team's delivery.",
    perks: [
      "Create & edit projects",
      "Create labels & organize boards",
      "Assign and delete tasks",
      "Everything a member can do",
    ],
    accent: "text-blue-500",
    ring: "ring-blue-500/20",
  },
  {
    icon: User,
    name: "Member",
    tagline: "Focused on getting work done.",
    perks: [
      "Create tasks & self-assign",
      "Update & move their own tasks",
      "Comment & @mention teammates",
      "View boards, dashboards & activity",
    ],
    accent: "text-emerald-500",
    ring: "ring-emerald-500/20",
  },
];

/* ---------- Decorative product preview (pure CSS, no assets) ---------- */
function AppPreview() {
  const bars = [55, 80, 40, 95, 65, 75];
  return (
    <div className="rounded-2xl border bg-card/90 shadow-2xl shadow-primary/10 backdrop-blur">
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400/80" />
        <span className="h-3 w-3 rounded-full bg-amber-400/80" />
        <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
        <div className="ml-3 flex-1">
          <div className="mx-auto w-56 rounded-md bg-muted px-3 py-1 text-center text-[10px] text-muted-foreground">
            app.teamtask.io / dashboard
          </div>
        </div>
      </div>
      {/* faux app */}
      <div className="flex">
        <div className="hidden w-14 shrink-0 flex-col items-center gap-3 border-r py-4 sm:flex">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-8 w-8 rounded-lg ${i === 0 ? "bg-primary/15" : "bg-muted"}`}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-4 p-4">
          {/* stat cards */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { n: "12", l: "To do" },
              { n: "5", l: "In progress" },
              { n: "3", l: "In review" },
              { n: "28", l: "Done" },
            ].map((s) => (
              <div key={s.l} className="rounded-lg border bg-background p-2">
                <div className="text-[9px] text-muted-foreground">{s.l}</div>
                <div className="text-base font-semibold">{s.n}</div>
              </div>
            ))}
          </div>
          {/* chart + board */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-2 rounded-lg border bg-background p-3">
              <div className="mb-2 text-[9px] text-muted-foreground">Completed</div>
              <div className="flex h-16 items-end gap-1.5">
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-gradient-to-t from-primary/40 to-primary"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="col-span-3 grid grid-cols-3 gap-2">
              {["To do", "Doing", "Done"].map((c, ci) => (
                <div key={c} className="rounded-lg bg-muted/60 p-1.5">
                  <div className="mb-1.5 px-0.5 text-[9px] font-medium text-muted-foreground">{c}</div>
                  <div className="space-y-1.5">
                    {Array.from({ length: ci === 1 ? 2 : 1 }).map((_, k) => (
                      <div key={k} className="rounded-md border bg-background p-1.5 shadow-sm">
                        <div className="h-1.5 w-3/4 rounded bg-foreground/15" />
                        <div className="mt-1.5 flex items-center gap-1">
                          <div className="h-2 w-6 rounded bg-primary/20" />
                          <div className="ml-auto h-3 w-3 rounded-full bg-muted-foreground/20" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const demo = useMutation({
    mutationFn: () => login({ email: "admin@acme.test", password: "Password123" }),
    onSuccess: (data) => {
      setTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      toast.success("Welcome to the live demo!");
      navigate("/app", { replace: true });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  if (accessToken) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-full bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <CheckSquare className="h-5 w-5 text-primary" />
            Team Task Manager
          </Link>
          <nav className="ml-6 hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#roles" className="hover:text-foreground">Roles</a>
            <a href="#testimonial" className="hover:text-foreground">Reviews</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="animate-float pointer-events-none absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="animate-float-slow pointer-events-none absolute -right-40 top-20 h-[28rem] w-[28rem] rounded-full bg-violet-500/20 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.4] [mask-image:radial-gradient(60%_50%_at_50%_0%,black,transparent)]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="mx-auto max-w-6xl px-4 pb-10 pt-20 text-center md:pt-28">
          <Reveal delay={0}>
            <a
              href="#features"
              className="mx-auto inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            >
              <span className="flex h-4 items-center rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                New
              </span>
              AI assistance now in every task
              <ArrowRight className="h-3 w-3" />
            </a>
          </Reveal>

          <Reveal delay={90}>
            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-tight md:text-6xl md:leading-[1.08]">
              The workspace where your team{" "}
              <span className="animate-gradient bg-gradient-to-r from-primary via-violet-500 to-primary bg-clip-text text-transparent">
                actually ships.
              </span>
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              Kanban boards, real-time collaboration, and AI assistance, together in one fast,
              role-based workspace your whole team will love.
            </p>
          </Reveal>

          <Reveal delay={270}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-base transition-transform hover:scale-[1.03]">
                <Link to="/signup">
                  Get started free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-6 text-base transition-transform hover:scale-[1.03]"
                onClick={() => demo.mutate()}
                disabled={demo.isPending}
              >
                {demo.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Try the live demo
              </Button>
            </div>
          </Reveal>
          <p className="mt-3 text-xs text-muted-foreground">
            No sign-up needed for the demo · explore a seeded workspace instantly
          </p>

          {/* product preview */}
          <Reveal delay={380} className="relative mx-auto mt-16 max-w-4xl">
            <div className="animate-float">
              <AppPreview />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal as="div" key={s.label} delay={i * 80} className="text-center">
              <div className="text-2xl font-bold tracking-tight md:text-3xl">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold text-primary">Features</span>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              Everything your team needs to ship
            </h2>
            <p className="mt-3 text-muted-foreground">
              Thoughtfully built, fast, and out of your way.
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal
                key={f.title}
                delay={(i % 3) * 90}
                className="group rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Highlight row: AI */}
      <section className="border-t bg-muted/30 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2">
          <Reveal>
            <span className="text-sm font-semibold text-primary">Work smarter</span>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              Let AI handle the busywork
            </h2>
            <p className="mt-4 text-muted-foreground">
              Draft a full task description from a title, break big tasks into subtasks, and get a
              crisp executive summary of any project, without leaving the board.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {["Draft descriptions & acceptance criteria", "Suggest subtask breakdowns", "Summarize project status instantly"].map(
                (t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> {t}
                  </li>
                ),
              )}
            </ul>
          </Reveal>
          <Reveal delay={140} className="rounded-2xl border bg-card p-6 shadow-xl shadow-primary/5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" /> AI draft
            </div>
            <div className="space-y-2">
              <div className="h-2.5 w-full rounded bg-muted" />
              <div className="h-2.5 w-11/12 rounded bg-muted" />
              <div className="h-2.5 w-4/5 rounded bg-muted" />
              <div className="mt-4 space-y-2">
                {["Acceptance criteria #1", "Acceptance criteria #2", "Acceptance criteria #3"].map((c) => (
                  <div key={c} className="flex items-center gap-2 rounded-lg border bg-background p-2 text-xs">
                    <CheckSquare className="h-3.5 w-3.5 text-emerald-500" /> {c}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold text-primary">Get started</span>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              Up and running in minutes
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { n: "1", title: "Create a workspace", body: "Spin up a space for your team in seconds." },
              { n: "2", title: "Add projects & tasks", body: "Organize work on boards and assign owners." },
              { n: "3", title: "Invite your team", body: "Bring teammates in with roles and start shipping." },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 110} className="relative rounded-2xl border bg-card p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {s.n}
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Role-based access */}
      <section id="roles" className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold text-primary">Role-based access</span>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              The right access for every teammate
            </h2>
            <p className="mt-3 text-muted-foreground">
              Three roles, scoped per workspace, so everyone gets exactly the permissions they
              need, and nothing they don't.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {ROLES.map((r, i) => (
              <Reveal
                key={r.name}
                delay={i * 110}
                className="flex flex-col rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
              >
                <div
                  className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-background ring-1 ${r.ring} ${r.accent}`}
                >
                  <r.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{r.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{r.tagline}</p>
                <ul className="mt-5 space-y-2.5 border-t pt-5 text-sm">
                  {r.perks.map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${r.accent}`} />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground">
            Every workspace is fully isolated: members of one team never see another's data.
          </p>
        </div>
      </section>

      {/* Testimonial */}
      <section id="testimonial" className="border-t py-24">
        <Reveal className="mx-auto max-w-3xl px-4 text-center">
          <div className="mb-4 flex justify-center gap-1 text-amber-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-current" />
            ))}
          </div>
          <Quote className="mx-auto h-8 w-8 text-primary/40" />
          <blockquote className="mt-4 text-xl font-medium leading-relaxed md:text-2xl">
            “We replaced three different tools with this. The board, the realtime updates, and the AI
            summaries mean our standups are basically automatic now.”
          </blockquote>
          <div className="mt-6 text-sm text-muted-foreground">
            A very happy product team · using Team Task Manager daily
          </div>
        </Reveal>
      </section>

      {/* CTA band */}
      <section className="py-24">
        <Reveal className="mx-auto max-w-5xl px-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-violet-600 px-6 py-16 text-center text-primary-foreground">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-black/10 blur-3xl" />
            <h2 className="relative text-3xl font-semibold tracking-tight md:text-4xl">
              Ready to get your team organized?
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-primary-foreground/80">
              Create a free workspace, or jump straight into the live demo. No sign-up required.
            </p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" variant="secondary" className="h-12 px-6 text-base">
                <Link to="/signup">
                  Get started free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                onClick={() => demo.mutate()}
                disabled={demo.isPending}
                className="h-12 border border-white/30 bg-white/10 px-6 text-base text-white hover:bg-white/20"
              >
                {demo.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Try the live demo
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <CheckSquare className="h-5 w-5 text-primary" /> Team Task Manager
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              A modern, role-based task manager for teams.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Product</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground">Features</a></li>
              <li><a href="#how" className="hover:text-foreground">How it works</a></li>
              <li><Link to="/signup" className="hover:text-foreground">Sign up</Link></li>
              <li><Link to="/login" className="hover:text-foreground">Log in</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Demo accounts</h4>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li>admin@acme.test</li>
              <li>manager@acme.test</li>
              <li>member@acme.test</li>
              <li className="pt-1 text-xs">password: <code className="rounded bg-muted px-1">Password123</code></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Built with</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>FastAPI · SQLAlchemy</li>
              <li>React · Vite · Tailwind</li>
              <li>PostgreSQL · Redis</li>
              <li className="flex items-center gap-1.5"><Github className="h-3.5 w-3.5" /> Open source</li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-6xl border-t px-4 pt-6 text-center text-xs text-muted-foreground">
          © 2026 Team Task Manager. Crafted as a full-stack portfolio project.
        </div>
      </footer>
    </div>
  );
}
