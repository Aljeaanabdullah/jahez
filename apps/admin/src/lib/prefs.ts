import "server-only";
import { cookies } from "next/headers";
import { dictionaries, type Lang, type Theme } from "./i18n";

export const LANG_COOKIE = "jahez_lang";
export const THEME_COOKIE = "jahez_theme";

/** Language and theme chosen by the user, remembered in cookies. Arabic + light by default. */
export async function getPrefs() {
  const store = await cookies();
  const lang: Lang = store.get(LANG_COOKIE)?.value === "en" ? "en" : "ar";
  const theme: Theme = store.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
  return { lang, theme, dir: lang === "ar" ? "rtl" : "ltr", t: dictionaries[lang] } as const;
}
