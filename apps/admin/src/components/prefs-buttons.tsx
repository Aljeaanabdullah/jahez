import { setLanguage, setTheme } from "@/app/actions/prefs";
import type { Dictionary, Lang, Theme } from "@/lib/i18n";

/** Language and light/dark switches. Plain forms, so they work without client JavaScript. */
export function PrefsButtons({ t, theme }: { t: Dictionary; theme: Theme }) {
  const otherLang: Lang = t.language === "English" ? "en" : "ar";
  const otherTheme: Theme = theme === "dark" ? "light" : "dark";
  const button =
    "rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary";
  return (
    <div className="flex items-center gap-2">
      <form action={setLanguage}>
        <input type="hidden" name="lang" value={otherLang} />
        <button type="submit" className={button}>
          {t.language}
        </button>
      </form>
      <form action={setTheme}>
        <input type="hidden" name="theme" value={otherTheme} />
        <button type="submit" className={button}>
          {otherTheme === "light" ? t.themeLight : t.themeDark}
        </button>
      </form>
    </div>
  );
}
