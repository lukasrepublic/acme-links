import {
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Mono,
  NavLinks,
  Shell,
} from "@/design-system/components";

export default function Home() {
  return (
    <Shell
      nav={
        <NavLinks>
          <li>
            <a href="/dashboard">Dashboard</a>
          </li>
          <li>
            <a href="/login">Log in</a>
          </li>
        </NavLinks>
      }
    >
      <div className="stack" style={{ gap: "var(--space-8)" }}>
        <section style={{ maxWidth: "var(--measure)" }}>
          <h1
            style={{
              fontSize: "var(--text-4xl)",
              lineHeight: "var(--leading-display)",
              letterSpacing: "var(--tracking-tight)",
              margin: "0 0 var(--space-4)",
            }}
          >
            Short links, with the numbers to show for them.
          </h1>
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: "var(--text-lg)",
              margin: "0 0 var(--space-6)",
            }}
          >
            Paste a long URL, get a short one back, and watch the clicks add up
            on your dashboard. Your links are yours alone.
          </p>
          <div className="row">
            <ButtonLink href="/signup" size="lg">
              Create an account
            </ButtonLink>
            <ButtonLink href="/login" variant="ghost" size="lg">
              Log in
            </ButtonLink>
          </div>
        </section>

        <section className="row" style={{ alignItems: "stretch" }}>
          <Card style={{ flex: "1 1 260px" }}>
            <CardHeader>Shorten</CardHeader>
            <CardBody>
              Paste any http(s) URL and get a 7-character slug back:{" "}
              <Mono>/r/x7Kd9Qp</Mono>.
            </CardBody>
          </Card>
          <Card style={{ flex: "1 1 260px" }}>
            <CardHeader>Share</CardHeader>
            <CardBody>
              Anyone can follow the short link — no account needed. The redirect
              goes to exactly the URL you stored.
            </CardBody>
          </Card>
          <Card style={{ flex: "1 1 260px" }}>
            <CardHeader>Count</CardHeader>
            <CardBody>
              Every resolve increments the link&apos;s click count. Your
              dashboard shows each link with its total.
            </CardBody>
          </Card>
        </section>
      </div>
    </Shell>
  );
}
