"use client";

// Shared login/signup form — a design-system consumer. Posts to the session
// endpoints (/login, /signup) that own the auth contract.
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Help,
  Input,
  Label,
} from "@/design-system/components";

export function AuthForm({
  title,
  action,
  submitLabel,
  altHref,
  altLabel,
}: {
  title: string;
  action: "/login" | "/signup";
  submitLabel: string;
  altHref: string;
  altLabel: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ maxWidth: "var(--width-card)", margin: "0 auto" }}>
      <CardHeader>{title}</CardHeader>
      <CardBody>
        <form className="stack" onSubmit={submit} style={{ gap: "var(--space-4)" }}>
          <Field>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              state={error ? "error" : undefined}
            />
          </Field>
          <Field>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={action === "/signup" ? "new-password" : "current-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              state={error ? "error" : undefined}
            />
            {error ? <Help tone="error">{error}</Help> : null}
          </Field>
          <div className="row">
            <Button type="submit" aria-busy={busy || undefined}>
              {submitLabel}
            </Button>
            <a href={altHref} className="btn btn-ghost">
              {altLabel}
            </a>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
