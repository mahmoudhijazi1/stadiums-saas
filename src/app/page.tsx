
import { headers } from "next/headers";

export default async function Home() {
  const host = (await headers()).get("host")?.split(":")[0] ?? "";
  const domainParts = host.split(".");
  const subdomain =
    domainParts.length > 1 && domainParts[0] !== "www"
      ? domainParts[0]
      : "(none)";

  return <p>Subdomain: {subdomain}</p>;
}
