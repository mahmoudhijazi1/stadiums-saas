"use server";

import { actionErrorKey } from "@/lib/use-case-error";
import { saveStadiumInfo } from "@/modules/platform/application/stadium-info";
import { field, redirectOwner } from "@/app/owner/form-query";

const PATH = "/owner/more/stadium";

/**
 * Thin action: the form fields go to the use case, which validates (names the key of the first
 * problem), authorizes (settings.manage) and saves. The tenant is the host's, never a field.
 * redirect() outside try/catch (it throws).
 */
export async function submitStadiumInfo(formData: FormData) {
  let errorKey: string | undefined;
  try {
    await saveStadiumInfo({
      name: field(formData, "name"),
      address: field(formData, "address"),
      mapLink: field(formData, "mapLink"),
      phone: field(formData, "phone"),
      whatsappSame: formData.get("whatsappSame") === "true",
      whatsapp: field(formData, "whatsapp"),
      brandPreset: field(formData, "brandPreset"),
    });
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitStadiumInfo");
  }
  if (errorKey) {
    redirectOwner(PATH, formData, [], { error: errorKey });
  }
  redirectOwner(PATH, formData, [], { ok: "stadium_saved" });
}
