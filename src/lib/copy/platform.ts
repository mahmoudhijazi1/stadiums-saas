import type { CopyArea } from "./types";

/**
 * The platform admin (DR-006). The admin is English only: the page always asks for "en". The Arabic
 * table exists because every copy area carries both languages.
 */
export const platform: CopyArea = {
  ar: {
    "platform.title": "المنصة",
    "platform.loginTitle": "دخول المنصة",
    "platform.identifier": "المعرّف",
    "platform.password": "كلمة المرور",
    "platform.code": "رمز التحقق",
    "platform.signIn": "دخول",
    "platform.signedInAs": "مسجّل الدخول باسم {identifier}",
    "platform.logOut": "تسجيل الخروج",
  },
  en: {
    "platform.title": "Platform",
    "platform.loginTitle": "Platform sign-in",
    "platform.identifier": "Identifier",
    "platform.password": "Password",
    "platform.code": "6-digit code",
    "platform.signIn": "Sign in",
    "platform.signedInAs": "Signed in as {identifier}",
    "platform.logOut": "Log out",
  },
};
