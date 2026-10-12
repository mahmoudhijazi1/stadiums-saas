import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { SubmitButton } from "@/components/ui/submit-button";
import { ui } from "@/lib/copy";
import { requirePlatformHost } from "@/lib/require-platform-host";
import { getCurrentPlatformAdmin } from "@/modules/platform/application/platform-session";
import { submitPlatformLogout } from "@/app/(platform)/platform/actions";

/**
 * The platform admin home (DR-006). Slice 4 shows who is signed in and a Log out button; slice 5
 * puts the stadiums list here. Dynamic: it reads the session cookie. Resolves no tenant.
 */
export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  await requirePlatformHost();
  const admin = await getCurrentPlatformAdmin();
  if (!admin) redirect("/platform/login");

  return (
    <main className="py-10">
      <Container className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{ui("platform.title", "en")}</h1>
      <p>{ui("platform.signedInAs", "en").replace("{identifier}", admin.identifier)}</p>
      <form action={submitPlatformLogout}>
        <SubmitButton variant="outline">{ui("platform.logOut", "en")}</SubmitButton>
      </form>
      </Container>
    </main>
  );
}
