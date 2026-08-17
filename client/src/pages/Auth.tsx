import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Orbit,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

function safeNextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function Auth() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false });

  const redirectAfterAuth = (user: unknown) => {
    utils.auth.me.setData(undefined, user as any);
    toast.success(
      mode === "signup" ? "Your NICA account is ready." : "Welcome back."
    );
    setLocation(safeNextPath());
  };

  const signIn = trpc.auth.signIn.useMutation({
    onSuccess: result => redirectAfterAuth(result.user),
    onError: error => toast.error(error.message || "Unable to sign in"),
  });
  const signUp = trpc.auth.signUp.useMutation({
    onSuccess: result => redirectAfterAuth(result.user),
    onError: error =>
      toast.error(error.message || "Unable to create your account"),
  });

  useEffect(() => {
    if (meQuery.data) setLocation(safeNextPath());
  }, [meQuery.data, setLocation]);

  const isPending = signIn.isPending || signUp.isPending;
  const submitError = signIn.error?.message || signUp.error?.message;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "signup" && password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (mode === "signup") {
      signUp.mutate({ name, email, password });
    } else {
      signIn.mutate({ email, password });
    }
  };

  const switchMode = (nextMode: "signin" | "signup") => {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    signIn.reset();
    signUp.reset();
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070812] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(124,58,237,0.30),transparent_32%),radial-gradient(circle_at_86%_12%,rgba(34,211,238,0.20),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(245,158,11,0.12),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full border border-violet-300/20 shadow-[0_0_90px_rgba(139,92,246,0.25)]"
        animate={{ rotate: 360, scale: [1, 1.08, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-8 h-96 w-96 rounded-full border border-cyan-200/20 shadow-[0_0_110px_rgba(34,211,238,0.20)]"
        animate={{ rotate: -360, scale: [1, 0.94, 1] }}
        transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-5 py-8 sm:px-8 lg:px-12">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
          <motion.section
            initial={{ opacity: 0, x: -22 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55 }}
            className="hidden min-h-[620px] flex-col justify-between rounded-[2rem] border border-white/10 bg-white/[0.035] p-8 shadow-2xl shadow-violet-950/20 backdrop-blur-2xl lg:flex xl:p-12"
          >
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-3 text-sm font-semibold tracking-[0.2em] text-white/70 transition hover:text-white"
              >
                <span className="grid size-10 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-[0_0_32px_rgba(139,92,246,0.3)]">
                  <Orbit className="size-5 text-cyan-200" />
                </span>
                NICA KIBUGU
              </Link>
              <div className="mt-24 max-w-xl">
                <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/[0.07] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
                  <Sparkles className="size-3.5" /> A quiet space for belonging
                </p>
                <h1 className="font-display text-5xl font-semibold leading-[0.98] tracking-[-0.06em] text-white xl:text-7xl">
                  Gather in grace.
                  <span className="block bg-gradient-to-r from-violet-200 via-cyan-100 to-amber-100 bg-clip-text text-transparent">
                    Move with purpose.
                  </span>
                </h1>
                <p className="mt-7 max-w-md text-base leading-7 text-white/55">
                  Your account keeps your prayer journeys, journals, trusted
                  circles, and service moments connected across the NICA
                  community.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                [ShieldCheck, "Private by design"],
                [LockKeyhole, "Secure sessions"],
                [Check, "One community"],
              ].map(([Icon, label]) => (
                <div
                  key={label as string}
                  className="rounded-2xl border border-white/10 bg-black/10 p-4 backdrop-blur-xl"
                >
                  <Icon className="mb-3 size-5 text-cyan-200" />
                  <p className="text-xs font-medium text-white/65">
                    {label as string}
                  </p>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="mx-auto flex w-full max-w-xl items-center"
          >
            <div className="w-full rounded-[2rem] border border-white/15 bg-white/[0.075] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.42)] backdrop-blur-3xl sm:p-8">
              <div className="mb-8 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/70">
                    NICA access
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-white">
                    {mode === "signin" ? "Welcome back" : "Create your space"}
                  </h2>
                  <p className="mt-2 text-sm text-white/50">
                    {mode === "signin"
                      ? "Continue your journey with the community."
                      : "A new beginning for your faith journey."}
                  </p>
                </div>
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/15 bg-gradient-to-br from-violet-300/20 to-cyan-200/10 shadow-inner">
                  <KeyRound className="size-5 text-cyan-100" />
                </div>
              </div>

              <div className="mb-7 grid grid-cols-2 rounded-2xl border border-white/10 bg-black/15 p-1">
                {(["signin", "signup"] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => switchMode(tab)}
                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${mode === tab ? "bg-white/15 text-white shadow-lg" : "text-white/45 hover:text-white/75"}`}
                  >
                    {tab === "signin" ? "Sign in" : "Sign up"}
                  </button>
                ))}
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {mode === "signup" && (
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                      Display name
                    </span>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                      <Input
                        required
                        minLength={2}
                        maxLength={80}
                        value={name}
                        onChange={event => setName(event.target.value)}
                        placeholder="Your name"
                        autoComplete="name"
                        className="h-12 rounded-2xl border-white/10 bg-black/15 pl-11 text-white placeholder:text-white/25 focus-visible:border-cyan-200/60 focus-visible:ring-cyan-200/20"
                      />
                    </div>
                  </label>
                )}
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                    Email address
                  </span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                    <Input
                      required
                      type="email"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="h-12 rounded-2xl border-white/10 bg-black/15 pl-11 text-white placeholder:text-white/25 focus-visible:border-cyan-200/60 focus-visible:ring-cyan-200/20"
                    />
                  </div>
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                    Password
                  </span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                    <Input
                      required
                      minLength={mode === "signup" ? 8 : 1}
                      maxLength={128}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      placeholder={
                        mode === "signup"
                          ? "At least 8 characters"
                          : "Your password"
                      }
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                      className="h-12 rounded-2xl border-white/10 bg-black/15 pl-11 pr-12 text-white placeholder:text-white/25 focus-visible:border-cyan-200/60 focus-visible:ring-cyan-200/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(value => !value)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </label>
                {mode === "signup" && (
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                      Confirm password
                    </span>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                      <Input
                        required
                        minLength={8}
                        maxLength={128}
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={event =>
                          setConfirmPassword(event.target.value)
                        }
                        placeholder="Repeat your password"
                        autoComplete="new-password"
                        className="h-12 rounded-2xl border-white/10 bg-black/15 pl-11 pr-12 text-white placeholder:text-white/25 focus-visible:border-cyan-200/60 focus-visible:ring-cyan-200/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(value => !value)}
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirmation password"
                            : "Show confirmation password"
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </label>
                )}

                {submitError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-sm text-red-100"
                  >
                    {submitError}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={isPending}
                  className="group mt-2 h-12 w-full rounded-2xl bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 font-semibold text-white shadow-[0_12px_40px_rgba(99,102,241,0.32)] transition hover:brightness-110 active:scale-[0.98]"
                >
                  {isPending
                    ? "Opening your space…"
                    : mode === "signin"
                      ? "Enter NICA"
                      : "Create my account"}
                  <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </form>

              <p className="mt-6 text-center text-xs leading-5 text-white/35">
                By continuing, you agree to use this space with care and respect
                for the NICA community.
              </p>
              <Link
                href="/"
                className="mt-5 flex items-center justify-center text-sm font-medium text-cyan-100/70 transition hover:text-cyan-50"
              >
                Return to the public site
              </Link>
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  );
}
