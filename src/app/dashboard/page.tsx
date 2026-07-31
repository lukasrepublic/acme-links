// GET /dashboard — my links + click counts (feat-handbook-acme-links-dashboard).
// The design system's first consumer. Auth is enforced HERE, in the handler —
// never middleware-only (CVE-2025-29927).
import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { link } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  Badge,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Mono,
  NavLinks,
  Shell,
  Table,
} from "@/design-system/components";
import { CreateLinkForm } from "./create-link-form";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

// AC-DASH-7: the listing is bounded — newest first, one page.
const PAGE_SIZE = 50;

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const rows = await db
    .select({
      slug: link.slug,
      targetUrl: link.targetUrl,
      clicks: link.clicks,
      createdAt: link.createdAt,
    })
    .from(link)
    .where(eq(link.userId, session.user.id))
    .orderBy(desc(link.createdAt), desc(link.id))
    .limit(PAGE_SIZE);

  return (
    <Shell
      nav={
        <NavLinks>
          <li>
            <a href="/dashboard" aria-current="page">
              Dashboard
            </a>
          </li>
          <li>
            <LogoutButton />
          </li>
        </NavLinks>
      }
    >
      <div className="stack" style={{ gap: "var(--space-6)" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 style={{ fontSize: "var(--text-2xl)", margin: 0 }}>Your links</h1>
        </div>
        <CreateLinkForm />
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              title="No links yet"
              action={
                <ButtonLink href="#create-link" variant="secondary">
                  Create your first link
                </ButtonLink>
              }
            >
              Paste a long URL above and it becomes a short one, with a click
              count you can watch.
            </EmptyState>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              {rows.length === PAGE_SIZE
                ? `Latest ${PAGE_SIZE} links`
                : `${rows.length} ${rows.length === 1 ? "link" : "links"}`}
            </CardHeader>
            <Table>
              <thead>
                <tr>
                  <th>Short link</th>
                  <th>Destination</th>
                  <th>Clicks</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.slug}>
                    <td>
                      <a href={`/r/${row.slug}`}>
                        <Mono>/r/{row.slug}</Mono>
                      </a>
                    </td>
                    <td>
                      <Mono>{row.targetUrl}</Mono>
                    </td>
                    <td>
                      <Badge>{row.clicks}</Badge>
                    </td>
                    <td>{row.createdAt.toISOString().slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </div>
    </Shell>
  );
}
