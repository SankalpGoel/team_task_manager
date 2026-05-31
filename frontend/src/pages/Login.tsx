import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/features/auth/api";
import { getApiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/app";
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onAuthed = (data: Awaited<ReturnType<typeof login>>, msg: string) => {
    setTokens(data.access_token, data.refresh_token);
    setUser(data.user);
    toast.success(msg);
    navigate(next, { replace: true });
  };

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => onAuthed(data, "Welcome back!"),
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const demo = useMutation({
    mutationFn: () => login({ email: "admin@acme.test", password: "Password123" }),
    onSuccess: (data) => onAuthed(data, "Welcome to the live demo!"),
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const busy = mutation.isPending || demo.isPending;

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your team workspace.">
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" autoFocus {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              {...form.register("password")}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>

        <div className="relative py-1 text-center">
          <span className="relative z-10 bg-background px-2 text-xs text-muted-foreground">or</span>
          <span className="absolute inset-x-0 top-1/2 -z-0 h-px bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={() => demo.mutate()}
        >
          {demo.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Try the live demo
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
