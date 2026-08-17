import { motion } from "framer-motion";
import {
  Bell,
  CalendarClock,
  Camera,
  Lock,
  Mic,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export default function PrayerRoomGatherings() {
  const { isAuthenticated } = useAuth();
  const sessionsQuery = trpc.prayerRoom.upcoming.useQuery();
  const sessions: any[] = (sessionsQuery.data as any[] | undefined) ?? [];
  const isLoading = sessionsQuery.isLoading;
  const { data: registrations = [] } = trpc.prayerRoom.mine.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const utils = trpc.useUtils();
  const register = trpc.prayerRoom.register.useMutation({
    onSuccess: async (_result, variables) => {
      await utils.prayerRoom.mine.invalidate();
      toast.success(
        "You are registered. We will remind you when the room is about to begin."
      );
      if (
        variables.notificationOptIn &&
        "Notification" in window &&
        Notification.permission === "default"
      )
        await Notification.requestPermission();
    },
  });
  const joinRoom = trpc.prayerRoom.join.useMutation({
    onSuccess: result => {
      if (result.internalRoom)
        window.location.assign(`/prayer-gatherings/${result.sessionId}/live`);
      else if (result.joinUrl)
        window.open(result.joinUrl, "_blank", "noopener,noreferrer");
    },
    onError: error => toast.error(error.message),
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (
      !isAuthenticated ||
      registrations.length === 0 ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;
    const now = Date.now();
    const next = sessions.find(
      session =>
        registrations.some(
          registration => registration.sessionId === String(session._id)
        ) && new Date(session.startsAt).getTime() > now
    );
    if (!next) return;
    const reminderKey = `nica-prayer-room-reminder-${String(next._id)}`;
    if (localStorage.getItem(reminderKey)) return;
    const delay = Math.max(
      1000,
      new Date(next.startsAt).getTime() - now - 10 * 60 * 1000
    );
    const timer = window.setTimeout(
      () => {
        new Notification("Prayer Room begins soon", { body: next.title });
        localStorage.setItem(reminderKey, "sent");
      },
      Math.min(delay, 2147483647)
    );
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, registrations, sessions]);

  return (
    <div className="min-h-screen text-foreground">
      <Navigation />
      <main className="pt-28 pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mb-12"
          >
            <p className="label-eyebrow mb-3">
              A room for stories, prayer, and hope
            </p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Prayer Room Gatherings
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Register before you join. When the host opens the room, registered
              members can enter by voice or video, share a story, listen without
              fixing, and pray together.
            </p>
            <div className="flex flex-wrap gap-3 mt-5">
              <Badge variant="outline">
                <Lock className="w-3 h-3 mr-2" />
                Registration required
              </Badge>
              <Badge variant="outline">
                <ShieldCheck className="w-3 h-3 mr-2" />
                Moderated and safeguarded
              </Badge>
            </div>
          </motion.section>
          <div className="grid md:grid-cols-2 gap-6">
            {isLoading ? (
              <Card className="p-8 text-center text-muted-foreground">
                Loading upcoming gatherings…
              </Card>
            ) : sessions.length === 0 ? (
              <Card className="p-8 text-center glass-panel border-0">
                <CalendarClock className="w-10 h-10 text-ember mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">
                  No gathering is scheduled yet
                </h2>
                <p className="text-muted-foreground">
                  The church team will publish the next Prayer Room time here.
                </p>
              </Card>
            ) : (
              sessions.map(session => {
                const registered = registrations.some(
                  item => item.sessionId === String(session._id)
                );
                return (
                  <Card
                    key={String(session._id)}
                    className="p-6 border-border hover:border-ember/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Badge variant="secondary" className="mb-3">
                          {session.mode === "voice-video"
                            ? "Voice + video"
                            : "Voice only"}
                        </Badge>
                        <h2 className="text-2xl font-bold mb-3">
                          {session.title}
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                          {session.description}
                        </p>
                      </div>
                      <div className="flex gap-2 text-ember">
                        {session.mode === "voice-video" ? (
                          <Camera className="w-5 h-5" />
                        ) : (
                          <Mic className="w-5 h-5" />
                        )}
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="space-y-2 mt-6 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-ember" />
                        {new Date(session.startsAt).toLocaleString()} ·{" "}
                        {session.durationMinutes} minutes
                      </p>
                      <p className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-ember" />
                        Up to {session.capacity} registered participants
                      </p>
                    </div>
                    <div className="mt-6">
                      {registered ? (
                        <div className="space-y-3">
                          <Badge variant="outline">You are registered</Badge>
                          {session.status === "live" ? (
                            <Button
                              disabled={joinRoom.isPending}
                              onClick={() =>
                                joinRoom.mutate({
                                  sessionId: String(session._id),
                                })
                              }
                              className="bg-ember hover:bg-ember/90 text-ember-foreground"
                            >
                              {joinRoom.isPending
                                ? "Opening secure room…"
                                : "Enter the live room"}
                            </Button>
                          ) : session.status === "ended" ? (
                            <p className="text-xs text-muted-foreground">
                              This gathering has ended. Thank you for making
                              room for one another.
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              The secure join control will become available when
                              the host opens the room. Do not share private
                              meeting links.
                            </p>
                          )}
                        </div>
                      ) : (
                        <Button
                          disabled={register.isPending}
                          onClick={() => {
                            if (!isAuthenticated) {
                              window.location.assign(
                                `/auth?next=${encodeURIComponent(window.location.pathname)}`
                              );
                              return;
                            }
                            register.mutate({
                              sessionId: String(session._id),
                              notificationOptIn: notificationsEnabled,
                            });
                          }}
                          className="bg-ember hover:bg-ember/90 text-ember-foreground"
                        >
                          {isAuthenticated
                            ? "Register to join"
                            : "Sign in to register"}
                          <Bell className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
          <Card className="mt-10 p-6 glass-panel border-0">
            <div className="flex items-start gap-4">
              <ShieldCheck className="w-7 h-7 text-ember shrink-0" />
              <div>
                <h2 className="text-xl font-bold mb-2">
                  A safe room for real people
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Please do not record, screenshot, forward stories, or pressure
                  anyone to share. Hosts may mute, remove, or end a session when
                  safety requires it. Serious safeguarding concerns are
                  escalated to designated human leaders.
                </p>
                <label className="flex items-center gap-3 text-sm mt-4">
                  <input
                    type="checkbox"
                    checked={notificationsEnabled}
                    onChange={event =>
                      setNotificationsEnabled(event.target.checked)
                    }
                    className="accent-ember"
                  />
                  Remind me when a registered gathering is about to begin
                </label>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
