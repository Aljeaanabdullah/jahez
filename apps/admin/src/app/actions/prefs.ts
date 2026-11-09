"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANG_COOKIE, THEME_COOKIE } from "@/lib/prefs";

const oneYear = 60 * 60 * 24 * 365;
const cookieOptions = { maxAge: oneYear, path: "/", sameSite: "lax" } as const;

// Each button sends the exact value it wants (not "toggle"), so repeated or
// overlapping clicks can never cancel each other out.

export async function setLanguage(formData: FormData) {
  const lang = formData.get("lang") === "en" ? "en" : "ar";
  (await cookies()).set(LANG_COOKIE, lang, cookieOptions);
  revalidatePath("/", "layout");
}

export async function setTheme(formData: FormData) {
  const theme = formData.get("theme") === "dark" ? "dark" : "light";
  (await cookies()).set(THEME_COOKIE, theme, cookieOptions);
  revalidatePath("/", "layout");
}
