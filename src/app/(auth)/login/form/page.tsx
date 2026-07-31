import { Shell } from "@/design-system/components";
import { AuthForm } from "../../auth-form";

export const metadata = { title: "Log in — Acme Links" };

export default function LoginPage() {
  return (
    <Shell>
      <AuthForm
        title="Log in"
        action="/login"
        submitLabel="Log in"
        altHref="/signup"
        altLabel="Create an account"
      />
    </Shell>
  );
}
