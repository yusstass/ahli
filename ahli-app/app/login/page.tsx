import AuthForm from "@/components/AuthForm";
import { safeNext } from "@/lib/security";
const MSG: Record<string, string> = {
  google: "Google sign-in failed. Please try again.",
  exists: "An account with this email already exists. Log in with your email and password.",
};
export default function Page({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  const error = searchParams.error ? MSG[searchParams.error] ?? MSG.google : undefined;
  return <AuthForm mode="login" next={safeNext(searchParams.next) ?? undefined} error={error} />;
}
