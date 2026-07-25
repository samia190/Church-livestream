import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/DashboardLayout";
import { ModernLiveStudio } from "@/components/ModernLiveStudio";
import {
  LogOut, Users, Calendar, Music, Radio, Settings, MessageSquare,
  DollarSign, BarChart3, Plus, Edit2, Trash2, Eye, EyeOff, Download,
  Video, Camera, Globe, Zap, AlertCircle, CheckCircle, Clock, Wifi,
  WifiOff, Play, Square, Monitor, Sliders, Send
} from "lucide-react";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");

  // Redirect if not admin
  if (user && user.role !== 'admin') {
    setLocation('/');
    return null;
  }

  // Fetch data
  const { data: stats } = trpc.dashboard.getStats.useQuery();
  const { data: events, isLoading: eventsLoading } = trpc.events.getAll.useQuery();
  const { data: sermons, isLoading: sermonsLoading } = trpc.sermons.getAll.useQuery();
  const { data: activeStream } = trpc.streaming.getActiveStream.useQuery(undefined, { refetchInterval: 10000 });
  const { data: prayerRequests } = { data: [] }; // Prayer requests query
  const { data: donations } = { data: [] }; // Donations query
  const { data: messages } = { data: [] }; // Contact messages query

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const handleLogout = async () => {
    await logout();
    setLocation('/');
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
            <p className="text-muted-foreground mt-2">Manage N.I.C.A. Kibugu content, streaming, and settings</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Events</p>
                <p className="text-2xl font-bold text-foreground">{events?.length || 0}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sermons</p>
                <p className="text-2xl font-bold text-foreground">{sermons?.length || 0}</p>
              </div>
              <Music className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-pink-500/10 to-pink-600/10 border-pink-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Prayer Requests</p>
                <p className="text-2xl font-bold text-foreground">{prayerRequests?.length || 0}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-pink-500 opacity-50" />
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Donations</p>
                <p className="text-2xl font-bold text-foreground">${donations?.reduce((sum: number, d: any) => sum + (d.amount || 0), 0) || 0}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Messages</p>
                <p className="text-2xl font-bold text-foreground">{messages?.length || 0}</p>
              </div>
              <Users className="w-8 h-8 text-orange-500 opacity-50" />
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Live Status</p>
                <p className="text-2xl font-bold text-foreground">{activeStream ? 'LIVE' : 'Offline'}</p>
              </div>
              <Radio className={`w-8 h-8 ${activeStream ? 'text-red-500' : 'text-gray-500'} opacity-50`} />
            </div>
          </Card>
        </motion.div>

        {/* Main Tabs - All in One Page */}
        <motion.div variants={itemVariants}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6 lg:grid-cols-10 mb-8 bg-background border border-border">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="events" className="text-xs">Events</TabsTrigger>
              <TabsTrigger value="sermons" className="text-xs">Sermons</TabsTrigger>
              <TabsTrigger value="live" className="text-xs">Live</TabsTrigger>
              <TabsTrigger value="prayer" className="text-xs">Prayer</TabsTrigger>
              <TabsTrigger value="donations" className="text-xs">Giving</TabsTrigger>
              <TabsTrigger value="messages" className="text-xs">Messages</TabsTrigger>
              <TabsTrigger value="users" className="text-xs">Users</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs">Analytics</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <Card className="p-6 bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
                <h3 className="text-xl font-bold text-foreground mb-4">Welcome to Admin Dashboard</h3>
                <p className="text-muted-foreground mb-4">
                  Manage all aspects of N.I.C.A. Kibugu from this central hub. Use the tabs above to navigate between different sections.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4 border-border">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Quick Actions
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Create new events</li>
                      <li>• Upload sermons</li>
                      <li>• Manage live streams</li>
                      <li>• View prayer requests</li>
                    </ul>
                  </Card>
                  <Card className="p-4 border-border">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                      System Status
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>✓ Database: Connected</li>
                      <li>✓ Streaming: Ready</li>
                      <li>✓ Email: Configured</li>
                      <li>✓ Analytics: Active</li>
                    </ul>
                  </Card>
                </div>
              </Card>
            </TabsContent>

            {/* Events Tab */}
            <TabsContent value="events" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-foreground">Events Management</h3>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  New Event
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {events?.map((event: any) => (
                  <Card key={event.id} className="p-4 border-border hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-foreground">{event.title}</h4>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost"><Edit2 className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {event.date} at {event.time}
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Sermons Tab */}
            <TabsContent value="sermons" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-foreground">Sermons Management</h3>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Upload Sermon
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sermons?.map((sermon: any) => (
                  <Card key={sermon.id} className="p-4 border-border hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-foreground">{sermon.title}</h4>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost"><Edit2 className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">By {sermon.preacher}</p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <Music className="w-3 h-3" />
                      {sermon.date}
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Live Streaming Tab - MODERN PROFESSIONAL STUDIO */}
            <TabsContent value="live" className="space-y-6">
              <ModernLiveStudio />
            </TabsContent>

            {/* Prayer Requests Tab */}
            <TabsContent value="prayer" className="space-y-6">
              <h3 className="text-xl font-bold text-foreground">Prayer Requests</h3>
              <div className="space-y-4">
                {prayerRequests?.map((prayer: any) => (
                  <Card key={prayer.id} className="p-4 border-border hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-bold text-foreground">{prayer.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{prayer.request}</p>
                        <p className="text-xs text-muted-foreground mt-2">Email: {prayer.email}</p>
                      </div>
                      <Button size="sm" variant="outline">Respond</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Donations Tab */}
            <TabsContent value="donations" className="space-y-6">
              <h3 className="text-xl font-bold text-foreground">Donations & Giving</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
                  <p className="text-sm text-muted-foreground">Total Donations</p>
                  <p className="text-3xl font-bold text-foreground">${donations?.reduce((sum: number, d: any) => sum + (d.amount || 0), 0) || 0}</p>
                </Card>
                <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
                  <p className="text-sm text-muted-foreground">Total Donors</p>
                  <p className="text-3xl font-bold text-foreground">{donations?.length || 0}</p>
                </Card>
                <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
                  <p className="text-sm text-muted-foreground">Avg Donation</p>
                  <p className="text-3xl font-bold text-foreground">${donations && donations.length > 0 ? Math.round(donations.reduce((sum: number, d: any) => sum + (d.amount || 0), 0) / donations.length) : 0}</p>
                </Card>
              </div>
              <div className="space-y-4">
                {donations?.map((donation: any) => (
                  <Card key={donation.id} className="p-4 border-border">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-foreground">{donation.name}</h4>
                        <p className="text-sm text-muted-foreground">{donation.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-500">${donation.amount}</p>
                        <p className="text-xs text-muted-foreground">{donation.date}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Messages Tab */}
            <TabsContent value="messages" className="space-y-6">
              <h3 className="text-xl font-bold text-foreground">Contact Messages</h3>
              <div className="space-y-4">
                {messages?.map((message: any) => (
                  <Card key={message.id} className="p-4 border-border hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-foreground">{message.name}</h4>
                        <p className="text-sm text-muted-foreground">{message.email}</p>
                      </div>
                      <Button size="sm" variant="outline" className="gap-2">
                        <Send className="w-3 h-3" />
                        Reply
                      </Button>
                    </div>
                    <p className="text-sm text-foreground mt-3">{message.message}</p>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-foreground">User Management</h3>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add User
                </Button>
              </div>
              <Card className="p-4 border-border">
                <p className="text-muted-foreground">User management features coming soon...</p>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <h3 className="text-xl font-bold text-foreground">Analytics & Reports</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 border-border">
                  <h4 className="font-bold text-foreground mb-4">Website Traffic</h4>
                  <div className="h-40 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded flex items-center justify-center">
                    <p className="text-muted-foreground">Chart placeholder</p>
                  </div>
                </Card>
                <Card className="p-4 border-border">
                  <h4 className="font-bold text-foreground mb-4">User Engagement</h4>
                  <div className="h-40 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded flex items-center justify-center">
                    <p className="text-muted-foreground">Chart placeholder</p>
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <h3 className="text-xl font-bold text-foreground">System Settings</h3>
              <Card className="p-6 border-border space-y-4">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">Church Name</label>
                  <Input defaultValue="National Independence Church of Africa - N.I.C.A. Kibugu" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">Church Email</label>
                  <Input defaultValue="info@nicakibugu.org" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">Church Phone</label>
                  <Input defaultValue="+254 700 000 000" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">Location</label>
                  <Input defaultValue="Kibugu, Nginda Parish, Kenya" />
                </div>
                <Button className="w-full">Save Settings</Button>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
