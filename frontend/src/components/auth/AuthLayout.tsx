import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AtSign, CheckSquare, LayoutGrid, ShieldCheck, Sparkles } from "lucide-react";

import { ThemeToggle } from "@/components/layout/ThemeToggle";

const BULLETS = [
  { icon: LayoutGrid, text: "Visual Kanban boards with drag-and-drop" },
  { icon: Sparkles, text: "AI that drafts tasks and summarizes projects" },
  { icon: AtSign, text: "Real-time comments, @mentions & notifications" },
  { icon: ShieldCheck, text: "Role-based access across multi-tenant workspaces" },
];

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* Branded panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-12 text-white lg:flex">
        {/* gradient accents */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-violet-600/30 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        <Link to="/" className="relative z-10 flex items-center gap-2 font-semibold tracking-tight">
          <CheckSquare className="h-6 w-6 text-primary" />
          Team Task Manager
        </Link>

        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Where teams plan, collaborate, and ship,{" "}
            <span className="bg-gradient-to-r from-primary to-violet-400 bg-clip-text text-transparent">
              all in one place.
            </span>
          </h2>
          <ul className="mt-8 space-y-4">
            {BULLETS.map((b) => (
              <li key={b.text} className="flex items-center gap-3 text-sm text-zinc-300">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <b.icon className="h-4 w-4 text-primary" />
                </span>
                {b.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-sm text-zinc-400">
          “Finally, a task manager our whole team enjoys using.”
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center px-6 py-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Link
              to="/"
              className="mb-6 inline-flex items-center gap-2 font-semibold tracking-tight lg:hidden"
            >
              <CheckSquare className="h-5 w-5 text-primary" />
              Team Task Manager
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
