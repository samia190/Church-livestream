import { motion } from "framer-motion";
import { HandHeart, Users, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export default function CommunityHub() {
  const { isAuthenticated, loading } = useAuth();
  const { data: circles = [], isLoading } = trpc.circles.list.useQuery();
  const { data: memberships = [] } = trpc.circles.memberships.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const utils = trpc.useUtils();
  const requestMembership = trpc.circles.requestMembership.useMutation({
    onSuccess: () => {
      utils.circles.memberships.invalidate();
      toast.success("Your request was sent to the circle leader.");
    },
  });

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
            <p className="label-eyebrow mb-3">Belong before you perform</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Trusted Circles
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Small, healthy communities where people can pray, learn, serve,
              and walk with one another. Every circle has a purpose, a leader,
              and a clear code of care.
            </p>
            <Badge variant="outline" className="mt-4">
              <Lock className="w-3 h-3 mr-2" />
              Curated and consent-based
            </Badge>
          </motion.section>
          {isLoading ? (
            <Card className="p-8 text-center text-muted-foreground">
              Finding circles for you…
            </Card>
          ) : circles.length === 0 ? (
            <Card className="p-8 text-center glass-panel border-0">
              <Users className="w-10 h-10 text-ember mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">
                Circles are being prepared
              </h2>
              <p className="text-muted-foreground">
                Church leaders can publish the first prayer, small-group, youth,
                family, and service circles here.
              </p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {circles.map(circle => {
                const membership = memberships.find(
                  item => item.circleId === String(circle._id)
                );
                return (
                  <Card
                    key={String(circle._id)}
                    className="p-6 border-border hover:border-ember/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Badge variant="secondary" className="capitalize mb-3">
                          {circle.category.replace("-", " ")}
                        </Badge>
                        <h2 className="text-2xl font-bold mb-2">
                          {circle.name}
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                          {circle.description}
                        </p>
                      </div>
                      <HandHeart className="w-7 h-7 text-ember shrink-0" />
                    </div>
                    {circle.meetingDetails && (
                      <p className="text-sm text-muted-foreground mt-5">
                        {circle.meetingDetails}
                      </p>
                    )}
                    <div className="mt-6">
                      {membership ? (
                        <Badge variant="outline" className="capitalize">
                          Membership: {membership.status}
                        </Badge>
                      ) : (
                        <Button
                          disabled={requestMembership.isPending}
                          onClick={() => {
                            if (!isAuthenticated) {
                              window.location.assign(
                                `/auth?next=${encodeURIComponent(window.location.pathname)}`
                              );
                              return;
                            }
                            requestMembership.mutate({
                              circleId: String(circle._id),
                            });
                          }}
                          className="bg-ember hover:bg-ember/90 text-ember-foreground"
                        >
                          {isAuthenticated ? "Ask to join" : "Sign in to join"}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
