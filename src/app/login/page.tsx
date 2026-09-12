import { getCurrentTenant } from "@/lib/tenant-context";
import { errorMessage } from "@/lib/error-messages";
import { ui } from "@/lib/ui-copy";
import { submitLogin } from "@/app/login/actions";
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

/**
 * Thin login route. No Prisma and no tenantId.
 * Hidden tenant slug only keeps local ?tenant= after redirect.
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : undefined;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-10">
      <Card className="w-full max-w-sm shrink-0">
        <CardHeader className="gap-1">
          <CardTitle className="font-heading text-2xl">
            {ui("login.title")}
          </CardTitle>
          <CardDescription>
            {tenant.name}
            <LtrIsolate className="mt-1 block text-xs">{tenant.slug}</LtrIsolate>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorKey ? (
            <p className="mb-6 text-sm text-destructive" role="alert">
              {errorMessage(errorKey)}
            </p>
          ) : null}
          <form action={submitLogin} className="flex flex-col gap-6">
            <input type="hidden" name="tenant" value={tenant.slug} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="identifier">{ui("login.identifier")}</Label>
              <Input
                id="identifier"
                type="text"
                name="identifier"
                required
                autoComplete="username"
                placeholder="owner@ahmad"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{ui("login.password")}</Label>
              <Input
                id="password"
                type="password"
                name="password"
                required
                autoComplete="current-password"
              />
            </div>
            <SubmitButton className="w-full">
              {ui("login.submit")}
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
