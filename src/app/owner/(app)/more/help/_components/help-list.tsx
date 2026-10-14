import Link from "next/link";
import { ChevronDown, MessageCircle } from "lucide-react";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import type { HelpGroup, HelpTopic } from "@/app/owner/(app)/more/help/_components/topics";

/** Western digits in a sentence, each run LTR-isolated (30 minutes, 3 hours, 60 days). */
function WithNumbers({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\d+)/).map((part, index) =>
        /^\d+$/.test(part) ? <LtrIsolate key={index}>{part}</LtrIsolate> : part,
      )}
    </>
  );
}

/** One topic: a native disclosure, closed by default, so the page needs no client JavaScript. */
function Topic({ topic, locale }: { topic: HelpTopic; locale: UiLocale }) {
  const t = (suffix: string) => ui(`help.${topic.id}.${suffix}`, locale);
  const steps = Array.from({ length: topic.steps }, (_, index) => t(`step${index + 1}`));
  return (
    <li className="border-b last:border-b-0">
      <details id={`help-${topic.id}`} className="group">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          <span className="type-label">
            <WithNumbers text={t("title")} />
          </span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <p className="type-body">
            <WithNumbers text={t("what")} />
          </p>
          {topic.href ? (
            <p className="type-secondary">
              {ui("help.where", locale)}{" "}
              <Link href={topic.href} className="text-action-ink underline underline-offset-4">
                {t("where")}
              </Link>
            </p>
          ) : null}
          {steps.length > 0 ? (
            <ol className="flex list-decimal flex-col gap-1 ps-5 type-body">
              {steps.map((step) => (
                <li key={step}>
                  <WithNumbers text={step} />
                </li>
              ))}
            </ol>
          ) : null}
          {topic.tip ? (
            <p className="type-secondary">
              <span className="type-strong">{ui("help.goodToKnow", locale)}</span>{" "}
              <WithNumbers text={t("tip")} />
            </p>
          ) : null}
        </div>
      </details>
    </li>
  );
}

/**
 * The Help page body: the intro line, one section per group (the More list markup: a heading over
 * one bordered card), each topic a closed disclosure, and the WhatsApp support line at the end.
 */
export function HelpList({
  groups,
  locale,
  supportHref,
}: {
  groups: HelpGroup[];
  locale: UiLocale;
  /** The wa.me link to LebStads support, with a short message naming the stadium. */
  supportHref: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="type-secondary">{ui("help.intro", locale)}</p>
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`help-group-${group.id}`} className="flex flex-col gap-2">
          <h2 id={`help-group-${group.id}`} className="px-4 type-section">
            {ui(`help.group.${group.id}`, locale)}
          </h2>
          <ul className="overflow-hidden rounded-xl border bg-card">
            {group.topics.map((topic) => (
              <Topic key={topic.id} topic={topic} locale={locale} />
            ))}
          </ul>
        </section>
      ))}
      <a
        href={supportHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 py-2 outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <MessageCircle aria-hidden className="size-5 shrink-0 text-action-ink" />
        <span className="type-label">{ui("help.stuck", locale)}</span>
      </a>
    </div>
  );
}
