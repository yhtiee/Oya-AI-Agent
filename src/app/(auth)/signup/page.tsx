import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { getSession, safeNext } from "@/server/auth/session";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const target = safeNext(next);
  if (await getSession()) redirect(target);
  return <SignUpForm next={target} language={(await getLocale()) === "pcm" ? "pcm" : "en"} />;
}
