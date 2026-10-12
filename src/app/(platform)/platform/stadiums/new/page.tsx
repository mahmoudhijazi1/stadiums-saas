import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ui } from "@/lib/copy";
import { requirePlatformHost } from "@/lib/require-platform-host";
import { getCurrentPlatformAdmin } from "@/modules/platform/application/platform-session";
import { submitCreateStadium, submitPlatformLogout } from "@/app/(platform)/platform/actions";
import { CreateStadiumForm } from "@/app/(platform)/platform/_components/create-stadium-form";
import { PlatformFrame } from "@/app/(platform)/platform/_components/platform-frame";

export const dynamic = "force-dynamic";

/** Create a stadium with its owner (DR-006 slice 6). Host guard, then a session, as every page. */
export default async function NewStadiumPage() {
  await requirePlatformHost();
  const admin = await getCurrentPlatformAdmin();
  if (!admin) redirect("/platform/login");

  return (
    <PlatformFrame identifier={admin.identifier} logout={submitPlatformLogout}>
      <Link href="/platform" className="inline-flex min-h-11 items-center gap-1 self-start text-sm text-muted-foreground hover:underline">
        <ChevronLeft aria-hidden className="size-4" />
        {ui("platform.back", "en")}
      </Link>
      <h1 className="text-2xl font-semibold">{ui("platform.newStadium", "en")}</h1>
      <CreateStadiumForm action={submitCreateStadium} />
    </PlatformFrame>
  );
}
