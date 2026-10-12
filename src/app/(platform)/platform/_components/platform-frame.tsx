import { SubmitButton } from "@/components/ui/submit-button";
import { ui } from "@/lib/copy";

/**
 * The frame of every signed-in platform page (DR-006): a centred column of at most 720px (phone
 * first), the signed-in line and the Log out button. The page passes the logout Server Action.
 */
export function PlatformFrame({
  identifier,
  logout,
  children,
}: {
  identifier: string;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-muted-foreground">
          {ui("platform.signedInAs", "en").replace("{identifier}", identifier)}
        </p>
        <form action={logout}>
          <SubmitButton variant="outline" size="sm" className="min-h-11 shrink-0">
            {ui("platform.logOut", "en")}
          </SubmitButton>
        </form>
      </header>
      {children}
    </main>
  );
}
