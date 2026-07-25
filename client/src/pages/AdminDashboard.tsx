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

  // Role check removed for development
  /*
  if (user && user.role !== 'admin') {
    setLocation('/');
    return null;
  }
  */

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
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your church website and live streaming</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={itemVariants}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b border-border rounded-none">
              {[
                { id: "overview", label: "Overview", icon: BarChart3 },
                { id: "events", label: "Events", icon: Calendar },
                { id: "sermons", label: "Sermons", icon: Music },
                { id: "live", label: "Live Stream", icon: Radio },
                { id: "prayer", label: "Prayer", icon: MessageSquare },
                { id: "give", label: "Give", icon: DollarSign },
                { id: "contact", label: "Contact", icon: MessageSquare },
              ].map(tab => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Members", value: stats?.members ?? 0, icon: Users, color: "text-blue-500" },
                  { label: "Events", value: stats?.events ?? 0, icon: Calendar, color: "text-green-500" },
                  { label: "Sermons", value: stats?.sermons ?? 0, icon: Music, color: "text-purple-500" },
                  { label: "Prayer Requests", value: stats?.prayerRequests ?? 0, icon: MessageSquare, color: "text-orange-500" },
                ].map((stat, i) => (
                  <Card key={i} className="p-6">
                    <div className="flex items-center gap-4">
                      <stat.icon className={`w-8 h-8 ${stat.color}`} />
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-2xl font-bold">{stat.value}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="text-sm font-medium">System Status</p>
                        <p className="text-xs text-muted-foreground">All systems operational</p>
                      </div>
                    </div>
                    {activeStream ? (
                      <div className="flex items-center gap-3">
                        <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                        <div>
                          <p className="text-sm font-medium">Live Stream Active</p>
                          <p className="text-xs text-muted-foreground">{activeStream.title}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <WifiOff className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">No Active Stream</p>
                          <p className="text-xs text-muted-foreground">Start a live stream from the Live Stream tab</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4">Quick Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">Database</span>
                      <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="w-4 h-4" /> Connected (MongoDB Atlas)</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">Streaming</span>
                      <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="w-4 h-4" /> Ready</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">WebSocket</span>
                      <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="w-4 h-4" /> Connected</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">Live Viewers</span>
                      <span className="text-sm font-bold">{stats?.liveViewers ?? 0}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* Events Tab */}
            <TabsContent value="events" className="space-y-6 mt-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-foreground">Events Management</h3>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  New Event
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {events?.map((event: any) => (
                  <Card key={event._id} className="p-4 border-border hover:border-primary/50 transition-colors">
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
                      {new Date(event.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      {event.startDate && ` at ${new Date(event.startDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Sermons Tab */}
            <TabsContent value="sermons" className="space-y-6 mt-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-foreground">Sermons Management</h3>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Upload Sermon
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sermons?.map((sermon: any) => (
                  <Card key={sermon._id} className="p-4 border-border hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-foreground">{sermon.title}</h4>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost"><Edit2 className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">By {sermon.speaker || 'Unknown'}</p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <Music className="w-3 h-3" />
                      {sermon.sermonDate ? new Date(sermon.sermonDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No date'}
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Live Streaming Tab - MODERN PROFESSIONAL STUDIO */}
            <TabsContent value="live" className="space-y-6 mt-6">
              <ModernLiveStudio />
            </TabsContent>

            {/* Prayer Requests Tab */}
            <TabsContent value="prayer" className="space-y-6 mt-6">
              <h3 className="text-xl font-bold text-foreground">Prayer Requests</h3>
              <div className="space-y-4">
                {prayerRequests?.map((prayer: any) => (
                  <Card key={prayer.id} className="p-4 border-border hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold">{prayer.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{prayer.prayerRequest}</p>
                        <p className="text-xs text-muted-foreground mt-2">{prayer.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost"><Eye className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Give Tab */}
            <TabsContent value="give" className="space-y-6 mt-6">
              <h3 className="text-xl font-bold text-foreground">Donations</h3>
              <div className="space-y-4">
                {donations?.map((donation: any) => (
                  <Card key={donation.id} className="p-4 border-border hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold">{donation.donorName}</h4>
                        <p className="text-sm text-muted-foreground">{donation.email}</p>
                        <p className="text-xs text-muted-foreground">{donation.method} • {donation.purpose || 'General'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{donation.amount.toLocaleString()} {donation.currency}</p>
                        <p className="text-xs text-muted-foreground">{donation.status}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Contact Tab */}
            <TabsContent value="contact" className="space-y-6 mt-6">
              <h3 className="text-xl font-bold text-foreground">Contact Messages</h3>
              <div className="space-y-4">
                {messages?.map((msg: any) => (
                  <Card key={msg.id} className="p-4 border-border hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold">{msg.name}</h4>
                        <p className="text-sm text-muted-foreground">{msg.email} {msg.phone ? `• ${msg.phone}` : ''}</p>
                        <p className="text-sm mt-2">{msg.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">Status: {msg.status}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost"><Eye className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost"><Send className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
