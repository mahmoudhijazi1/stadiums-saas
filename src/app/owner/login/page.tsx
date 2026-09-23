import { getCurrentTenant } from "@/lib/tenant-context";
import { errorMessage } from "@/lib/error-messages";
import { ui } from "@/lib/ui-copy";
import { submitLogin } from "@/app/owner/login/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { Container } from "@/components/ui/container";

/**
 * Thin login route. No Prisma and no tenantId.
 * Tenant comes from the host subdomain.
 * Always Arabic RTL — no locale toggle on this screen (cookie EN must not flip it).
 * Lives under /owner so the installed app stays inside the manifest scope.
 */
export default async function LoginPage({
  searchParams,
}: PageProps<"/owner/login">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : undefined;

  return (
    <main
      dir="rtl"
      lang="ar"
      className="flex min-h-svh flex-col justify-center py-10"
    >
      <Container className="flex flex-col gap-6">
      <Card className="w-full">
        <CardHeader className="gap-2">
          <CardTitle className="font-heading text-3xl leading-tight lg:text-4xl">
            {tenant.name}
          </CardTitle>
          <CardDescription className="text-base">
            {ui("login.title", "ar")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorKey ? (
            <p className="mb-6 text-sm text-destructive" role="alert">
              {errorMessage(errorKey, "ar")}
            </p>
          ) : null}
          <form action={submitLogin} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="identifier">{ui("login.identifier", "ar")}</Label>
              <Input
                id="identifier"
                type="text"
                name="identifier"
                required
                autoComplete="username"
                dir="ltr"
                className="text-start"
                placeholder="owner@ahmad"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{ui("login.password", "ar")}</Label>
              <Input
                id="password"
                type="password"
                name="password"
                required
                autoComplete="current-password"
                dir="ltr"
                className="text-start"
              />
            </div>
            <SubmitButton className="w-full">
              {ui("login.submit", "ar")}
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        <LtrIsolate>
          Powered by{" "}
          <a
            href="https://lebstads.com"
            className="underline-offset-2 hover:underline"
            rel="noopener noreferrer"
          >
            lebstads.com
          </a>
        </LtrIsolate>
      </p>
      </Container>
    </main>
  );
}
