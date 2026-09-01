"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";

type Vehicle = {
  id: string;
  dealership_id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  body: string | null;
  engine: string | null;
  drivetrain: string | null;
  fuel: string | null;
};

type VehicleResponse = {
  success: boolean;
  vehicle?: Vehicle;
  error?: string;
  vin?: string;
};

type HistoryEvent = {
  id: string;
  event_date: string | null;
  event_type?: "THEFT" | "ODOMETER" | "OTHER";
  description: string | null;
  location: string | null;
  odometer: number | null;
  source: string;
  created_at?: string;
};

type HistoryResponse = {
  success: boolean;
  status?: "VEHICLE_NOT_SAVED" | "CHECKED";
  theft?: HistoryEvent[];
  odometer?: HistoryEvent[];
  odometerAnomaly?: boolean;
  error?: string;
};

type AiSummary = {
  quick_summary: string;
  salesperson_explanation: string;
  customer_summary: string;
  warnings: string[];
  facts: string[];
};

export default function VehicleDetailsPage() {
  const params = useParams<{ vin: string }>();

  const vin = Array.isArray(params?.vin)
    ? params.vin[0]
    : params?.vin;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [history, setHistory] =
    useState<HistoryResponse | null>(null);

  const [historyLoading, setHistoryLoading] =
    useState(true);

  const [historyError, setHistoryError] =
    useState("");

  const [aiSummary, setAiSummary] =
    useState<AiSummary | null>(null);

  const [aiLoading, setAiLoading] =
    useState(false);

  const [aiError, setAiError] =
    useState("");

  const [reportUrl, setReportUrl] =
    useState<string | null>(null);

  const [reportLoading, setReportLoading] =
    useState(false);

  const [reportError, setReportError] =
    useState("");

  const [copied, setCopied] =
    useState(false);

  const [showAddEvent, setShowAddEvent] =
    useState(false);

  const [newEventType, setNewEventType] =
    useState<"THEFT" | "ODOMETER">("THEFT");

  const [newEventDate, setNewEventDate] =
    useState("");

  const [newEventDescription, setNewEventDescription] =
    useState("");


  const [newEventOdometer, setNewEventOdometer] =
    useState("");

  const [addEventLoading, setAddEventLoading] =
    useState(false);

  const [addEventError, setAddEventError] =
    useState("");

  async function refreshHistory() {
    if (!vin) return;

    try {
      setHistoryLoading(true);
      setHistoryError("");

      const normalizedVin = decodeURIComponent(vin)
        .trim()
        .toUpperCase();

      const response = await fetch(
        `/api/history/${encodeURIComponent(normalizedVin)}`,
        {
          cache: "no-store",
        }
      );

      const result: HistoryResponse =
        await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to load vehicle history."
        );
      }

      setHistory(result);
    } catch (err) {
      console.error(
        "Vehicle history error:",
        err
      );

      setHistoryError(
        err instanceof Error
          ? err.message
          : "Failed to load history."
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (!vin) return;

    async function loadVehicle() {
      try {
        setLoading(true);
        setError("");

        const normalizedVin = decodeURIComponent(vin)
          .trim()
          .toUpperCase();

        const response = await fetch(
          `/api/vehicles/${encodeURIComponent(normalizedVin)}`,
          {
            cache: "no-store",
          }
        );

        const result: VehicleResponse =
          await response.json();

        if (
          !response.ok ||
          !result.success ||
          !result.vehicle
        ) {
          throw new Error(
            result.error ||
              "Vehicle not found."
          );
        }

        setVehicle(result.vehicle);
      } catch (err) {
        console.error(
          "Vehicle details error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load vehicle."
        );
      } finally {
        setLoading(false);
      }
    }

    const loadVehicleData = async () => {
      await loadVehicle();
      await refreshHistory();
    };

    void loadVehicleData();
  }, [vin]);

  const handleGenerateAiSummary = async () => {
    if (!vehicle || !history) return;

    try {
      setAiLoading(true);
      setAiError("");

      const response = await fetch(
        "/api/ai/summarize",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vehicle: {
              year: vehicle.year,
              make: vehicle.make,
              model: vehicle.model,
              trim: vehicle.trim,
            },
            history: {
              theft: history.theft ?? [],
              odometer:
                history.odometer ?? [],
            },
            vehicleId: vehicle.id,
            odometerAnomaly:
              history.odometerAnomaly ?? false,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to generate AI summary."
        );
      }

      setAiSummary(result.summary);
      setReportUrl(null);
    } catch (err) {
      console.error(
        "AI summary error:",
        err
      );

      setAiError(
        err instanceof Error
          ? err.message
          : "Failed to generate AI summary."
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateReport = async () => {
    if (!vehicle || !aiSummary) return;

    try {
      setReportLoading(true);
      setReportError("");
      setCopied(false);

      const response = await fetch(
        "/api/reports",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vehicleId: vehicle.id,
            aiSummary,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to create report."
        );
      }

      const url =
        `${window.location.origin}` +
        `/report/${result.report.share_token}`;

      setReportUrl(url);
    } catch (err) {
      console.error(
        "Report creation error:",
        err
      );

      setReportError(
        err instanceof Error
          ? err.message
          : "Failed to create report."
      );
    } finally {
      setReportLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!reportUrl) return;

    try {
      await navigator.clipboard.writeText(
        reportUrl
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard API may fail silently.
    }
  };

  const handleRevokeReport = async () => {
    if (!reportUrl) return;

    const token =
      reportUrl.split("/report/")[1];

    if (!token) return;

    try {
      setReportLoading(true);
      setReportError("");

      const response = await fetch(
        `/api/reports/${encodeURIComponent(token)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to revoke report."
        );
      }

      setReportUrl(null);
    } catch (err) {
      setReportError(
        err instanceof Error
          ? err.message
          : "Failed to revoke report."
      );
    } finally {
      setReportLoading(false);
    }
  };

  const handleAddEvent = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!vin) return;

    setAddEventError("");

    if (
      newEventType === "ODOMETER" &&
      !newEventOdometer
    ) {
      setAddEventError(
        "Enter an odometer reading."
      );
      return;
    }

    try {
      setAddEventLoading(true);

      const normalizedVin =
        decodeURIComponent(vin)
          .trim()
          .toUpperCase();

      const response = await fetch(
        `/api/history/${encodeURIComponent(normalizedVin)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventType: newEventType,

            eventDate:
              newEventDate || null,

            description:
              newEventDescription.trim() || null,


            /*
             * The input displays 45,000,
             * but Supabase receives 45000.
             */
            odometer:
              newEventType === "ODOMETER" &&
              newEventOdometer
                ? Number(
                    newEventOdometer.replace(
                      /,/g,
                      ""
                    )
                  )
                : null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to save history record."
        );
      }

      setShowAddEvent(false);

      setNewEventDate("");
      setNewEventDescription("");
      setNewEventOdometer("");
      setAddEventError("");

      await refreshHistory();
    } catch (err) {
      console.error(
        "Add history event error:",
        err
      );

      setAddEventError(
        err instanceof Error
          ? err.message
          : "Failed to save history record."
      );
    } finally {
      setAddEventLoading(false);
    }
  };

  /*
   * Odometer input formatter.
   *
   * Example:
   * 45000 -> 45,000
   * 100000 -> 100,000
   *
   * Only digits are accepted.
   */
  const handleOdometerChange = (
    value: string
  ) => {
    const raw = value.replace(/\D/g, "");

    if (!raw) {
      setNewEventOdometer("");
      return;
    }

    setNewEventOdometer(
      Number(raw).toLocaleString("en-US")
    );
  };

  const theftEvents =
    history?.theft ?? [];

  const odometerEvents =
    history?.odometer ?? [];

  const hasTheft =
    theftEvents.length > 0;

  const hasOdometer =
    odometerEvents.length > 0;

  return (
    <main className="min-h-screen bg-gray-100">
      <AppHeader />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/vehicles"
          className="text-sm font-semibold text-gray-600 hover:text-gray-900"
        >
          ← Back to Vehicles
        </Link>

        {loading && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-gray-700">
              Loading vehicle...
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Fetching vehicle information.
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-gray-900">
              Unable to load vehicle
            </h1>

            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>

            <Link
              href="/vehicles"
              className="mt-5 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Back to Vehicles
            </Link>
          </div>
        )}

        {!loading &&
          !error &&
          vehicle && (
            <>
              {/* Vehicle Header */}
              <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-gray-500">
                  Vehicle Intelligence
                </p>

                <h1 className="mt-1 text-3xl font-bold text-gray-900">
                  {vehicle.year}{" "}
                  {vehicle.make}{" "}
                  {vehicle.model}
                </h1>

                {vehicle.trim && (
                  <p className="mt-1 text-lg text-gray-500">
                    {vehicle.trim}
                  </p>
                )}

                <div className="mt-5 rounded-lg bg-gray-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    VIN
                  </p>

                  <p className="mt-1 break-all font-mono text-sm text-gray-800">
                    {vehicle.vin}
                  </p>
                </div>
              </div>

              {/* Vehicle Information */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoCard
                  label="Year"
                  value={vehicle.year}
                />

                <InfoCard
                  label="Make"
                  value={vehicle.make}
                />

                <InfoCard
                  label="Model"
                  value={vehicle.model}
                />

                <InfoCard
                  label="Trim"
                  value={vehicle.trim || "—"}
                />

                <InfoCard
                  label="Body"
                  value={vehicle.body || "—"}
                />

                <InfoCard
                  label="Drivetrain"
                  value={
                    vehicle.drivetrain || "—"
                  }
                />

                <InfoCard
                  label="Fuel"
                  value={vehicle.fuel || "—"}
                />

                {/* Engine */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:col-span-2 lg:col-span-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Engine
                  </p>

                  <p className="mt-2 text-lg font-semibold text-gray-900">
                    {vehicle.engine || "—"}
                  </p>
                </div>
              </div>

              {/* Vehicle Status */}
              <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="font-semibold text-gray-900">
                  Vehicle Status
                </h2>

                {historyLoading && (
                  <p className="mt-3 text-sm text-gray-500">
                    Checking available history...
                  </p>
                )}

                {!historyLoading &&
                  historyError && (
                    <p className="mt-3 text-sm text-red-600">
                      {historyError}
                    </p>
                  )}

                {!historyLoading &&
                  !historyError &&
                  history && (
                    <ul className="mt-4 space-y-2 text-sm">
                      <li
                        className={
                          hasTheft
                            ? "flex items-center gap-2 text-amber-700"
                            : "flex items-center gap-2 text-green-700"
                        }
                      >
                        <span>
                          {hasTheft
                            ? "⚠"
                            : "✓"}
                        </span>

                        <span>
                          {hasTheft
                            ? "Theft-related record found"
                            : "No theft-related record was found in the available data"}
                        </span>
                      </li>

                      <li className="flex items-center gap-2 text-gray-700">
                        <span>
                          {hasOdometer
                            ? "✓"
                            : "–"}
                        </span>

                        <span>
                          {hasOdometer
                            ? "Odometer records available"
                            : "No odometer records available"}
                        </span>
                      </li>

                      {history.odometerAnomaly && (
                        <li className="flex items-center gap-2 text-amber-700">
                          <span>⚠</span>

                          <span>
                            Odometer Pattern Requires
                            Review
                          </span>
                        </li>
                      )}
                    </ul>
                  )}

                <div className="mt-4 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      setShowAddEvent(
                        (v) => !v
                      )
                    }
                    className="text-sm font-semibold text-gray-700 hover:text-gray-900"
                  >
                    {showAddEvent
                      ? "Cancel"
                      : "+ Add History Record"}
                  </button>

                  {showAddEvent && (
                    <form
                      onSubmit={handleAddEvent}
                      className="mt-3 space-y-3"
                    >
                      <p className="text-xs text-gray-500">
                        No commercial vehicle-history
                        provider is connected yet.
                        Records added here are tagged
                        &quot;Manual Entry
                        (Dealer)&quot;.
                      </p>

                      <div className="flex gap-3">
                        <label className="flex items-center gap-1.5 text-sm">
                          <input
                            type="radio"
                            checked={
                              newEventType ===
                              "THEFT"
                            }
                            onChange={() => {
                              setNewEventType(
                                "THEFT"
                              );
                              setNewEventOdometer("");
                            }}
                          />

                          Theft
                        </label>

                        <label className="flex items-center gap-1.5 text-sm">
                          <input
                            type="radio"
                            checked={
                              newEventType ===
                              "ODOMETER"
                            }
                            onChange={() => {
                              setNewEventType(
                                "ODOMETER"
                              );
                                                    }}
                          />

                          Odometer
                        </label>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-500">
                            Date
                          </label>

                          <input
                            type="date"
                            value={
                              newEventDate
                            }
                            onChange={(e) =>
                              setNewEventDate(
                                e.target.value
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                          />
                        </div>

                        {newEventType ===
                        "ODOMETER" && (
                          <div>
                            <label className="block text-xs font-medium text-gray-500">
                              Odometer (km)
                            </label>

                            <input
                              type="text"
                              inputMode="numeric"
                              required
                              value={
                                newEventOdometer
                              }
                              onChange={(e) =>
                                handleOdometerChange(
                                  e.target.value
                                )
                              }
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500">
                          Description
                        </label>

                        <input
                          type="text"
                          placeholder={
                            newEventType ===
                            "THEFT"
                              ? "Theft-related description"
                              : "Optional note"
                          }
                          value={
                            newEventDescription
                          }
                          onChange={(e) =>
                            setNewEventDescription(
                              e.target.value
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                        />
                      </div>

                      {addEventError && (
                        <p className="text-sm text-red-600">
                          {addEventError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={
                          addEventLoading
                        }
                        className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {addEventLoading
                          ? "Saving..."
                          : "Save Record"}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* History */}
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {/* Theft History */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="font-semibold text-gray-900">
                    Theft History
                  </h2>

                  {!historyLoading &&
                    !hasTheft && (
                      <p className="mt-3 text-sm text-gray-500">
                        No theft-related record was
                        found in the available data.
                      </p>
                    )}

                  {hasTheft && (
                    <ul className="mt-4 space-y-3">
                      {theftEvents.map(
                        (event) => (
                          <li
                            key={event.id}
                            className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-amber-900">
                                {event.description ||
                                  "Theft-related record"}
                              </p>

                              <ConfidenceTag
                                source={
                                  event.source
                                }
                              />
                            </div>

                            <p className="mt-1 text-xs text-amber-700">
                              {event.event_date
                                ? new Date(
                                    event.event_date
                                  ).toLocaleDateString()
                                : "Date not provided"}

                              {event.location
                                ? ` · ${event.location}`
                                : ""}
                            </p>

                            <p className="mt-1 text-xs text-amber-600">
                              Source:{" "}
                              {event.source}
                            </p>
                          </li>
                        )
                      )}
                    </ul>
                  )}
                </div>

                {/* Odometer History */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="font-semibold text-gray-900">
                    Odometer History
                  </h2>

                  {!historyLoading &&
                    !hasOdometer && (
                      <p className="mt-3 text-sm text-gray-500">
                        No odometer records were
                        returned by the connected data
                        source.
                      </p>
                    )}

                  {hasOdometer && (
                    <ol className="mt-4 space-y-2 text-sm">
                      {odometerEvents.map(
                        (event) => (
                          <li
                            key={event.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2"
                          >
                            <span className="text-gray-700">
                              {event.event_date
                                ? new Date(
                                    event.event_date
                                  ).toLocaleDateString()
                                : "—"}
                            </span>

                            <span className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {event.odometer != null
                                  ? event.odometer.toLocaleString(
                                      "en-US"
                                    )
                                  : "—"}{" "}
                                km
                              </span>

                              <ConfidenceTag
                                source={
                                  event.source
                                }
                              />
                            </span>
                          </li>
                        )
                      )}
                    </ol>
                  )}
                </div>
              </div>

              {/* AI Analysis */}
              <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      AI Analysis
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Turns the raw history above into a
                      plain-language explanation, without
                      adding facts beyond what was found.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      handleGenerateAiSummary
                    }
                    disabled={
                      aiLoading ||
                      historyLoading
                    }
                    className="shrink-0 rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {aiLoading
                      ? "Generating..."
                      : "Generate AI Summary"}
                  </button>
                </div>

                {aiError && (
                  <p className="mt-4 text-sm text-red-600">
                    {aiError}
                  </p>
                )}

                {aiSummary && (
                  <div className="mt-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 ring-1 ring-purple-200">
                        AI Interpretation
                      </span>

                      <span className="text-xs text-gray-400">
                        Explains the source facts above —
                        not a source fact itself.
                      </span>
                    </div>

                    <div className="rounded-lg bg-gray-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Quick Summary
                      </p>

                      <p className="mt-1 text-sm text-gray-800">
                        {
                          aiSummary.quick_summary
                        }
                      </p>
                    </div>

                    <div className="rounded-lg bg-gray-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Salesperson Explanation
                      </p>

                      <p className="mt-1 text-sm text-gray-800">
                        {
                          aiSummary.salesperson_explanation
                        }
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Customer-Friendly Summary
                      </p>

                      <p className="mt-1 text-sm text-gray-800">
                        {
                          aiSummary.customer_summary
                        }
                      </p>
                    </div>

                    {aiSummary.warnings.length >
                      0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                          Warnings
                        </p>

                        <ul className="mt-1 list-inside list-disc text-sm text-amber-800">
                          {aiSummary.warnings.map(
                            (
                              warning,
                              i
                            ) => (
                              <li key={i}>
                                {warning}
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                    <p className="text-xs text-gray-400">
                      Generated by AI from the
                      vehicle-history records shown above.
                      This does not replace an independent
                      vehicle inspection or the original
                      source documentation.
                    </p>
                  </div>
                )}
              </div>

              {/* Customer Report */}
              {aiSummary && (
                <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="font-semibold text-gray-900">
                    Customer Report
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Creates a professional, shareable
                    report the customer can open without a
                    dealership login, and download as a PDF.
                  </p>

                  <button
                    type="button"
                    onClick={
                      handleCreateReport
                    }
                    disabled={reportLoading}
                    className="mt-4 rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {reportLoading
                      ? "Creating report..."
                      : reportUrl
                        ? "Regenerate Report"
                        : "Create Customer Report"}
                  </button>

                  {reportError && (
                    <p className="mt-3 text-sm text-red-600">
                      {reportError}
                    </p>
                  )}

                  {reportUrl && (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3 sm:flex-row sm:items-center">
                        <input
                          readOnly
                          value={reportUrl}
                          onFocus={(e) =>
                            e.target.select()
                          }
                          className="flex-1 truncate rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                        />

                        <button
                          type="button"
                          onClick={
                            handleCopyLink
                          }
                          className="shrink-0 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                        >
                          {copied
                            ? "Copied!"
                            : "Copy Link"}
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <a
                          href={reportUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                        >
                          View Report
                        </a>

                        <a
                          href={`${reportUrl.replace(
                            "/report/",
                            "/api/reports/"
                          )}/pdf`}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                        >
                          Download PDF
                        </a>

                        <button
                          type="button"
                          onClick={
                            handleRevokeReport
                          }
                          disabled={
                            reportLoading
                          }
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Revoke Link
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
      </div>
    </main>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-2 text-lg font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function ConfidenceTag({
  source,
}: {
  source: string;
}) {
  const isManual =
    source === "Manual Entry (Dealer)";

  return (
    <span
      className={
        isManual
          ? "shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 ring-1 ring-blue-200"
          : "shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 ring-1 ring-gray-200"
      }
    >
      {isManual
        ? "Manual Entry"
        : "Source Confirmed"}
    </span>
  );
}




