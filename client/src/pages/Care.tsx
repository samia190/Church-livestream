import { motion } from "framer-motion";
import { HeartHandshake, ShieldAlert, Lock, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/Navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

const categories = [
  "pastoral-conversation",
  "grief",
  "family",
  "youth",
  "addiction",
  "practical-help",
  "other",
] as const;

export default function Care() {
  const { isAuthenticated, loading } = useAuth();
  const { data: requests = [], isLoading } = trpc.care.mine.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const utils = trpc.useUtils();
  const submit = trpc.care.request.useMutation({
    onSuccess: () => {
      utils.care.mine.invalidate();
      setMessage("");
      setSafeguardingFlag(false);
      toast.success(
        "Your care request has been received. A human care-team member will follow up."
      );
    },
  });
  const [category, setCategory] = useState<(typeof categories)[number]>(
    "pastoral-conversation"
  );
  const [preferredContact, setPreferredContact] = useState<
    "email" | "phone" | "in-person"
  >("email");
  const [message, setMessage] = useState("");
  const [safeguardingFlag, setSafeguardingFlag] = useState(false);

  if (!loading && !isAuthenticated)
    return (
      <div className="min-h-screen text-foreground">
        <Navigation />
        <main className="pt-32 px-4">
          <Card className="max-w-xl mx-auto p-8 text-center glass-panel border-0">
            <Lock className="w-10 h-10 text-ember mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-3">Request pastoral care</h1>
            <p className="text-muted-foreground mb-6">
              Sign in so a trusted care-team member can follow up with you
              privately.
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
        <div className="max-w-5xl mx-auto">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mb-10"
          >
            <p className="label-eyebrow mb-3">Human care matters</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Ask for care
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              You can request a pastoral conversation, support through grief or
              family difficulty, youth care, practical help, or a referral to
              qualified professional support.
            </p>
          </motion.section>
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
            <Card className="p-6 glass-panel border-0 lg:sticky lg:top-24">
              <div className="flex items-center gap-3 mb-5">
                <HeartHandshake className="w-7 h-7 text-ember" />
                <h2 className="text-xl font-bold">
                  Tell us how we can walk with you
                </h2>
              </div>
              <form
                onSubmit={event => {
                  event.preventDefault();
                  if (message.trim())
                    submit.mutate({
                      category,
                      message: message.trim(),
                      preferredContact,
                      safeguardingFlag,
                    });
                }}
                className="space-y-4"
              >
                <Select
                  value={category}
                  onValueChange={value =>
                    setCategory(value as (typeof categories)[number])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a care area" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(item => (
                      <SelectItem key={item} value={item}>
                        {item.replaceAll("-", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={preferredContact}
                  onValueChange={value =>
                    setPreferredContact(value as typeof preferredContact)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Preferred contact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="in-person">In person</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  rows={9}
                  maxLength={12000}
                  required
                  value={message}
                  onChange={event => setMessage(event.target.value)}
                  placeholder="Share only what you feel safe sharing. A human will read this with care."
                />
                <label className="flex items-start gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={safeguardingFlag}
                    onChange={event =>
                      setSafeguardingFlag(event.target.checked)
                    }
                    className="mt-1 accent-ember"
                  />
                  <span>
                    I need this request handled with additional safeguarding
                    attention.
                  </span>
                </label>
                <Button
                  type="submit"
                  disabled={submit.isPending || !message.trim()}
                  className="w-full bg-ember hover:bg-ember/90 text-ember-foreground"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {submit.isPending ? "Sending…" : "Request human follow-up"}
                </Button>
              </form>
              <div className="mt-6 rounded-xl bg-destructive/10 p-4 text-sm text-muted-foreground">
                <ShieldAlert className="w-4 h-4 text-destructive mb-2" />
                <p>
                  If someone is in immediate danger, contact local emergency
                  services. This platform is not an emergency response service.
                </p>
              </div>
            </Card>
            <section>
              {isLoading ? (
                <Card className="p-8 text-center text-muted-foreground">
                  Loading your care requests…
                </Card>
              ) : requests.length === 0 ? (
                <Card className="p-8 text-center glass-panel border-0">
                  <HeartHandshake className="w-10 h-10 text-ember mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-2">Your care requests</h2>
                  <p className="text-muted-foreground">
                    When you ask for support, you will see its status here.
                  </p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {requests.map(request => (
                    <Card
                      key={String(request._id)}
                      className="p-6 border-border"
                    >
                      <div className="flex justify-between gap-4 mb-3">
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.createdAt).toLocaleString()}
                        </p>
                        <Badge
                          variant={
                            request.status === "closed"
                              ? "secondary"
                              : "outline"
                          }
                          className="capitalize"
                        >
                          {request.status.replaceAll("-", " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-ember capitalize">
                        {request.category.replaceAll("-", " ")}
                      </p>
                      <p className="whitespace-pre-wrap leading-relaxed mt-2">
                        {request.message}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
