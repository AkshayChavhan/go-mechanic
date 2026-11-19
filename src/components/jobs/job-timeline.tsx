import { CheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { JOB_STEPS, type JobStatus, type JobStep, jobStep } from "@/domain/jobs";
import type { Locale } from "@/i18n/config";
import { formatDate, formatTime } from "@/i18n/format";
import { cn } from "@/lib/utils";
import type { JobUpdateEntry } from "@/server/dal/jobs";

export type StepState = "done" | "current" | "upcoming";

/**
 * The steps a job shows, each done, current or to come:
 * - "Awaiting your approval" only when the job is there now or an update
 *   moved it there (most jobs never need an estimate);
 * - "In service" is left out once the job has passed it without going
 *   through it (inspection → ready, no work needed), so the customer is
 *   never told work was done that wasn't;
 * - a step before the current one is done, a later one is to come, so a job
 *   sent back from Ready to In service shows Ready as to come again;
 * - a completed job has every step done.
 */
export function jobSteps(
  jobStatus: JobStatus | null,
  updates: readonly Pick<JobUpdateEntry, "movedTo">[],
): { step: JobStep; state: StepState }[] {
  const current = jobStep(jobStatus);
  const visited = new Set(updates.map((update) => update.movedTo));
  const passed = (step: JobStep) => JOB_STEPS.indexOf(step) < JOB_STEPS.indexOf(current);
  const steps = JOB_STEPS.filter((step) => {
    if (step === current || visited.has(step as JobStatus)) return true;
    if (step === "awaiting-approval") return false;
    if (step === "in-service") return !passed(step);
    return true;
  });
  const at = steps.indexOf(current);
  return steps.map((step, index) => ({
    step,
    state: current === "completed" || index < at ? "done" : index === at ? "current" : "upcoming",
  }));
}

type JobTimelineProps = {
  /** The job's step: null while not started (Booked). */
  jobStatus: JobStatus | null;
  /** Oldest first, as readMyJobTimeline and readJob return them. */
  updates: readonly JobUpdateEntry[];
  locale: Locale;
};

/**
 * A job's progress (task 31): the steps, then the garage's updates, newest
 * first so a phone shows the latest without scrolling. Each update says when,
 * which step it moved to or happened during, its note (shown as plain text,
 * line breaks kept), and its photos. Task 25 shows it to the customer;
 * task 26 to the mechanic. Who made an update isn't shown: customers see
 * "the garage".
 */
export async function JobTimeline({ jobStatus, updates, locale }: JobTimelineProps) {
  const t = await getTranslations({ locale, namespace: "JobTimeline" });
  const steps = jobSteps(jobStatus, updates);
  const newestFirst = [...updates].reverse();

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        {/* No ids: a page may show several timelines (the design catalogue does). */}
        <h2 className="type-title">
          {t("stepsHeading")}
        </h2>
        <ol className="flex flex-col">
          {steps.map(({ step, state }, index) => (
            <li
              key={step}
              aria-current={state === "current" ? "step" : undefined}
              className="relative flex min-h-11 items-start gap-3 pb-4 last:pb-0"
            >
              {/* The line down to the next step. */}
              {index < steps.length - 1 && (
                <span aria-hidden className={cn("absolute top-6 bottom-0 left-2.75 w-0.5", state === "done" ? "bg-primary" : "bg-border")} />
              )}
              <span
                aria-hidden
                className={cn(
                  "relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                  state === "done" && "border-primary bg-primary text-primary-foreground",
                  state === "current" && "border-primary bg-background",
                  state === "upcoming" && "border-border bg-background",
                )}
              >
                {state === "done" && <CheckIcon className="size-3.5" strokeWidth={3} />}
                {state === "current" && <span className="size-2.5 rounded-full bg-primary" />}
              </span>
              <span className="flex flex-col">
                <span className={cn("type-body", state === "current" && "font-semibold", state === "upcoming" && "text-muted-foreground")}>
                  {t(`steps.${step}`)}
                </span>
                {/* Said in words, not by colour alone. */}
                <span className="type-caption text-muted-foreground">{t(`states.${state}`)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="type-title">
          {t("updatesHeading")}
        </h2>
        {newestFirst.length === 0 ? (
          <p className="type-body text-pretty text-muted-foreground">{t("noUpdates")}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {newestFirst.map((update) => (
              <li key={update.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
                <div className="flex flex-col gap-1">
                  <h3 className="type-body font-semibold">{updateHeading(update, t)}</h3>
                  <p className="type-callout text-muted-foreground">
                    <time dateTime={update.createdAt.toISOString()}>
                      {t("at", { date: formatDate(update.createdAt, locale), time: formatTime(update.createdAt, locale) })}
                    </time>
                  </p>
                </div>
                {update.note && <p className="type-body text-pretty break-words whitespace-pre-line">{update.note}</p>}
                {update.photos.length > 0 && (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {update.photos.map((photo, index) => (
                      <li key={photo.photoId} className="relative aspect-4/3 overflow-hidden rounded-xl bg-muted">
                        {/* A short-lived signed link from photo storage: next/image
                            can't optimise it. The box keeps its size if it fails. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt={t("photoAlt", { n: index + 1 })}
                          width={400}
                          height={300}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      </li>
                    ))}
                  </ul>
                )}
                {update.hadPhotos && update.photos.length === 0 && (
                  <p className="type-callout text-muted-foreground">{t("photosGone")}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type Translate = Awaited<ReturnType<typeof getTranslations<"JobTimeline">>>;

function updateHeading(update: JobUpdateEntry, t: Translate): string {
  if (update.movedTo) return t("movedTo", { step: t(`steps.${update.movedTo}`) });
  if (update.stepAfter) return t("updateDuring", { step: t(`steps.${update.stepAfter}`) });
  return t("updateBeforeStart");
}
