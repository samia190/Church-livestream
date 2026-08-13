import { useEffect, useState } from "react";
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

function TabState({ loading, error, empty, label }: { loading?: boolean; error?: unknown; empty: boolean; label: string }) {
  if (loading) return <Card className="p-8 text-center text-muted-foreground">Loading {label}…</Card>;
  if (error) return <Card className="p-8 text-center text-destructive">Unable to load {label}. Please retry.</Card>;
  if (empty) return <Card className="p-8 text-center text-muted-foreground">No {label} found.</Card>;
  return null;
}

function PaginationControls({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return <div className="flex items-center justify-center gap-3 pt-4"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button><span className="text-sm text-muted-foreground">Page {page} of {pages}</span><Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button></div>;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/");
  }, [user, setLocation]);

  // Fetch data
  const { data: stats, isLoading: statsLoading, error: statsError } = trpc.dashboard.getStats.useQuery();
  const { data: events, isLoading: eventsLoading, error: eventsError } = trpc.events.getAll.useQuery();
  const { data: sermons, isLoading: sermonsLoading, error: sermonsError } = trpc.sermons.getAll.useQuery();
  const { data: activeStream, isLoading: streamLoading, error: streamError } = trpc.streaming.getActiveStream.useQuery(undefined, { refetchInterval: 10000 });
  const { data: prayerRequests, isLoading: prayerLoading, error: prayerError } = trpc.adminContent.getPrayerRequests.useQuery();
  const { data: donations, isLoading: donationsLoading, error: donationsError } = trpc.adminContent.getDonations.useQuery();
  const { data: messages, isLoading: messagesLoading, error: messagesError } = trpc.adminContent.getContactMessages.useQuery();
  const utils = trpc.useUtils();
  const deleteEvent = trpc.events.delete.useMutation({ onSuccess: () => utils.events.getAll.invalidate() });
  const createEvent = trpc.events.create.useMutation({ onSuccess: () => { utils.events.getAll.invalidate(); toast.success('Event created'); } });
  const updateEvent = trpc.events.update.useMutation({ onSuccess: () => { utils.events.getAll.invalidate(); toast.success('Event updated'); } });
  const deleteSermon = trpc.sermons.delete.useMutation({ onSuccess: () => utils.sermons.getAll.invalidate() });
  const createSermon = trpc.sermons.create.useMutation({ onSuccess: () => { utils.sermons.getAll.invalidate(); toast.success('Sermon created'); } });
  const updateSermon = trpc.sermons.update.useMutation({ onSuccess: () => { utils.sermons.getAll.invalidate(); toast.success('Sermon updated'); } });
  const updatePrayer = trpc.adminContent.updatePrayerRequestStatus.useMutation({ onSuccess: () => utils.adminContent.getPrayerRequests.invalidate() });
  const updateDonation = trpc.adminContent.updateDonationStatus.useMutation({ onSuccess: () => utils.adminContent.getDonations.invalidate() });
  const updateMessage = trpc.adminContent.updateContactMessageStatus.useMutation({ onSuccess: () => utils.adminContent.getContactMessages.invalidate() });

  const filterRecords = (records: any[] | undefined) => {
    const query = searchTerm.trim().toLowerCase();
    return (records ?? []).filter(record => {
      const matchesSearch = !query || JSON.stringify(record).toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || !record.status || record.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  };
  const filteredEvents = filterRecords(events);
  const filteredSermons = filterRecords(sermons);
  const filteredPrayerRequests = filterRecords(prayerRequests);
  const filteredDonations = filterRecords(donations);
  const filteredMessages = filterRecords(messages);
  const paginate = (records: any[]) => records.slice((page - 1) * pageSize, page * pageSize);
  const pagedEvents = paginate(filteredEvents);
  const pagedSermons = paginate(filteredSermons);
  const pagedPrayerRequests = paginate(filteredPrayerRequests);
  const pagedDonations = paginate(filteredDonations);
  const pagedMessages = paginate(filteredMessages);

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

  const handleCreateEvent = () => {
    const title = window.prompt('Event title');
    if (!title) return;
    const startDate = window.prompt('Start date and time (ISO format)', new Date().toISOString());
    if (!startDate) return;
    createEvent.mutate({ title, eventType: 'event', startDate: new Date(startDate) });
  };

  const handleCreateSermon = () => {
    const title = window.prompt('Sermon title');
    if (!title) return;
    const sermonDate = window.prompt('Sermon date and time (ISO format)', new Date().toISOString());
    if (!sermonDate) return;
    createSermon.mutate({ title, sermonDate: new Date(sermonDate) });
  };

  const handleEditEvent = (event: any) => {
    const title = window.prompt('Event title', event.title);
    if (!title) return;
    const description = window.prompt('Event description', event.description ?? '') ?? event.description ?? '';
    updateEvent.mutate({ id: event._id, title, description });
  };

  const handleEditSermon = (sermon: any) => {
    const title = window.prompt('Sermon title', sermon.title);
    if (!title) return;
    const speaker = window.prompt('Speaker', sermon.speaker ?? '') ?? sermon.speaker ?? '';
    updateSermon.mutate({ id: sermon._id, title, speaker });
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
          <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); setPage(1); setSearchTerm(''); setStatusFilter('all'); }}>
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b border-border rounded-none overflow-x-auto scrollbar-hide" style={{ scrollBehavior: 'smooth' }}>
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
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-3 whitespace-nowrap shrink-0"
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {activeTab !== 'overview' && activeTab !== 'live' && (
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Input value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setPage(1); }} placeholder="Search this section…" aria-label="Search current admin section" />
                <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
                  <option value="all">All statuses</option><option value="new">New</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="read">Read</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="archived">Archived</option><option value="responded">Responded</option>
                </select>
              </div>
            )}

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              <TabState loading={statsLoading} error={statsError} empty={false} label="dashboard statistics" />
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
                    {streamLoading ? (
                      <div className="flex items-center gap-3"><Clock className="w-5 h-5 text-gray-400 animate-pulse" /><div><p className="text-sm font-medium">Checking stream status…</p></div></div>
                    ) : streamError ? (
                      <div className="flex items-center gap-3"><AlertCircle className="w-5 h-5 text-destructive" /><div><p className="text-sm font-medium">Stream status unavailable</p></div></div>
                    ) : activeStream ? (
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
                      <span className={`flex items-center gap-1 text-sm ${statsError ? 'text-red-500' : 'text-green-600'}`}>{statsError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />} {statsLoading ? 'Checking…' : statsError ? 'Unavailable' : 'Connected'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">Streaming</span>
                      <span className={`flex items-center gap-1 text-sm ${streamError ? 'text-red-500' : 'text-green-600'}`}>{streamError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />} {streamLoading ? 'Checking…' : streamError ? 'Unavailable' : activeStream ? 'Live' : 'Ready'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">WebSocket</span>
                      <span className="flex items-center gap-1 text-sm text-slate-500"><Wifi className="w-4 h-4" /> Browser session</span>
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
                <Button className="gap-2" onClick={handleCreateEvent} disabled={createEvent.isPending}>
                  <Plus className="w-4 h-4" />
                  New Event
                </Button>
              </div>
              <TabState loading={eventsLoading} error={eventsError} empty={!eventsLoading && !eventsError && !filteredEvents.length} label="events" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pagedEvents.map((event: any) => (
                  <Card key={event._id} className="p-4 border-border hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-foreground">{event.title}</h4>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleEditEvent(event)}><Edit2 className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteEvent.mutate({ id: event._id })}><Trash2 className="w-4 h-4" /></Button>
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
              <PaginationControls page={page} total={filteredEvents.length} pageSize={pageSize} onChange={setPage} />
            </TabsContent>

            {/* Sermons Tab */}
            <TabsContent value="sermons" className="space-y-6 mt-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-foreground">Sermons Management</h3>
                <Button className="gap-2" onClick={handleCreateSermon} disabled={createSermon.isPending}>
                  <Plus className="w-4 h-4" />
                  Upload Sermon
                </Button>
              </div>
              <TabState loading={sermonsLoading} error={sermonsError} empty={!sermonsLoading && !sermonsError && !filteredSermons.length} label="sermons" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pagedSermons.map((sermon: any) => (
                  <Card key={sermon._id} className="p-4 border-border hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-foreground">{sermon.title}</h4>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleEditSermon(sermon)}><Edit2 className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteSermon.mutate({ id: sermon._id })}><Trash2 className="w-4 h-4" /></Button>
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
              <PaginationControls page={page} total={filteredSermons.length} pageSize={pageSize} onChange={setPage} />
            </TabsContent>

            {/* Live Streaming Tab - MODERN PROFESSIONAL STUDIO */}
            <TabsContent value="live" className="space-y-6 mt-6">
              <ModernLiveStudio />
            </TabsContent>

            {/* Prayer Requests Tab */}
            <TabsContent value="prayer" className="space-y-6 mt-6">
              <h3 className="text-xl font-bold text-foreground">Prayer Requests</h3>
              <TabState loading={prayerLoading} error={prayerError} empty={!prayerLoading && !prayerError && !filteredPrayerRequests.length} label="prayer requests" />
              <div className="space-y-4">
                {pagedPrayerRequests.map((prayer: any) => (
                  <Card key={prayer._id} className="p-4 border-border hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold">{prayer.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{prayer.prayerRequest}</p>
                        <p className="text-xs text-muted-foreground mt-2">{prayer.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => updatePrayer.mutate({ id: prayer._id, status: prayer.status === 'approved' ? 'archived' : 'approved' })}><Eye className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => updatePrayer.mutate({ id: prayer._id, status: 'archived' })}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </Card>
                ))}
                            </div>
              <PaginationControls page={page} total={filteredPrayerRequests.length} pageSize={pageSize} onChange={setPage} />
            </TabsContent>
            {/* Give Tab */}
            <TabsContent value="give" className="space-y-6 mt-6">
              <h3 className="text-xl font-bold text-foreground">Donations</h3>
              <TabState loading={donationsLoading} error={donationsError} empty={!donationsLoading && !donationsError && !filteredDonations.length} label="donations" />
              <div className="space-y-4">
                {pagedDonations.map((donation: any) => (
                  <Card key={donation._id} className="p-4 border-border hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold">{donation.donorName}</h4>
                        <p className="text-sm text-muted-foreground">{donation.email}</p>
                        <p className="text-xs text-muted-foreground">{donation.method} • {donation.purpose || 'General'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{donation.amount.toLocaleString()} {donation.currency}</p>
                        <p className="text-xs text-muted-foreground">{donation.status}</p>
                        {donation.status === 'pending' && <div className="flex gap-2 justify-end mt-2"><Button size="sm" variant="outline" onClick={() => updateDonation.mutate({ id: donation._id, status: 'completed' })}>Confirm</Button><Button size="sm" variant="ghost" onClick={() => updateDonation.mutate({ id: donation._id, status: 'failed' })}>Reject</Button></div>}
                      </div>
                    </div>
                  </Card>
                ))}
                            </div>
              <PaginationControls page={page} total={filteredDonations.length} pageSize={pageSize} onChange={setPage} />
            </TabsContent>
            {/* Contact Tab */}
            <TabsContent value="contact" className="space-y-6 mt-6">
              <h3 className="text-xl font-bold text-foreground">Contact Messages</h3>
              <TabState loading={messagesLoading} error={messagesError} empty={!messagesLoading && !messagesError && !filteredMessages.length} label="contact messages" />
              <div className="space-y-4">
                {pagedMessages.map((msg: any) => (
                  <Card key={msg._id} className="p-4 border-border hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold">{msg.name}</h4>
                        <p className="text-sm text-muted-foreground">{msg.email} {msg.phone ? `• ${msg.phone}` : ''}</p>
                        <p className="text-sm mt-2">{msg.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">Status: {msg.status}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => updateMessage.mutate({ id: msg._id, status: msg.status === 'new' ? 'read' : 'responded' })}><Eye className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => updateMessage.mutate({ id: msg._id, status: 'responded' })}><Send className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <PaginationControls page={page} total={filteredMessages.length} pageSize={pageSize} onChange={setPage} />
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
