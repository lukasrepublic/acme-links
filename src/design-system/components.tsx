/* Acme Links design system — owned components (shadcn-style: copied in, fully owned).
   Thin, accessible wrappers over the token-driven classes in theme.css. */
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
} from "react";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ── Button ────────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonClass = (variant: ButtonVariant, size: ButtonSize, extra?: string) =>
  cx("btn", `btn-${variant}`, size !== "md" && `btn-${size}`, extra);

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <a className={buttonClass(variant, size, className)} {...props} />;
}

// ── Field / Input ─────────────────────────────────────────────────────────────

export function Field({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("field", className)} {...props} />;
}

export function Label({
  className,
  ...props
}: HTMLAttributes<HTMLLabelElement> & { htmlFor?: string }) {
  return <label className={cx("label", className)} {...props} />;
}

export function Input({
  state,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { state?: "error" | "success" }) {
  return (
    <input
      className={cx("input", state && `input-${state}`, className)}
      {...props}
    />
  );
}

export function Help({
  tone,
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { tone?: "error" | "success" }) {
  return <p className={cx("help", tone && `help-${tone}`, className)} {...props} />;
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("card", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("card-header", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("card-body", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("card-footer", className)} {...props} />;
}

// ── Table ─────────────────────────────────────────────────────────────────────

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="table-wrap">
      <table className={cx("table", className)} {...props} />
    </div>
  );
}

export function Mono({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("mono", className)} {...props} />;
}

// ── Badge ─────────────────────────────────────────────────────────────────────

export function Badge({
  tone,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "success" | "danger" | "warning";
}) {
  return <span className={cx("badge", tone && `badge-${tone}`, className)} {...props} />;
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyState({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="empty empty-state" data-testid="empty-state">
      <span className="empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </span>
      <h2 className="empty-title">{title}</h2>
      {children ? <p className="empty-body">{children}</p> : null}
      {action}
    </div>
  );
}

// ── App shell ─────────────────────────────────────────────────────────────────

export function Shell({ nav, children }: { nav?: ReactNode; children: ReactNode }) {
  return (
    <>
      <header className="shell-nav">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            AL
          </span>
          Acme Links
        </a>
        {nav ? <nav aria-label="Main">{nav}</nav> : null}
      </header>
      <main className="page">{children}</main>
    </>
  );
}

export function NavLinks({ children }: { children: ReactNode }) {
  return <ul className="nav-links">{children}</ul>;
}
