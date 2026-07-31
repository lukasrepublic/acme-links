"use client";

// A real form POST, not an anchor with an onClick. /logout is POST-only, so an
// anchor's fallback (ctrl-click, middle-click, JS disabled or failed) would
// navigate away WITHOUT logging out — telling the user they signed out while
// the session stays live for its full TTL. And the handler distinguishes
// "no session to revoke" from "revocation failed" precisely so the client can
// tell the truth; discarding that response throws the distinction away.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  return (
    <form
      method="post"
      action="/logout"
      onSubmit={async (e) => {
        e.preventDefault();
        setFailed(false);
        try {
          const res = await fetch("/logout", { method: "POST" });
          if (!res.ok) {
            setFailed(true);
            return;
          }
        } catch {
          setFailed(true);
          return;
        }
        router.push("/");
        router.refresh();
      }}
    >
      <button type="submit" className="btn btn-ghost btn-sm">
        Log out
      </button>
      {failed ? (
        <span className="help help-error" role="alert">
          Logout failed — you are still signed in
        </span>
      ) : null}
    </form>
  );
}
