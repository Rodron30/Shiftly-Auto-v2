"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
};

type VehiclesResponse = {
  success: boolean;
  vehicles?: Vehicle[];
  count?: number;
  error?: string;
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/vehicles", {
        cache: "no-store",
      });

      const result: VehiclesResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load vehicles.");
      }

      setVehicles(result.vehicles ?? []);
    } catch (err) {
      console.error("Vehicles page error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load vehicles."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadVehicles();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadVehicles]);

  return (
    <main className="min-h-screen bg-gray-100">
      <AppHeader />

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Page Header */}
        <p className="text-sm font-medium text-gray-500">
          Vehicle Intelligence
        </p>

        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Vehicles
            </h1>

            <p className="mt-2 text-gray-600">
              Vehicle records available to your dealership.
            </p>
          </div>

          {!loading && !error && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
              {vehicles.length}{" "}
              {vehicles.length === 1 ? "vehicle" : "vehicles"}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-gray-700">
              Loading vehicles...
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Fetching the latest vehicle records.
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="mt-8 rounded-xl border border-red-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900">
              Unable to load vehicles
            </h2>

            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={loadVehicles}
              className="mt-5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && vehicles.length === 0 && (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <h2 className="font-semibold text-gray-900">
              No vehicles found
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              There are currently no vehicle records available.
            </p>
          </div>
        )}

        {/* Vehicles */}
        {!loading && !error && vehicles.length > 0 && (
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((vehicle) => {
              const vehicleName = [
                vehicle.year,
                vehicle.make,
                vehicle.model,
                vehicle.trim,
              ]
                .filter(Boolean)
                .join(" ");

              const details = [
                vehicle.body,
                vehicle.engine,
                vehicle.drivetrain,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <div
                  key={vehicle.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <h2 className="font-semibold text-gray-900">
                    {vehicleName}
                  </h2>

                  <p className="mt-2 break-all font-mono text-xs text-gray-500">
                    VIN: {vehicle.vin}
                  </p>

                  {details && (
                    <p className="mt-3 text-sm text-gray-500">
                      {details}
                    </p>
                  )}

                  <Link
                    href={`/vehicles/${encodeURIComponent(vehicle.vin)}`}
                    className="mt-5 inline-flex text-sm font-semibold text-gray-900 transition hover:underline"
                  >
                    View Vehicle →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}