import GradInvite from "@/components/GradInvite";
import { INVITE } from "@/lib/config";

// Đọc ?name=... phía server rồi truyền xuống client component (không cần Suspense).
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const raw = sp.name;
  const nameParam = Array.isArray(raw) ? raw[0] : raw;
  const name = (nameParam ?? "").trim() || INVITE.defaultName;

  return <GradInvite name={name} />;
}
