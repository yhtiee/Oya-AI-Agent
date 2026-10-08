import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaEnrol, MfaVerify } from "@/components/auth/Mfa";
import { requireSession, safeNext } from "@/server/auth/session";

export const metadata: Metadata = { title: "Two-factor sign-in" };

export default async function VerifyPage({ searchParams }: PageProps<"/ops/verify">) {
  const { next } = await searchParams;
  const target = safeNext(next, "/ops");
  const session = await requireSession("/ops/verify");
  if (!session.appRole) redirect("/app");
  if (session.aal === "aal2") redirect(target);

  return (
    <div className="max-w-[480px]">
      {session.mfaEnabled ? <MfaVerify next={target} /> : <MfaEnrol email={session.email} next={target} />}
    </div>
  );
}
