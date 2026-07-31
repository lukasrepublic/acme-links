"use client";

// The dashboard's create affordance — posts to the create-link atom's API.
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  Field,
  Help,
  Input,
  Label,
  Mono,
} from "@/design-system/components";

export function CreateLinkForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = (await res.json().catch(() => null)) as {
        shortUrl?: string;
        error?: string;
      } | null;
      if (res.status === 201 && body?.shortUrl) {
        setCreated(body.shortUrl);
        setUrl("");
        router.refresh();
      } else {
        setError(body?.error ?? "something went wrong");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card id="create-link">
      <CardBody>
        <form className="row" onSubmit={submit} style={{ alignItems: "flex-end" }}>
          <Field style={{ maxWidth: "var(--width-empty)" }}>
            <Label htmlFor="url">Shorten a URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/a/very/long/path"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              state={error ? "error" : undefined}
            />
            {error ? <Help tone="error">{error}</Help> : null}
            {created ? (
              <Help tone="success">
                Created <Mono>{created}</Mono>
              </Help>
            ) : null}
          </Field>
          <Button type="submit" aria-busy={busy || undefined}>
            Create a link
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
