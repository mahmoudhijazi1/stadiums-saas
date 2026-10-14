import {
  BOOKINGS_ADJUST_DUE,
  BOOKINGS_APPROVE,
  BOOKINGS_CANCEL,
  BOOKINGS_CREATE,
  BOOKINGS_EXTEND,
  EXPENSES_RECORD,
  PAYMENTS_COLLECT,
  PEOPLE_EDIT,
  REPORTS_VIEW,
  SETTINGS_MANAGE,
  SHOP_MANAGE,
  SHOP_SELL,
  can,
  type MembershipLike,
  type Permission,
} from "@/modules/access/domain/can";

/**
 * One Help topic. Its copy lives under `help.<id>.*` (title, what, where, step1..stepN, tip).
 * `permission` is the flag the topic's action needs, the same one its real screen checks; null
 * means every member. `href` is the real screen (null when there is none).
 */
export type HelpTopic = {
  id: string;
  permission: Permission | null;
  href: string | null;
  /** Numbered steps, 0 to 3: only when the screen does not make the action obvious. */
  steps: 0 | 1 | 2 | 3;
  /** One "Good to know" line for a real pitfall. */
  tip: boolean;
  /** Only when push notifications are configured (the More row hides otherwise). */
  needsPush?: boolean;
};

export type HelpGroup = { id: string; topics: HelpTopic[] };

/** Every group and topic of the Help page, in screen order. Each rule here was checked in the code. */
export const HELP_GROUPS: readonly HelpGroup[] = [
  {
    id: "bookings",
    topics: [
      { id: "approve", permission: BOOKINGS_APPROVE, href: "/owner/requests", steps: 0, tip: true },
      { id: "missed", permission: BOOKINGS_APPROVE, href: "/owner/requests", steps: 0, tip: false },
      { id: "interested", permission: null, href: "/owner/requests", steps: 0, tip: false },
      { id: "publicRequests", permission: SETTINGS_MANAGE, href: "/owner/more", steps: 0, tip: true },
      { id: "book", permission: BOOKINGS_CREATE, href: "/owner/book", steps: 0, tip: true },
    ],
  },
  {
    id: "today",
    topics: [
      { id: "todayScreen", permission: null, href: "/owner/today", steps: 0, tip: false },
      { id: "cancel", permission: BOOKINGS_CANCEL, href: "/owner/today", steps: 2, tip: true },
      { id: "extend", permission: BOOKINGS_EXTEND, href: "/owner/today", steps: 0, tip: true },
      { id: "adjust", permission: BOOKINGS_ADJUST_DUE, href: "/owner/today", steps: 2, tip: true },
    ],
  },
  {
    id: "weekly",
    topics: [
      { id: "makeWeekly", permission: BOOKINGS_CREATE, href: "/owner/today", steps: 3, tip: false },
      { id: "weeklyList", permission: BOOKINGS_CREATE, href: "/owner/more/weekly", steps: 0, tip: false },
      { id: "cancelRest", permission: BOOKINGS_CANCEL, href: "/owner/more/weekly", steps: 0, tip: true },
    ],
  },
  {
    id: "collect",
    topics: [
      { id: "collect", permission: PAYMENTS_COLLECT, href: "/owner/today", steps: 0, tip: false },
      { id: "split", permission: BOOKINGS_ADJUST_DUE, href: "/owner/today", steps: 2, tip: true },
      { id: "owed", permission: REPORTS_VIEW, href: "/owner/money/owed", steps: 0, tip: false },
    ],
  },
  {
    id: "shop",
    topics: [
      { id: "sell", permission: SHOP_SELL, href: "/owner/sell", steps: 0, tip: true },
      { id: "items", permission: SHOP_SELL, href: "/owner/today", steps: 0, tip: true },
      { id: "catalog", permission: SHOP_MANAGE, href: "/owner/more/shop", steps: 0, tip: true },
    ],
  },
  {
    id: "money",
    topics: [
      { id: "moneyPage", permission: REPORTS_VIEW, href: "/owner/money", steps: 0, tip: true },
      { id: "shopReport", permission: REPORTS_VIEW, href: "/owner/money/shop", steps: 0, tip: false },
      { id: "expense", permission: EXPENSES_RECORD, href: "/owner/money", steps: 0, tip: true },
    ],
  },
  {
    id: "players",
    topics: [
      { id: "search", permission: null, href: "/owner/search", steps: 0, tip: false },
      { id: "editPerson", permission: PEOPLE_EDIT, href: "/owner/search", steps: 0, tip: false },
    ],
  },
  {
    id: "stadium",
    topics: [
      { id: "info", permission: SETTINGS_MANAGE, href: "/owner/more/stadium", steps: 0, tip: true },
      { id: "pitches", permission: SETTINGS_MANAGE, href: "/owner/more/settings/pitches", steps: 0, tip: false },
      { id: "share", permission: SETTINGS_MANAGE, href: "/owner/more", steps: 2, tip: false },
      { id: "rate", permission: SETTINGS_MANAGE, href: "/owner/more", steps: 0, tip: true },
      { id: "rules", permission: SETTINGS_MANAGE, href: "/owner/more", steps: 0, tip: true },
    ],
  },
  {
    id: "phone",
    topics: [
      { id: "install", permission: null, href: null, steps: 3, tip: false },
      { id: "notifications", permission: null, href: "/owner/more", steps: 2, tip: true, needsPush: true },
    ],
  },
  {
    id: "account",
    topics: [
      { id: "account", permission: null, href: "/owner/more", steps: 0, tip: true },
      { id: "staff", permission: SETTINGS_MANAGE, href: null, steps: 0, tip: false },
    ],
  },
];

/** The groups and topics this member may use; a group with no topic left is dropped. */
export function visibleHelpGroups(
  membership: MembershipLike,
  options: { pushOn: boolean },
  groups: readonly HelpGroup[] = HELP_GROUPS,
): HelpGroup[] {
  return groups
    .map((group) => ({
      id: group.id,
      topics: group.topics.filter(
        (topic) =>
          (topic.permission === null || can(membership, topic.permission)) &&
          (!topic.needsPush || options.pushOn),
      ),
    }))
    .filter((group) => group.topics.length > 0);
}

/** Every copy key a topic uses (title, what, where when it has a screen, its steps, its tip). */
export function topicCopyKeys(topic: HelpTopic): string[] {
  const keys = [`help.${topic.id}.title`, `help.${topic.id}.what`];
  if (topic.href) keys.push(`help.${topic.id}.where`);
  for (let step = 1; step <= topic.steps; step += 1) keys.push(`help.${topic.id}.step${step}`);
  if (topic.tip) keys.push(`help.${topic.id}.tip`);
  return keys;
}
