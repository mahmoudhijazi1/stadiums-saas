import type { UiLocale } from "@/lib/locale";
import { plural, type PluralForms } from "@/lib/plural";

/**
 * Counted nouns. `{n}` is the number. Arabic has every PluralRules category.
 * English has `one` and `other`; `zero` is optional for a count of 0.
 */
const COUNTED: Record<string, Record<UiLocale, PluralForms>> = {
  "owner.games": {
    ar: {
      zero: "لا مباريات",
      one: "مباراة واحدة",
      two: "مباراتان",
      few: "{n} مباريات",
      many: "{n} مباراة",
      other: "{n} مباراة",
    },
    en: {
      zero: "No games",
      one: "{n} game",
      other: "{n} games",
    },
  },
  "owner.toCollectGames": {
    ar: {
      one: "مباراة واحدة للتحصيل",
      two: "مباراتان للتحصيل",
      few: "{n} مباريات للتحصيل",
      many: "{n} مباراة للتحصيل",
      other: "{n} مباراة للتحصيل",
    },
    en: {
      one: "{n} game to collect",
      other: "{n} games to collect",
    },
  },
  "owner.gamesPlayed": {
    ar: {
      zero: "لا مباريات لُعبت",
      one: "مباراة واحدة لُعبت",
      two: "مباراتان لُعبتا",
      few: "{n} مباريات لُعبت",
      many: "{n} مباراة لُعبت",
      other: "{n} مباراة لُعبت",
    },
    en: {
      zero: "No games played",
      one: "{n} game played",
      other: "{n} games played",
    },
  },
  "owner.gamesUpcoming": {
    ar: {
      one: "مباراة واحدة قادمة",
      two: "مباراتان قادمتان",
      few: "{n} مباريات قادمة",
      many: "{n} مباراة قادمة",
      other: "{n} مباراة قادمة",
    },
    en: {
      one: "{n} upcoming",
      other: "{n} upcoming",
    },
  },
  "owner.freeCount": {
    ar: {
      one: "{n} متاح",
      two: "{n} متاحان",
      few: "{n} متاحة",
      many: "{n} متاحة",
      other: "{n} متاحة",
    },
    en: {
      one: "{n} free",
      other: "{n} free",
    },
  },
  "owner.interested": {
    ar: {
      zero: "لا مهتمين",
      one: "مهتم واحد",
      two: "مهتمان",
      few: "{n} مهتمين",
      many: "{n} مهتماً",
      other: "{n} مهتم",
    },
    en: {
      one: "{n} person interested",
      other: "{n} people interested",
    },
  },
  "owner.hoursBefore": {
    ar: {
      one: "ألغى قبل ساعة",
      two: "ألغى قبل ساعتين",
      few: "ألغى قبل {n} ساعات",
      many: "ألغى قبل {n} ساعة",
      other: "ألغى قبل {n} ساعة",
    },
    en: {
      one: "Cancelled {n} hour before",
      other: "Cancelled {n} hours before",
    },
  },
  "owner.ruleHours": {
    ar: {
      one: "ساعة",
      two: "ساعتين",
      few: "{n} ساعات",
      many: "{n} ساعة",
      other: "{n} ساعة",
    },
    en: {
      one: "{n} hour",
      other: "{n} hours",
    },
  },
  "owner.requests": {
    ar: {
      zero: "لا طلبات",
      one: "طلب واحد",
      two: "طلبان",
      few: "{n} طلبات",
      many: "{n} طلباً",
      other: "{n} طلب",
    },
    en: {
      zero: "No requests",
      one: "{n} request",
      other: "{n} requests",
    },
  },
  "owner.requestsHidden": {
    ar: {
      one: "طلب آخر واحد غير معروض. عالج بعض الطلبات ليظهر.",
      two: "طلبان آخران غير معروضين. عالج بعض الطلبات لتظهر.",
      few: "{n} طلبات أخرى غير معروضة. عالج بعض الطلبات لتظهر.",
      many: "{n} طلباً آخر غير معروض. عالج بعض الطلبات لتظهر.",
      other: "{n} طلب آخر غير معروض. عالج بعض الطلبات لتظهر.",
    },
    en: {
      one: "{n} more request is not shown. Handle some to see it.",
      other: "{n} more requests are not shown. Handle some to see them.",
    },
  },
  "owner.spanMinutes": {
    ar: {
      one: "دقيقة",
      two: "دقيقتين",
      few: "{n} دقائق",
      many: "{n} دقيقة",
      other: "{n} دقيقة",
    },
    en: {
      one: "{n} minute",
      other: "{n} minutes",
    },
  },
  "owner.agoMinutes": {
    ar: {
      one: "قبل دقيقة",
      two: "قبل دقيقتين",
      few: "قبل {n} دقائق",
      many: "قبل {n} دقيقة",
      other: "قبل {n} دقيقة",
    },
    en: {
      one: "{n} minute ago",
      other: "{n} minutes ago",
    },
  },
  "owner.agoHours": {
    ar: {
      one: "قبل ساعة",
      two: "قبل ساعتين",
      few: "قبل {n} ساعات",
      many: "قبل {n} ساعة",
      other: "قبل {n} ساعة",
    },
    en: {
      one: "{n} hour ago",
      other: "{n} hours ago",
    },
  },
  "owner.agoDays": {
    ar: {
      two: "قبل يومين",
      few: "قبل {n} أيام",
      many: "قبل {n} يوماً",
      other: "قبل {n} يوم",
    },
    en: {
      other: "{n} days ago",
    },
  },
  "owner.noShows": {
    ar: {
      zero: "لا غيابات",
      one: "غياب واحد",
      two: "غيابان",
      few: "{n} غيابات",
      many: "{n} غياب",
      other: "{n} غياب",
    },
    en: {
      one: "{n} no-show",
      other: "{n} no-shows",
    },
  },
};

export function countedForms(key: string, locale: UiLocale): PluralForms | undefined {
  return COUNTED[key]?.[locale];
}

/** Counted noun for `locale`. Missing English forms fall back to Arabic rules. */
export function uiCount(key: string, count: number, locale: UiLocale = "ar"): string {
  const forms = COUNTED[key]?.[locale] ?? COUNTED[key]?.ar;
  if (!forms) return String(count);
  const rulesLocale = COUNTED[key]?.[locale] ? locale : "ar";
  return plural(rulesLocale, count, forms);
}
