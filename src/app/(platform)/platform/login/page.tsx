import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ui } from "@/lib/copy";
import { errorMessage } from "@/lib/copy/errors";
import { requirePlatformHost } from "@/lib/require-platform-host";
import { getCurrentPlatformAdmin } from "@/modules/platform/application/platform-session";
import { submitPlatformLogin } from "@/app/(platform)/platform/actions";

/** Only these two messages can be shown: nothing from the query string is echoed. */
const SHOWN_ERRORS = new Set(["platform.login_failed", "platform.login_blocked"]);

export const dynamic = "force-dynamic";

/**
 * The platform admin login (DR-006): identifier, password and the 6-digit code, one button, the
 * error under the form. Already signed in: straight to /platform. English only. Resolves no tenant.
 */
export default async function PlatformLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformHost();
  if (await getCurrentPlatformAdmin()) redirect("/platform");
  const params = await searchParams;
  const error = typeof params.error === "string" && SHOWN_ERRORS.has(params.error) ? params.error : undefined;

  return (
    <main className="flex min-h-svh flex-col justify-center py-10">
      <Container>
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl">{ui("platform.loginTitle", "en")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={submitPlatformLogin} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="identifier">{ui("platform.identifier", "en")}</Label>
                <Input id="identifier" name="identifier" type="text" required autoComplete="username" autoCapitalize="none" spellCheck={false} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{ui("platform.password", "en")}</Label>
                <Input id="password" name="password" type="password" required autoComplete="current-password" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">{ui("platform.code", "en")}</Label>
                <Input
                  id="code"
                  name="code"
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                />
              </div>
              <SubmitButton className="w-full">{ui("platform.signIn", "en")}</SubmitButton>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(error, "en")}
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </Container>
    </main>
  );
}
