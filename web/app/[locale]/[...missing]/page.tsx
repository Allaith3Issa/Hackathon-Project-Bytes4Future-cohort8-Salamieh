import { notFound } from "next/navigation";
import { RecoveringSession } from "@/components/recovering-session";
import { requirePageAccount } from "@/lib/session";

export default async function MissingPage() {
  if (!(await requirePageAccount())) return <RecoveringSession />;
  notFound();
}
