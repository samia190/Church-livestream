import { motion } from "framer-motion";
import {
  BookOpenText,
  HeartHandshake,
  Lock,
  Send,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export default function ScriptureCompanion() {
  const { isAuthenticated, loading } = useAuth();
  const reflect = trpc.scripture.reflect.useMutation({
    onError: error =>
      toast.error(error.message || "The companion is unavailable right now"),
  });
  const [question, setQuestion] = useState("");
  const [reference, setReference] = useState("");

  if (!loading && !isAuthenticated)
    return (
      <div className="min-h-screen text-foreground">
        <Navigation />
        <main className="pt-32 px-4">
          <Card className="max-w-xl mx-auto p-8 text-center glass-panel border-0">
            <Lock className="w-10 h-10 text-ember mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-3">Scripture Companion</h1>
            <p className="text-muted-foreground mb-6">
              Sign in to reflect with a gentle, Scripture-grounded companion. It
              is a tool for reflection, not a replacement for Scripture or
              pastoral care.
            </p>
            <Button
              onClick={() =>
                window.location.assign(
                  `/auth?next=${encodeURIComponent(window.location.pathname)}`
                )
              }
              className="bg-ember hover:bg-ember/90 text-ember-foreground"
            >
              Sign in to continue
            </Button>
          </Card>
        </main>
      </div>
    );

  return (
    <div className="min-h-screen text-foreground">
      <Navigation />
      <main className="pt-28 pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <p className="label-eyebrow mb-3">A tool for reflection</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Scripture Companion
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Bring a question, a Scripture reference, or a season you are
              trying to understand. The companion offers a simple guided
              reflection and one faithful next step.
            </p>
            <Badge variant="outline" className="mt-4">
              <Sparkles className="w-3 h-3 mr-2" />
              Guided reflection · human care
            </Badge>
          </motion.section>
          <Card className="p-6 glass-panel border-0">
            <div className="flex items-center gap-3 mb-5">
              <BookOpenText className="w-7 h-7 text-ember" />
              <h2 className="text-xl font-bold">What is on your heart?</h2>
            </div>
            <form
              onSubmit={event => {
                event.preventDefault();
                if (question.trim())
                  reflect.mutate({
                    question: question.trim(),
                    scriptureReference: reference.trim() || undefined,
                  });
              }}
              className="space-y-4"
            >
              <Input
                value={reference}
                onChange={event => setReference(event.target.value)}
                placeholder="Scripture reference (optional), e.g. Psalm 23"
                maxLength={200}
              />
              <Textarea
                value={question}
                onChange={event => setQuestion(event.target.value)}
                placeholder="Ask a question or describe the season you are in…"
                rows={6}
                maxLength={4000}
                required
              />
              <Button
                type="submit"
                disabled={reflect.isPending || !question.trim()}
                className="bg-ember hover:bg-ember/90 text-ember-foreground"
              >
                <Send className="w-4 h-4 mr-2" />
                {reflect.isPending ? "Reflecting…" : "Begin reflection"}
              </Button>
            </form>
          </Card>
          {reflect.data?.content && (
            <Card className="p-6 mt-6 border-ember/30">
              <div className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
                {reflect.data.content}
              </div>
              <div className="mt-6 rounded-xl bg-primary/10 p-4 text-sm text-muted-foreground">
                <HeartHandshake className="w-4 h-4 text-primary mb-2" />
                <p>
                  For serious, painful, or urgent situations, please speak with
                  a trusted pastor and a qualified local professional. You can
                  also{" "}
                  <a href="/care" className="text-ember underline">
                    request human care
                  </a>
                  .
                </p>
              </div>
            </Card>
          )}
          <p className="text-xs text-muted-foreground mt-6">
            The companion may be mistaken. It does not speak for God or NICA
            Kibugu, and it does not replace Scripture, church leadership,
            professional care, or emergency services.
          </p>
        </div>
      </main>
    </div>
  );
}
