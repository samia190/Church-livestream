import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Users, Calendar, Music, Settings, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Admin() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if not admin
  if (user && user.role !== 'admin') {
    setLocation('/');
    return null;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <DashboardLayout>
      <motion.div
        className="space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-2">Manage N.I.C.A. Kibugu content and settings</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              logout();
              setLocation('/');
            }}
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </motion.div>

        {/* Quick Stats */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Members</p>
                <p className="text-3xl font-bold text-foreground">2,700+</p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Events</p>
                <p className="text-3xl font-bold text-foreground">12</p>
              </div>
              <Calendar className="w-8 h-8 text-primary" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sermons</p>
                <p className="text-3xl font-bold text-foreground">48</p>
              </div>
              <Music className="w-8 h-8 text-primary" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Settings</p>
                <p className="text-3xl font-bold text-foreground">Active</p>
              </div>
              <Settings className="w-8 h-8 text-primary" />
            </div>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={itemVariants}>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="sermons">Sermons</TabsTrigger>
              <TabsTrigger value="livestream">Live</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-border">
                    <span className="text-muted-foreground">Last prayer request received</span>
                    <span className="text-foreground">2 hours ago</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-border">
                    <span className="text-muted-foreground">Last donation received</span>
                    <span className="text-foreground">5 hours ago</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Last contact message</span>
                    <span className="text-foreground">1 day ago</span>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="events" className="space-y-4 mt-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Manage Events</h3>
                <p className="text-muted-foreground mb-4">Create and manage church events, services, and gatherings</p>
                <Button className="bg-primary hover:bg-primary/90">Add New Event</Button>
              </Card>
            </TabsContent>

            <TabsContent value="sermons" className="space-y-4 mt-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Manage Sermons</h3>
                <p className="text-muted-foreground mb-4">Upload and manage sermon videos, audio, and transcripts</p>
                <Button className="bg-primary hover:bg-primary/90">Add New Sermon</Button>
              </Card>
            </TabsContent>

            <TabsContent value="livestream" className="space-y-4 mt-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Live Streaming Control</h3>
                <p className="text-muted-foreground mb-4">Manage live streams, cameras, and multi-platform broadcasting</p>
                <a href="/livestream">
                  <Button className="bg-primary hover:bg-primary/90">Open Live Stream Control</Button>
                </a>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Church Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Church Name</label>
                    <input
                      type="text"
                      defaultValue="National Independence Church of Africa - N.I.C.A. Kibugu"
                      className="w-full mt-2 px-3 py-2 bg-background border border-border rounded-md text-foreground"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Location</label>
                    <input
                      type="text"
                      defaultValue="Kibugu, Nginda Parish"
                      className="w-full mt-2 px-3 py-2 bg-background border border-border rounded-md text-foreground"
                      disabled
                    />
                  </div>
                  <Button className="bg-primary hover:bg-primary/90">Save Changes</Button>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
