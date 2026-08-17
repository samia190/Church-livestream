import { motion } from "framer-motion";
import {
  Heart,
  ArrowRight,
  BookOpen,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Navigation from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const steps = [
  {
    title: "Receive",
    text: "Meet God in Scripture and teaching.",
    icon: BookOpen,
  },
  {
    title: "Respond",
    text: "Bring your honest heart to God in prayer.",
    icon: Heart,
  },
  {
    title: "Relate",
    text: "Walk with trusted people who help you grow.",
    icon: ShieldCheck,
  },
  {
    title: "Reach",
    text: "Let faith become visible through love and service.",
    icon: Sparkles,
  },
];

export default function WelcomeJourney() {
  const { user, isAuthenticated, loading } = useAuth();
  const { data: paths = [], isLoading: pathsLoading } =
    trpc.welcome.paths.useQuery();
  const { data: progress = [], isLoading: progressLoading } =
    trpc.welcome.progress.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();
  const saveJourney = trpc.welcome.save.useMutation({
    onSuccess: () => utils.welcome.progress.invalidate(),
  });
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const selected = paths.find(path => path.id === selectedPath);
  const existing = progress.find(item => item.pathId === selectedPath);

  const beginJourney = () => {
    if (!selected) return;
    if (!isAuthenticated) {
      window.location.assign(
        `/auth?next=${encodeURIComponent(window.location.pathname)}`
      );
      return;
    }
    saveJourney.mutate({
      pathId: selected.id,
      pathTitle: selected.title,
      currentStep: step,
      completedSteps: existing?.completedSteps ?? [],
      welcomeAnswers: {},
    });
  };

  return (
    <div className="min-h-screen text-foreground">
      <Navigation />
      <main className="relative overflow-hidden pt-28 pb-20 px-4">
        <div className="absolute inset-0 pointer-events-none opacity-40 orbit-grid" />
        <div className="relative max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center mb-14">
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl"
            >
              <p className="label-eyebrow mb-3">A quiet place to begin</p>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5">
                Take your next faithful step.
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                You do not have to have everything figured out. Choose a path
                that meets you where you are, and let Scripture, prayer,
                community, and service guide the next season.
              </p>
              {user && (
                <p className="mt-4 text-sm text-ember">
                  Welcome, {user.name || "friend"}. Your progress is private to
                  you.
                </p>
              )}
            </motion.section>
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="relative hidden md:block"
            >
              <div className="absolute inset-10 rounded-full bg-ember/10 blur-3xl" />
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663817446954/oPsZPFrwtxEZxzOL.png"
                alt="A glowing olive branch and candle inside a glass sphere"
                className="relative w-full max-w-md mx-auto drop-shadow-2xl"
                loading="eager"
              />
            </motion.div>
          </div>

          <section className="grid md:grid-cols-4 gap-4 mb-14">
            {steps.map(({ title, text, icon: Icon }, index) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <Card className="h-full p-5 glass-panel border-0">
                  <Icon className="w-7 h-7 text-ember mb-4" />
                  <h2 className="font-semibold mb-2">{title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {text}
                  </p>
                </Card>
              </motion.div>
            ))}
          </section>

          <section>
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <p className="label-eyebrow mb-2">Choose a pathway</p>
                <h2 className="text-2xl md:text-3xl font-bold">
                  Where is your heart today?
                </h2>
              </div>
              {isAuthenticated && !loading && (
                <Badge variant="outline">Your progress is private</Badge>
              )}
            </div>
            {pathsLoading || (isAuthenticated && progressLoading) ? (
              <Card className="p-8 text-muted-foreground">
                Preparing your pathways…
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-5">
                {paths.map(path => {
                  const saved = progress.find(item => item.pathId === path.id);
                  const active = selectedPath === path.id;
                  return (
                    <button
                      type="button"
                      key={path.id}
                      onClick={() => {
                        setSelectedPath(path.id);
                        setStep(saved?.currentStep ?? 0);
                      }}
                      className={`text-left rounded-2xl border p-6 transition-all ${active ? "border-ember bg-ember/10 shadow-lg" : "border-border hover:border-ember/60 bg-card/50"}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-bold mb-2">
                            {path.title}
                          </h3>
                          <p className="text-muted-foreground leading-relaxed">
                            {path.description}
                          </p>
                        </div>
                        <ArrowRight
                          className={`w-5 h-5 shrink-0 ${active ? "text-ember" : "text-muted-foreground"}`}
                        />
                      </div>
                      {saved && (
                        <div className="mt-5">
                          <div className="flex justify-between text-xs text-muted-foreground mb-2">
                            <span>In progress</span>
                            <span>
                              {saved.completedSteps?.length ?? 0} steps
                              completed
                            </span>
                          </div>
                          <Progress
                            value={Math.min(
                              100,
                              (saved.completedSteps?.length ?? 0) * 25
                            )}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {selected && (
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 rounded-2xl border border-ember/40 bg-ember/10 p-6 md:p-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <p className="text-sm text-ember font-medium mb-2">
                    Selected pathway
                  </p>
                  <h2 className="text-2xl font-bold mb-2">{selected.title}</h2>
                  <p className="text-muted-foreground">
                    Start gently. You can pause, return, and continue whenever
                    you are ready.
                  </p>
                </div>
                <Button
                  onClick={beginJourney}
                  disabled={saveJourney.isPending}
                  className="bg-ember hover:bg-ember/90 text-ember-foreground"
                >
                  {saveJourney.isPending
                    ? "Saving…"
                    : isAuthenticated
                      ? "Begin my journey"
                      : "Sign in to begin"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.section>
          )}
        </div>
      </main>
    </div>
  );
}
