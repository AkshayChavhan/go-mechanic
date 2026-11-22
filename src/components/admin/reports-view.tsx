import { DownloadIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  REPORT_DEFAULT_DAYS,
  REPORT_MAX_DAYS,
  REPORT_PRESETS,
  type ReportPeriod,
  type ReportPreset,
  reportQuery,
} from "@/domain/report-period";
import type { ReportCell, ReportName, ReportTable } from "@/domain/reports";
import type { Locale } from "@/i18n/config";
import { formatIndiaDate, formatNumber } from "@/i18n/format";
import { getPathname, Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type ReportsViewProps = {
  locale: Locale;
  period: ReportPeriod;
  /** Every report's table for the period, in the order the page shows them. */
  tables: readonly ReportTable[];
};

const presetKey = { 7: "last7", 30: "last30", 90: "last90" } as const satisfies Record<ReportPreset, string>;

/**
 * /admin/reports (task 41): the period picker, then one block per report
 * with its table and a CSV link. A Server Component: the period changes
 * through plain links and a GET form, so no staff data reaches a client
 * island and it works before the page's JavaScript loads. Rendered by the page's
 * gate, after the access check.
 */
export async function ReportsView({ locale, period, tables }: ReportsViewProps) {
  const t = await getTranslations({ locale, namespace: "AdminReports" });

  const cellText = (cell: ReportCell): string => {
    switch (cell.kind) {
      case "date":
        return formatIndiaDate(cell.value, locale);
      case "number":
        return formatNumber(cell.value, locale);
      case "average":
        return cell.value === null ? "" : formatNumber(cell.value, locale, 1);
      case "text":
        return cell.value;
      case "label":
        return t(`labels.${cell.value}`);
    }
  };

  const csvHref = (report: ReportName) =>
    getPathname({ href: { pathname: "/admin/reports/export", query: { report, ...reportQuery(period) } }, locale });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="type-headline text-balance">{t("heading")}</h1>
        <p className="type-body text-pretty text-muted-foreground">{t("intro")}</p>
      </div>

      <div className="flex flex-col gap-4">
        <p className="type-title">
          {t("covers", { from: formatIndiaDate(period.from, locale), to: formatIndiaDate(period.to, locale) })}
        </p>
        {period.note !== null && (
          <p role="status" className="max-w-2xl type-callout text-pretty text-muted-foreground">
            {t(`notes.${period.note}`, {
              days: formatNumber(REPORT_DEFAULT_DAYS, locale),
              max: formatNumber(REPORT_MAX_DAYS, locale),
            })}
          </p>
        )}
        <nav aria-label={t("periodLabel")} className="flex flex-wrap gap-3">
          {REPORT_PRESETS.map((days) => (
            <Button key={days} asChild variant={period.preset === days ? "secondary" : "outline"}>
              <Link
                href={{ pathname: "/admin/reports", query: { days: String(days) } }}
                aria-current={period.preset === days ? "page" : undefined}
              >
                {t(`presets.${presetKey[days]}`)}
              </Link>
            </Button>
          ))}
        </nav>

        {/* A plain GET form: the browser itself goes to ?from=...&to=..., no JavaScript needed.
            Keyed by the period, so the fields show the dates after a preset link. */}
        <form
          key={`${period.from}/${period.to}`}
          action={getPathname({ href: "/admin/reports", locale })}
          method="get"
          aria-label={t("custom.legend")}
          className="flex flex-wrap items-end gap-3"
        >
          <Field className="w-auto">
            <FieldLabel htmlFor="report-from">{t("custom.from")}</FieldLabel>
            <Input id="report-from" name="from" type="date" required defaultValue={period.from} />
          </Field>
          <Field className="w-auto">
            <FieldLabel htmlFor="report-to">{t("custom.to")}</FieldLabel>
            <Input id="report-to" name="to" type="date" required defaultValue={period.to} />
          </Field>
          {/* Grey: the page has no main action, so no blue button. */}
          <Button type="submit" variant="secondary">
            {t("custom.show")}
          </Button>
        </form>
      </div>

      {tables.map((table) => {
        const title = t(`reports.${table.report}.title`);
        const headingId = `report-${table.report}`;
        const captionId = `${headingId}-caption`;
        return (
          <section key={table.report} aria-labelledby={headingId} className="flex flex-col gap-3">
            <h2 id={headingId} className="type-title">
              {title}
            </h2>
            <p className="max-w-2xl type-callout text-pretty text-muted-foreground">
              {t(`reports.${table.report}.description`)}
            </p>
            {table.rows.length === 0 ? (
              <p className="type-body">{t("empty")}</p>
            ) : (
              <>
                {/* Wide tables scroll inside this box on a phone; it takes focus so a keyboard can scroll it. */}
                <div
                  role="region"
                  aria-labelledby={captionId}
                  tabIndex={0}
                  className="max-w-full overflow-x-auto rounded-xl bg-card"
                >
                  <table className="w-full type-callout">
                    <caption id={captionId} className="sr-only">
                      {title}
                    </caption>
                    <thead>
                      <tr>
                        {table.columns.map((column, index) => (
                          <th
                            key={column}
                            scope="col"
                            className={cn("px-4 py-3 font-semibold whitespace-nowrap", index === 0 ? "text-left" : "text-right")}
                          >
                            {t(`columns.${column}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, rowIndex) => (
                        <TableRow key={rowIndex} cells={row.map(cellText)} />
                      ))}
                    </tbody>
                    {table.footer.length > 0 && (
                      <tfoot>
                        {table.footer.map((row, rowIndex) => (
                          <TableRow key={rowIndex} cells={row.map(cellText)} strong />
                        ))}
                      </tfoot>
                    )}
                  </table>
                </div>
                <p>
                  {/* A plain link: the server's Content-Disposition makes it a download. */}
                  <a
                    href={csvHref(table.report)}
                    className="inline-flex min-h-11 items-center gap-2 type-body text-link underline-offset-4 hover:underline"
                  >
                    <DownloadIcon aria-hidden className="size-4" />
                    {t("download", { report: title })}
                  </a>
                </p>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** One row: the first cell names the row (a day, a service, a mechanic), the rest are numbers. `strong` for a totals row. */
function TableRow({ cells, strong = false }: { cells: string[]; strong?: boolean }) {
  return (
    <tr className={cn("border-t border-border", strong ? "font-semibold" : "font-normal")}>
      {cells.map((text, index) =>
        index === 0 ? (
          <th key={index} scope="row" className="px-4 py-3 text-left whitespace-nowrap">
            {text}
          </th>
        ) : (
          <td key={index} className="px-4 py-3 text-right tabular-nums">
            {text}
          </td>
        ),
      )}
    </tr>
  );
}
