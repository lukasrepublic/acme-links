import { Shell } from "@/design-system/components";
import { AuthForm } from "../../auth-form";

export const metadata = { title: "Create an account — Acme Links" };

export default function SignupPage() {
  return (
    <Shell>
      <AuthForm
        title="Create an account"
        action="/signup"
        submitLabel="Create account"
        altHref="/login"
        altLabel="Log in instead"
      />
    </Shell>
  );
}
