"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    let mounted = true;

    const initializeRecoverySession = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (sessionError) {
        console.error(
          "Password recovery session error:",
          sessionError
        );

        setError(
          "Could not load the password recovery session. Please request a new reset link."
        );

        setCheckingSession(false);
        return;
      }

      if (session) {
        setReady(true);
        setCheckingSession(false);
        return;
      }

      setCheckingSession(false);
    };

    initializeRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log(
          "Password recovery auth event:",
          event
        );

        if (
          event === "PASSWORD_RECOVERY" &&
          session
        ) {
          setReady(true);
          setCheckingSession(false);
        }

        if (
          event === "SIGNED_IN" &&
          session
        ) {
          setReady(true);
          setCheckingSession(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!ready) {
      setError(
        "Your password recovery session is not ready. Please open the latest password reset link from your email."
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase =
        createSupabaseBrowserClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError(
          "Your password recovery session has expired. Please request a new reset link."
        );
        return;
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        console.error(
          "Password update error:",
          updateError
        );

        setError(updateError.message);
        return;
      }

      setSuccess(
        "Your password has been updated successfully."
      );

      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 1200);
    } catch (err) {
      console.error(
        "Unexpected password update error:",
        err
      );

      setError(
        "Something went wrong while updating your password. Please request a new reset link and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Reset Password
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Create a new password for your Shiftly Auto
            account.
          </p>
        </div>

        {checkingSession && (
          <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
            Checking your password recovery session...
          </div>
        )}

        {!checkingSession && !ready && !error && (
          <div className="mt-8 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-3 text-sm text-yellow-800">
            Open this page using the password reset link
            sent to your email.
          </div>
        )}

        <form
          onSubmit={handleUpdatePassword}
          className="mt-8 space-y-4"
        >
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              New Password
            </label>

            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 outline-none focus:border-black"
            />

            <p className="mt-1 text-xs text-gray-400">
              Minimum 8 characters.
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700"
            >
              Confirm Password
            </label>

            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 outline-none focus:border-black"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {success && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              checkingSession ||
              !ready
            }
            className="w-full rounded-lg bg-black py-2.5 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading
              ? "Updating password..."
              : "Update Password"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Remember your password?{" "}
          <a
            href="/login"
            className="font-semibold text-gray-900 hover:underline"
          >
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
