"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import type { CustomerReportPayload } from "@/lib/reportTypes";

type Report = {
  id: string;
  vehicle_id: string;
  share_token: string | null;
  created_at: string;
  customer_report: CustomerReportPayload;
};

type ReportsResponse = {
  success: boolean;
  reports?: Report[];
  error?: string;
};

export default function ReportsClient() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/reports", {
        cache: "no-store",
      });

      const result: ReportsResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to load reports."
        );
      }

      setReports(result.reports ?? []);
    } catch (err) {
      console.error("Reports loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load reports."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReports();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadReports]);

  return (
    <main className="min-h-screen bg-gray-100">
      <AppHeader />

      <div className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-sm font-medium text-gray-500">
          Vehicle Intelligence
        </p>

        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Reports
            </h1>

            <p className="mt-2 text-gray-600">
              Customer reports your team has generated.
            </p>
          </div>

          {!loading && !error && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Total Reports
              </p>

              <p className="mt-1 text-xl font-bold text-gray-900">
                {reports.length}
              </p>
            </div>
          )}
        </div>

        {loading && (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="font-medium text-gray-700">
              Loading reports...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-xl border border-red-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Unable to load reports
            </h2>

            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={() => void loadReports()}
              className="mt-5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading &&
          !error &&
          reports.length === 0 && (
            <div className="mt-8 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                No reports yet
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Open a vehicle, generate an AI summary,
                then create a customer report — it&apos;ll
                show up here.
              </p>

              <Link
                href="/vehicles"
                className="mt-5 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              >
                Go to Vehicles
              </Link>
            </div>
          )}

        {!loading &&
          !error &&
          reports.length > 0 && (
            <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="divide-y divide-gray-100">
                {reports.map((report) => {
                  const customerReport =
                    report.customer_report ??
                    ({} as CustomerReportPayload);

                  const v = customerReport.vehicle ?? {
                    year: null,
                    make: null,
                    model: null,
                    trim: null,
                    vin: "",
                  };

                  const historyHighlights =
                    customerReport.history_highlights ?? {
                      theft_found: false,
                      odometer_available: false,
                    };

                  const title = [
                    v.year,
                    v.make,
                    v.model,
                    v.trim,
                  ]
                    .filter(
                      (value) =>
                        value !== null &&
                        value !== undefined &&
                        String(value).trim() !== ""
                    )
                    .join(" ");

                  const active = Boolean(
                    report.share_token
                  );

                  const reportUrl = report.share_token
                    ? `/report/${encodeURIComponent(
                        report.share_token
                      )}`
                    : null;

                  return (
                    <div
                      key={report.id}
                      className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {title || "Vehicle"}
                          </h3>

                          {historyHighlights.theft_found && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                              ⚠ Theft record
                            </span>
                          )}

                          {!historyHighlights.theft_found &&
                            historyHighlights.odometer_available && (
                              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200">
                                ✓ Odometer records
                              </span>
                            )}

                          {!active && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-gray-200">
                              Revoked
                            </span>
                          )}
                        </div>

                        <p className="mt-1 break-all font-mono text-xs text-gray-400">
                          VIN: {v.vin || "—"}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          Generated{" "}
                          {report.created_at
                            ? new Date(
                                report.created_at
                              ).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }
                              )
                            : "—"}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Link
                          href={
                            v.vin
                              ? `/vehicles/${encodeURIComponent(
                                  v.vin
                                )}`
                              : "/vehicles"
                          }
                          className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          Vehicle Page
                        </Link>

                        {active && reportUrl && (
                          <Link
                            href={reportUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                          >
                            View Report →
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </div>
    </main>
  );
}