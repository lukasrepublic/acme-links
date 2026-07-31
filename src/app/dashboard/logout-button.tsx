"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <a
      href="/"
      onClick={async (e) => {
        e.preventDefault();
        await fetch("/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      Log out
    </a>
  );
}
