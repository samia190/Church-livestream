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
  LogOut,
  Users,
  Calendar,
  Music,
  Radio,
  Settings,
  MessageSquare,
  DollarSign,
  BarChart3,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Download,
  Video,
  Camera,
  Globe,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  Wifi,
  WifiOff,
  Play,
  Square,
  Monitor,
  Sliders,
  Send,
  HeartHandshake,
} from "lucide-react";

function TabState({
  loading,
  error,
  empty,
  label,
}: {
  loading?: boolean;
  error?: unknown;
  empty: boolean;
  label: string;
}) {
  if (loading)
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Loading {label}…
      </Card>
    );
  if (error)
    return (
      <Card className="p-8 text-center text-destructive">
        Unable to load {label}. Please retry.
      </Card>
    );
  if (empty)
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No {label} found.
      </Card>
    );
  return null;
}

function PaginationControls({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-4">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {pages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedCareCaseId, setSelectedCareCaseId] = useState<string | null>(
    null
  );
  const pageSize = 8;
  const isAdmin = !authLoading && user?.role === "admin";

  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/");
  }, [user, setLocation]);

  // Fetch data
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = trpc.dashboard.getStats.useQuery(undefined, { enabled: isAdmin });
  const {
    data: events,
    isLoading: eventsLoading,
    error: eventsError,
  } = trpc.events.getAll.useQuery(undefined, { enabled: isAdmin });
  const {
    data: sermons,
    isLoading: sermonsLoading,
    error: sermonsError,
  } = trpc.sermons.getAll.useQuery(undefined, { enabled: isAdmin });
  const {
    data: activeStream,
    isLoading: streamLoading,
    error: streamError,
  } = trpc.streaming.getActiveStream.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 10000,
  });
  const {
    data: prayerRequests,
    isLoading: prayerLoading,
    error: prayerError,
  } = trpc.adminContent.getPrayerRequests.useQuery(undefined, {
    enabled: isAdmin,
  });
  const {
    data: donations,
    isLoading: donationsLoading,
    error: donationsError,
  } = trpc.adminContent.getDonations.useQuery(undefined, { enabled: isAdmin });
  const {
    data: messages,
    isLoading: messagesLoading,
    error: messagesError,
  } = trpc.adminContent.getContactMessages.useQuery(undefined, {
    enabled: isAdmin,
  });
  const {
    data: careRequests,
    isLoading: careLoading,
    error: careError,
  } = trpc.adminContent.getCareRequests.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: careNotes = [] } = trpc.adminContent.getCareCaseNotes.useQuery(
    { id: selectedCareCaseId ?? "" },
    { enabled: isAdmin && Boolean(selectedCareCaseId) }
  );
  const { data: careActivity = [] } =
    trpc.adminContent.getCareCaseActivity.useQuery(
      { id: selectedCareCaseId ?? "" },
      { enabled: isAdmin && Boolean(selectedCareCaseId) }
    );
  const {
    data: circles,
    isLoading: circlesLoading,
    error: circlesError,
  } = trpc.adminCircles.list.useQuery(undefined, { enabled: isAdmin });
  const { data: circleRequests, isLoading: circleRequestsLoading } =
    trpc.adminCircles.requests.useQuery(undefined, { enabled: isAdmin });
  const {
    data: prayerSessions = [],
    isLoading: prayerSessionsLoading,
    error: prayerSessionsError,
  } = trpc.adminPrayerRoom.list.useQuery(undefined, { enabled: isAdmin });
  const {
    data: serviceOpportunities = [],
    isLoading: serviceLoading,
    error: serviceError,
  } = trpc.adminService.list.useQuery(undefined, { enabled: isAdmin });
  const { data: serviceSignups = [], isLoading: serviceSignupsLoading } =
    trpc.adminService.signups.useQuery(undefined, { enabled: isAdmin });
  const utils = trpc.useUtils();
  const deleteEvent = trpc.events.delete.useMutation({
    onSuccess: () => utils.events.getAll.invalidate(),
  });
  const createEvent = trpc.events.create.useMutation({
    onSuccess: () => {
      utils.events.getAll.invalidate();
      toast.success("Event created");
    },
  });
  const updateEvent = trpc.events.update.useMutation({
    onSuccess: () => {
      utils.events.getAll.invalidate();
      toast.success("Event updated");
    },
  });
  const deleteSermon = trpc.sermons.delete.useMutation({
    onSuccess: () => utils.sermons.getAll.invalidate(),
  });
  const createSermon = trpc.sermons.create.useMutation({
    onSuccess: () => {
      utils.sermons.getAll.invalidate();
      toast.success("Sermon created");
    },
  });
  const updateSermon = trpc.sermons.update.useMutation({
    onSuccess: () => {
      utils.sermons.getAll.invalidate();
      toast.success("Sermon updated");
    },
  });
  const updatePrayer = trpc.adminContent.updatePrayerRequestStatus.useMutation({
    onSuccess: () => utils.adminContent.getPrayerRequests.invalidate(),
  });
  const updateDonation = trpc.adminContent.updateDonationStatus.useMutation({
    onSuccess: () => utils.adminContent.getDonations.invalidate(),
  });
  const updateMessage =
    trpc.adminContent.updateContactMessageStatus.useMutation({
      onSuccess: () => utils.adminContent.getContactMessages.invalidate(),
    });
  const updateCare = trpc.adminContent.updateCareRequestStatus.useMutation({
    onSuccess: () => utils.adminContent.getCareRequests.invalidate(),
  });
  const updateCareCase = trpc.adminContent.updateCareCase.useMutation({
    onSuccess: () => {
      utils.adminContent.getCareRequests.invalidate();
      utils.adminContent.getCareCaseActivity.invalidate();
    },
  });
  const assignCare = trpc.adminContent.assignCareRequest.useMutation({
    onSuccess: () => {
      utils.adminContent.getCareRequests.invalidate();
      utils.adminContent.getCareCaseActivity.invalidate();
      toast.success("Care assignment updated");
    },
  });
  const addCareNote = trpc.adminContent.addCareCaseNote.useMutation({
    onSuccess: () => {
      utils.adminContent.getCareCaseNotes.invalidate();
      utils.adminContent.getCareCaseActivity.invalidate();
      toast.success("Private case note saved");
    },
  });
  const createCircle = trpc.adminCircles.create.useMutation({
    onSuccess: () => {
      utils.adminCircles.list.invalidate();
      toast.success("Circle created");
    },
  });
  const updateCircle = trpc.adminCircles.update.useMutation({
    onSuccess: () => {
      utils.adminCircles.list.invalidate();
      toast.success("Circle updated");
    },
  });
  const moderateCircleMembership =
    trpc.adminCircles.moderateMembership.useMutation({
      onSuccess: () => {
        utils.adminCircles.requests.invalidate();
        toast.success("Membership updated");
      },
    });
  const createPrayerSession = trpc.adminPrayerRoom.create.useMutation({
    onSuccess: () => {
      utils.adminPrayerRoom.list.invalidate();
      toast.success("Prayer gathering created");
    },
  });
  const updatePrayerSession = trpc.adminPrayerRoom.update.useMutation({
    onSuccess: () => {
      utils.adminPrayerRoom.list.invalidate();
      utils.prayerRoom.upcoming.invalidate();
      toast.success("Prayer gathering updated");
    },
  });
  const createServiceOpportunity = trpc.adminService.create.useMutation({
    onSuccess: () => {
      utils.adminService.list.invalidate();
      toast.success("Service opportunity created");
    },
  });
  const updateServiceOpportunity = trpc.adminService.update.useMutation({
    onSuccess: () => {
      utils.adminService.list.invalidate();
      utils.service.list.invalidate();
      toast.success("Service opportunity updated");
    },
  });
  const updateServiceSignup = trpc.adminService.updateSignup.useMutation({
    onSuccess: () => {
      utils.adminService.signups.invalidate();
      toast.success("Volunteer signup updated");
    },
  });

  const filterRecords = (records: any[] | undefined) => {
    const query = searchTerm.trim().toLowerCase();
    return (records ?? []).filter(record => {
      const matchesSearch =
        !query || JSON.stringify(record).toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        !record.status ||
        record.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  };
  const filteredEvents = filterRecords(events);
  const filteredSermons = filterRecords(sermons);
  const filteredPrayerRequests = filterRecords(prayerRequests);
  const filteredDonations = filterRecords(donations);
  const filteredMessages = filterRecords(messages);
  const filteredCareRequests = filterRecords(careRequests);
  const paginate = (records: any[]) =>
    records.slice((page - 1) * pageSize, page * pageSize);
  const pagedEvents = paginate(filteredEvents);
  const pagedSermons = paginate(filteredSermons);
  const pagedPrayerRequests = paginate(filteredPrayerRequests);
  const pagedDonations = paginate(filteredDonations);
  const pagedMessages = paginate(filteredMessages);
  const pagedCareRequests = paginate(filteredCareRequests);

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
    setLocation("/");
  };

  const handleCreateEvent = () => {
    const title = window.prompt("Event title");
    if (!title) return;
    const startDate = window.prompt(
      "Start date and time (ISO format)",
      new Date().toISOString()
    );
    if (!startDate) return;
    createEvent.mutate({
      title,
      eventType: "event",
      startDate: new Date(startDate),
    });
  };

  const handleCreateSermon = () => {
    const title = window.prompt("Sermon title");
    if (!title) return;
    const sermonDate = window.prompt(
      "Sermon date and time (ISO format)",
      new Date().toISOString()
    );
    if (!sermonDate) return;
    createSermon.mutate({ title, sermonDate: new Date(sermonDate) });
  };

  const handleEditEvent = (event: any) => {
    const title = window.prompt("Event title", event.title);
    if (!title) return;
    const description =
      window.prompt("Event description", event.description ?? "") ??
      event.description ??
      "";
    updateEvent.mutate({ id: event._id, title, description });
  };

  const handleEditSermon = (sermon: any) => {
    const title = window.prompt("Sermon title", sermon.title);
    if (!title) return;
    const speaker =
      window.prompt("Speaker", sermon.speaker ?? "") ?? sermon.speaker ?? "";
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
        <motion.div
          variants={itemVariants}
          className="flex justify-between items-center"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Admin Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your church website and live streaming
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={itemVariants}>
          <Tabs
            value={activeTab}
            onValueChange={tab => {
              setActiveTab(tab);
              setPage(1);
              setSearchTerm("");
              setStatusFilter("all");
            }}
          >
            <TabsList
              className="w-full justify-start h-auto p-0 bg-transparent border-b border-border rounded-none overflow-x-auto scrollbar-hide"
              style={{ scrollBehavior: "smooth" }}
            >
              {[
                { id: "overview", label: "Overview", icon: BarChart3 },
                { id: "events", label: "Events", icon: Calendar },
                { id: "sermons", label: "Sermons", icon: Music },
                { id: "live", label: "Live Stream", icon: Radio },
                { id: "prayer", label: "Prayer", icon: MessageSquare },
                { id: "give", label: "Give", icon: DollarSign },
                { id: "contact", label: "Contact", icon: MessageSquare },
                { id: "circles", label: "Trusted Circles", icon: Users },
                { id: "gatherings", label: "Prayer Gatherings", icon: Radio },
                {
                  id: "service",
                  label: "Faith in Action",
                  icon: HeartHandshake,
                },
                { id: "care", label: "Pastoral Care", icon: HeartHandshake },
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
            {activeTab !== "overview" && activeTab !== "live" && (
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Input
                  value={searchTerm}
                  onChange={event => {
                    setSearchTerm(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search this section…"
                  aria-label="Search current admin section"
                />
                <select
                  value={statusFilter}
                  onChange={event => {
                    setStatusFilter(event.target.value);
                    setPage(1);
                  }}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="all">All statuses</option>
                  <option value="new">New</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="read">Read</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="archived">Archived</option>
                  <option value="responded">Responded</option>
                </select>
              </div>
            )}

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              <TabState
                loading={statsLoading}
                error={statsError}
                empty={false}
                label="dashboard statistics"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: "Members",
                    value: stats?.members ?? 0,
                    icon: Users,
                    color: "text-blue-500",
                  },
                  {
                    label: "Events",
                    value: stats?.events ?? 0,
                    icon: Calendar,
                    color: "text-green-500",
                  },
                  {
                    label: "Sermons",
                    value: stats?.sermons ?? 0,
                    icon: Music,
                    color: "text-purple-500",
                  },
                  {
                    label: "Prayer Requests",
                    value: stats?.prayerRequests ?? 0,
                    icon: MessageSquare,
                    color: "text-orange-500",
                  },
                ].map((stat, i) => (
                  <Card key={i} className="p-6">
                    <div className="flex items-center gap-4">
                      <stat.icon className={`w-8 h-8 ${stat.color}`} />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {stat.label}
                        </p>
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
                        <p className="text-xs text-muted-foreground">
                          All systems operational
                        </p>
                      </div>
                    </div>
                    {streamLoading ? (
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-gray-400 animate-pulse" />
                        <div>
                          <p className="text-sm font-medium">
                            Checking stream status…
                          </p>
                        </div>
                      </div>
                    ) : streamError ? (
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-destructive" />
                        <div>
                          <p className="text-sm font-medium">
                            Stream status unavailable
                          </p>
                        </div>
                      </div>
                    ) : activeStream ? (
                      <div className="flex items-center gap-3">
                        <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                        <div>
                          <p className="text-sm font-medium">
                            Live Stream Active
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activeStream.title}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <WifiOff className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">
                            No Active Stream
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Start a live stream from the Live Stream tab
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4">Quick Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">
                        Database
                      </span>
                      <span
                        className={`flex items-center gap-1 text-sm ${statsError ? "text-red-500" : "text-green-600"}`}
                      >
                        {statsError ? (
                          <AlertCircle className="w-4 h-4" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}{" "}
                        {statsLoading
                          ? "Checking…"
                          : statsError
                            ? "Unavailable"
                            : "Connected"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">
                        Streaming
                      </span>
                      <span
                        className={`flex items-center gap-1 text-sm ${streamError ? "text-red-500" : "text-green-600"}`}
                      >
                        {streamError ? (
                          <AlertCircle className="w-4 h-4" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}{" "}
                        {streamLoading
                          ? "Checking…"
                          : streamError
                            ? "Unavailable"
                            : activeStream
                              ? "Live"
                              : "Ready"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">
                        WebSocket
                      </span>
                      <span className="flex items-center gap-1 text-sm text-slate-500">
                        <Wifi className="w-4 h-4" /> Browser session
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">
                        Live Viewers
                      </span>
                      <span className="text-sm font-bold">
                        {stats?.liveViewers ?? 0}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* Events Tab */}
            <TabsContent value="events" className="space-y-6 mt-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-foreground">
                  Events Management
                </h3>
                <Button
                  className="gap-2"
                  onClick={handleCreateEvent}
                  disabled={createEvent.isPending}
                >
                  <Plus className="w-4 h-4" />
                  New Event
                </Button>
              </div>
              <TabState
                loading={eventsLoading}
                error={eventsError}
                empty={!eventsLoading && !eventsError && !filteredEvents.length}
                label="events"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pagedEvents.map((event: any) => (
                  <Card
                    key={event._id}
                    className="p-4 border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-foreground">
                        {event.title}
                      </h4>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditEvent(event)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteEvent.mutate({ id: event._id })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {event.description}
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(event.startDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      {event.startDate &&
                        ` at ${new Date(event.startDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`}
                    </div>
                  </Card>
                ))}
              </div>
              <PaginationControls
                page={page}
                total={filteredEvents.length}
                pageSize={pageSize}
                onChange={setPage}
              />
            </TabsContent>

            {/* Sermons Tab */}
            <TabsContent value="sermons" className="space-y-6 mt-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-foreground">
                  Sermons Management
                </h3>
                <Button
                  className="gap-2"
                  onClick={handleCreateSermon}
                  disabled={createSermon.isPending}
                >
                  <Plus className="w-4 h-4" />
                  Upload Sermon
                </Button>
              </div>
              <TabState
                loading={sermonsLoading}
                error={sermonsError}
                empty={
                  !sermonsLoading && !sermonsError && !filteredSermons.length
                }
                label="sermons"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pagedSermons.map((sermon: any) => (
                  <Card
                    key={sermon._id}
                    className="p-4 border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-foreground">
                        {sermon.title}
                      </h4>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditSermon(sermon)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            deleteSermon.mutate({ id: sermon._id })
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      By {sermon.speaker || "Unknown"}
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <Music className="w-3 h-3" />
                      {sermon.sermonDate
                        ? new Date(sermon.sermonDate).toLocaleDateString(
                            "en-US",
                            { year: "numeric", month: "long", day: "numeric" }
                          )
                        : "No date"}
                    </div>
                  </Card>
                ))}
              </div>
              <PaginationControls
                page={page}
                total={filteredSermons.length}
                pageSize={pageSize}
                onChange={setPage}
              />
            </TabsContent>

            {/* Live Streaming Tab - MODERN PROFESSIONAL STUDIO */}
            <TabsContent value="live" className="space-y-6 mt-6">
              <ModernLiveStudio />
            </TabsContent>

            {/* Prayer Requests Tab */}
            <TabsContent value="prayer" className="space-y-6 mt-6">
              <h3 className="text-xl font-bold text-foreground">
                Prayer Requests
              </h3>
              <TabState
                loading={prayerLoading}
                error={prayerError}
                empty={
                  !prayerLoading &&
                  !prayerError &&
                  !filteredPrayerRequests.length
                }
                label="prayer requests"
              />
              <div className="space-y-4">
                {pagedPrayerRequests.map((prayer: any) => (
                  <Card
                    key={prayer._id}
                    className="p-4 border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold">{prayer.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {prayer.prayerRequest}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {prayer.email}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updatePrayer.mutate({
                              id: prayer._id,
                              status:
                                prayer.status === "approved"
                                  ? "archived"
                                  : "approved",
                            })
                          }
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updatePrayer.mutate({
                              id: prayer._id,
                              status: "archived",
                            })
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <PaginationControls
                page={page}
                total={filteredPrayerRequests.length}
                pageSize={pageSize}
                onChange={setPage}
              />
            </TabsContent>
            {/* Give Tab */}
            <TabsContent value="give" className="space-y-6 mt-6">
              <h3 className="text-xl font-bold text-foreground">Donations</h3>
              <TabState
                loading={donationsLoading}
                error={donationsError}
                empty={
                  !donationsLoading &&
                  !donationsError &&
                  !filteredDonations.length
                }
                label="donations"
              />
              <div className="space-y-4">
                {pagedDonations.map((donation: any) => (
                  <Card
                    key={donation._id}
                    className="p-4 border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold">{donation.donorName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {donation.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {donation.method} • {donation.purpose || "General"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {donation.amount.toLocaleString()} {donation.currency}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {donation.status}
                        </p>
                        {donation.status === "pending" && (
                          <div className="flex gap-2 justify-end mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateDonation.mutate({
                                  id: donation._id,
                                  status: "completed",
                                })
                              }
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                updateDonation.mutate({
                                  id: donation._id,
                                  status: "failed",
                                })
                              }
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <PaginationControls
                page={page}
                total={filteredDonations.length}
                pageSize={pageSize}
                onChange={setPage}
              />
            </TabsContent>
            {/* Contact Tab */}
            <TabsContent value="contact" className="space-y-6 mt-6">
              <h3 className="text-xl font-bold text-foreground">
                Contact Messages
              </h3>
              <TabState
                loading={messagesLoading}
                error={messagesError}
                empty={
                  !messagesLoading && !messagesError && !filteredMessages.length
                }
                label="contact messages"
              />
              <div className="space-y-4">
                {pagedMessages.map((msg: any) => (
                  <Card
                    key={msg._id}
                    className="p-4 border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold">{msg.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {msg.email} {msg.phone ? `• ${msg.phone}` : ""}
                        </p>
                        <p className="text-sm mt-2">{msg.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Status: {msg.status}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updateMessage.mutate({
                              id: msg._id,
                              status:
                                msg.status === "new" ? "read" : "responded",
                            })
                          }
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updateMessage.mutate({
                              id: msg._id,
                              status: "responded",
                            })
                          }
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <PaginationControls
                page={page}
                total={filteredMessages.length}
                pageSize={pageSize}
                onChange={setPage}
              />
            </TabsContent>
            {/* Faith in Action Tab */}
            <TabsContent value="service" className="space-y-6 mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-foreground">
                    Faith in Action
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Publish service opportunities and help ministry leaders
                    follow up with volunteers.
                  </p>
                </div>
                <Button
                  className="gap-2"
                  onClick={() => {
                    const title = window.prompt("Opportunity title");
                    if (!title) return;
                    const description = window.prompt(
                      "Opportunity description"
                    );
                    if (!description) return;
                    const category = (window.prompt(
                      "Category: visitation, students, food, environment, skills, outreach, or other",
                      "outreach"
                    ) ?? "outreach") as
                      | "visitation"
                      | "students"
                      | "food"
                      | "environment"
                      | "skills"
                      | "outreach"
                      | "other";
                    if (
                      ![
                        "visitation",
                        "students",
                        "food",
                        "environment",
                        "skills",
                        "outreach",
                        "other",
                      ].includes(category)
                    ) {
                      toast.error("Invalid category");
                      return;
                    }
                    const location = window.prompt("Location (optional)") ?? "";
                    const startsAt = window.prompt(
                      "Start date and time (ISO format, optional)",
                      ""
                    );
                    const spots = Number(
                      window.prompt("Number of places (0 means open)", "0")
                    );
                    if (!Number.isInteger(spots) || spots < 0) {
                      toast.error(
                        "Places must be zero or a positive whole number"
                      );
                      return;
                    }
                    createServiceOpportunity.mutate({
                      title,
                      description,
                      category,
                      location: location || undefined,
                      startsAt: startsAt?.trim() ? new Date(startsAt) : null,
                      spots,
                    });
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Create opportunity
                </Button>
              </div>
              <TabState
                loading={serviceLoading}
                error={serviceError}
                empty={
                  !serviceLoading &&
                  !serviceError &&
                  !(serviceOpportunities as any[]).length
                }
                label="service opportunities"
              />
              <div className="grid lg:grid-cols-2 gap-4">
                {(serviceOpportunities as any[]).map(opportunity => (
                  <Card key={String(opportunity._id)} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold">{opportunity.title}</h4>
                        <p className="text-xs text-muted-foreground capitalize">
                          {opportunity.category} ·{" "}
                          {opportunity.spots > 0
                            ? `${opportunity.spots} places`
                            : "Open participation"}
                        </p>
                      </div>
                      <span
                        className={`text-xs rounded-full px-2 py-1 ${opportunity.isActive ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}
                      >
                        {opportunity.isActive ? "Published" : "Hidden"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">
                      {opportunity.description}
                    </p>
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateServiceOpportunity.mutate({
                            id: String(opportunity._id),
                            isActive: !opportunity.isActive,
                          })
                        }
                      >
                        {opportunity.isActive ? "Hide" : "Publish"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const spots = Number(
                            window.prompt(
                              "Places (0 means open)",
                              String(opportunity.spots)
                            )
                          );
                          if (!Number.isInteger(spots) || spots < 0) {
                            toast.error("Enter a valid number");
                            return;
                          }
                          updateServiceOpportunity.mutate({
                            id: String(opportunity._id),
                            spots,
                          });
                        }}
                      >
                        Update places
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
              <Card className="p-5">
                <h4 className="font-bold mb-4">Volunteer roster</h4>
                {serviceSignupsLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading signups…
                  </p>
                ) : !(serviceSignups as any[]).length ? (
                  <p className="text-sm text-muted-foreground">
                    No volunteer interests yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(serviceSignups as any[]).map(signup => (
                      <div
                        key={String(signup._id)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3 last:border-0"
                      >
                        <div>
                          <p className="font-medium">
                            {signup.user?.name ||
                              signup.user?.email ||
                              signup.userOpenId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {signup.opportunity?.title || signup.opportunityId}{" "}
                            · {signup.status}
                          </p>
                        </div>
                        <select
                          value={signup.status}
                          onChange={event =>
                            updateServiceSignup.mutate({
                              id: String(signup._id),
                              status: event.target.value as
                                "interested" | "confirmed" | "cancelled",
                            })
                          }
                          className="h-9 rounded-md border border-border bg-background px-2 text-xs"
                        >
                          <option value="interested">Interested</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Prayer Gatherings Tab */}
            <TabsContent value="gatherings" className="space-y-6 mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-foreground">
                    Prayer Room Gatherings
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Create moderated sessions, publish schedules, and reveal a
                    provider link only when the room is live.
                  </p>
                </div>
                <Button
                  className="gap-2"
                  onClick={() => {
                    const title = window.prompt("Gathering title");
                    if (!title) return;
                    const description = window.prompt("Gathering description");
                    if (!description) return;
                    const startsAt = window.prompt(
                      "Start date and time (ISO format)",
                      new Date(Date.now() + 86400000).toISOString()
                    );
                    if (
                      !startsAt ||
                      Number.isNaN(new Date(startsAt).getTime())
                    ) {
                      toast.error("Enter a valid start date");
                      return;
                    }
                    const mode = (window.prompt(
                      "Mode: voice-video or voice",
                      "voice-video"
                    ) ?? "voice-video") as "voice-video" | "voice";
                    if (!["voice-video", "voice"].includes(mode)) {
                      toast.error("Invalid mode");
                      return;
                    }
                    const capacity = Number(window.prompt("Capacity", "30"));
                    if (!Number.isInteger(capacity) || capacity < 2) {
                      toast.error("Capacity must be at least 2");
                      return;
                    }
                    const joinUrl =
                      window.prompt(
                        "Optional provider room URL (Zoom, Meet, Jitsi, Daily, or LiveKit)"
                      ) ?? "";
                    createPrayerSession.mutate({
                      title,
                      description,
                      startsAt: new Date(startsAt),
                      durationMinutes: Number(
                        window.prompt("Duration in minutes", "60") ?? 60
                      ),
                      mode,
                      capacity,
                      joinUrl: joinUrl.trim() || undefined,
                      isPublished: true,
                    });
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Create gathering
                </Button>
              </div>
              <TabState
                loading={prayerSessionsLoading}
                error={prayerSessionsError}
                empty={
                  !prayerSessionsLoading &&
                  !prayerSessionsError &&
                  !(prayerSessions as any[]).length
                }
                label="Prayer Room gatherings"
              />
              <div className="space-y-4">
                {(prayerSessions as any[]).map(session => (
                  <Card key={String(session._id)} className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h4 className="font-bold text-lg">{session.title}</h4>
                          <span className="text-xs rounded-full px-2 py-1 bg-muted capitalize">
                            {session.status}
                          </span>
                          <span
                            className={`text-xs rounded-full px-2 py-1 ${session.isPublished ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}
                          >
                            {session.isPublished ? "Published" : "Draft"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(session.startsAt).toLocaleString()} ·{" "}
                          {session.durationMinutes} minutes ·{" "}
                          {session.mode === "voice-video"
                            ? "Voice + video"
                            : "Voice only"}{" "}
                          · capacity {session.capacity}
                        </p>
                        <p className="text-sm mt-3">{session.description}</p>
                        <p className="text-xs text-muted-foreground mt-3">
                          {session.joinUrl
                            ? "Provider link configured; it will be shown to registered members only when the session is live."
                            : "No provider link configured yet."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const joinUrl = window.prompt(
                              "Provider room URL (blank clears)",
                              session.joinUrl ?? ""
                            );
                            if (joinUrl === null) return;
                            if (
                              joinUrl.trim() &&
                              !/^https:\/\//i.test(joinUrl.trim())
                            ) {
                              toast.error("Use an HTTPS meeting URL");
                              return;
                            }
                            updatePrayerSession.mutate({
                              id: String(session._id),
                              joinUrl: joinUrl.trim() || null,
                            });
                          }}
                        >
                          {session.joinUrl ? "Change link" : "Add link"}
                        </Button>
                        {session.status === "scheduled" && (
                          <Button
                            size="sm"
                            onClick={() =>
                              updatePrayerSession.mutate({
                                id: String(session._id),
                                status: "live",
                              })
                            }
                          >
                            Start room
                          </Button>
                        )}
                        {session.status === "live" && !session.joinUrl && (
                          <Button
                            size="sm"
                            onClick={() =>
                              window.open(
                                `/prayer-gatherings/${String(session._id)}/live`,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                          >
                            Open host room
                          </Button>
                        )}
                        {session.status === "live" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updatePrayerSession.mutate({
                                id: String(session._id),
                                status: "ended",
                              })
                            }
                          >
                            End room
                          </Button>
                        )}
                        {session.status === "scheduled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updatePrayerSession.mutate({
                                id: String(session._id),
                                isPublished: !session.isPublished,
                              })
                            }
                          >
                            {session.isPublished ? "Unpublish" : "Publish"}
                          </Button>
                        )}
                        {session.status !== "ended" &&
                          session.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() =>
                                updatePrayerSession.mutate({
                                  id: String(session._id),
                                  status: "cancelled",
                                })
                              }
                            >
                              Cancel
                            </Button>
                          )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Trusted Circles Tab */}
            <TabsContent value="circles" className="space-y-6 mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-foreground">
                    Trusted Circles
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Publish healthy communities, assign leaders, and review
                    consent-based membership.
                  </p>
                </div>
                <Button
                  className="gap-2"
                  onClick={() => {
                    const name = window.prompt("Circle name");
                    if (!name) return;
                    const description = window.prompt("Circle description");
                    if (!description) return;
                    const meetingDetails =
                      window.prompt("Meeting details (optional)") ?? "";
                    const category = window.prompt(
                      "Category: prayer, small-group, youth, service, or family",
                      "prayer"
                    ) as
                      "prayer" | "small-group" | "youth" | "service" | "family";
                    if (
                      ![
                        "prayer",
                        "small-group",
                        "youth",
                        "service",
                        "family",
                      ].includes(category)
                    ) {
                      toast.error("Invalid circle category");
                      return;
                    }
                    const leaderOpenId =
                      window.prompt("Leader account openId (optional)") ??
                      undefined;
                    createCircle.mutate({
                      name,
                      description,
                      category,
                      meetingDetails,
                      leaderOpenId,
                    });
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Create circle
                </Button>
              </div>
              <TabState
                loading={circlesLoading}
                error={circlesError}
                empty={
                  !circlesLoading && !circlesError && !(circles ?? []).length
                }
                label="circles"
              />
              <div className="grid lg:grid-cols-2 gap-4">
                {(circles ?? []).map((circle: any) => (
                  <Card key={String(circle._id)} className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold">{circle.name}</h4>
                        <p className="text-sm text-muted-foreground capitalize">
                          {circle.category.replace("-", " ")} ·{" "}
                          {circle.leaderOpenId
                            ? `Leader: ${circle.leaderOpenId}`
                            : "Leader not assigned"}
                        </p>
                      </div>
                      <span
                        className={`text-xs rounded-full px-2 py-1 ${circle.isActive ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}
                      >
                        {circle.isActive ? "Active" : "Hidden"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {circle.description}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const leaderOpenId = window.prompt(
                            "Leader account openId (blank clears)",
                            circle.leaderOpenId ?? ""
                          );
                          updateCircle.mutate({
                            id: String(circle._id),
                            leaderOpenId: leaderOpenId?.trim() || null,
                          });
                        }}
                      >
                        {circle.leaderOpenId
                          ? "Change leader"
                          : "Assign leader"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateCircle.mutate({
                            id: String(circle._id),
                            isActive: !circle.isActive,
                          })
                        }
                      >
                        {circle.isActive ? "Hide" : "Publish"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
              <Card className="p-5">
                <h4 className="font-bold mb-4">Pending membership requests</h4>
                {circleRequestsLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading requests…
                  </p>
                ) : !(circleRequests ?? []).length ? (
                  <p className="text-sm text-muted-foreground">
                    No pending requests.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(circleRequests ?? []).map((request: any) => (
                      <div
                        key={String(request._id)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3 last:border-0"
                      >
                        <div>
                          <p className="font-medium">
                            {request.user?.name ||
                              request.user?.email ||
                              request.userOpenId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {request.circle?.name || request.circleId} ·
                            Requested{" "}
                            {new Date(request.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              moderateCircleMembership.mutate({
                                membershipId: String(request._id),
                                status: "active",
                              })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              moderateCircleMembership.mutate({
                                membershipId: String(request._id),
                                status: "left",
                              })
                            }
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Pastoral Care Tab */}
            <TabsContent value="care" className="space-y-6 mt-6">
              <h3 className="text-xl font-bold text-foreground">
                Pastoral Care Queue
              </h3>
              <TabState
                loading={careLoading}
                error={careError}
                empty={
                  !careLoading && !careError && !filteredCareRequests.length
                }
                label="care requests"
              />
              <div className="space-y-4">
                {pagedCareRequests.map((request: any) => (
                  <Card
                    key={String(request._id)}
                    className="p-4 border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold capitalize">
                              {String(request.category).replaceAll("-", " ")}
                            </h4>
                            {request.safeguardingFlag && (
                              <span className="text-xs text-destructive font-semibold">
                                Safeguarding attention
                              </span>
                            )}
                            <span
                              className={`text-xs rounded-full px-2 py-0.5 ${request.priority === "urgent" ? "bg-destructive/10 text-destructive" : request.priority === "high" ? "bg-amber-500/10 text-amber-700" : "bg-muted text-muted-foreground"}`}
                            >
                              {request.priority ?? "routine"} priority
                            </span>
                          </div>
                          <p className="text-sm mt-2 whitespace-pre-wrap">
                            {request.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Submitted{" "}
                            {new Date(request.createdAt).toLocaleString()}
                            {request.assignedToOpenId
                              ? ` · Assigned: ${request.assignedToOpenId}`
                              : " · Unassigned"}
                            {request.dueAt
                              ? ` · Due: ${new Date(request.dueAt).toLocaleString()}`
                              : ""}
                          </p>
                        </div>
                        <select
                          value={request.status}
                          onChange={event =>
                            updateCare.mutate({
                              id: String(request._id),
                              status: event.target.value as
                                | "new"
                                | "assigned"
                                | "in-progress"
                                | "closed"
                                | "escalated",
                            })
                          }
                          className="h-9 rounded-md border border-border bg-background px-2 text-xs capitalize"
                        >
                          <option value="new">New</option>
                          <option value="assigned">Assigned</option>
                          <option value="in-progress">In progress</option>
                          <option value="closed">Closed</option>
                          <option value="escalated">Escalated</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const assignedToOpenId = window.prompt(
                              "Care team member account openId (blank clears)",
                              request.assignedToOpenId ?? ""
                            );
                            assignCare.mutate({
                              id: String(request._id),
                              assignedToOpenId:
                                assignedToOpenId?.trim() || null,
                            });
                          }}
                        >
                          Assign
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const priority = window.prompt(
                              "Priority: routine, high, or urgent",
                              request.priority ?? "routine"
                            ) as "routine" | "high" | "urgent";
                            if (
                              !["routine", "high", "urgent"].includes(priority)
                            ) {
                              toast.error("Invalid priority");
                              return;
                            }
                            updateCareCase.mutate({
                              id: String(request._id),
                              priority,
                            });
                          }}
                        >
                          Set priority
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const dueAt = window.prompt(
                              "Response deadline (ISO date/time); leave blank to clear",
                              request.dueAt
                                ? new Date(request.dueAt).toISOString()
                                : ""
                            );
                            if (dueAt === null) return;
                            if (
                              dueAt.trim() &&
                              Number.isNaN(new Date(dueAt).getTime())
                            ) {
                              toast.error("Enter a valid date/time");
                              return;
                            }
                            updateCareCase.mutate({
                              id: String(request._id),
                              dueAt: dueAt.trim() ? new Date(dueAt) : null,
                            });
                          }}
                        >
                          Set deadline
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const content = window.prompt(
                              "Private case note — visible only to verified administrators"
                            );
                            if (!content?.trim()) return;
                            addCareNote.mutate({
                              id: String(request._id),
                              content: content.trim(),
                            });
                          }}
                        >
                          Add private note
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedCareCaseId(String(request._id))
                          }
                        >
                          Case history
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              {selectedCareCaseId && (
                <Card className="p-5">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <h4 className="font-bold">Private case history</h4>
                      <p className="text-xs text-muted-foreground">
                        Notes and activity are visible only to verified
                        administrators.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedCareCaseId(null)}
                    >
                      Close
                    </Button>
                  </div>
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-medium mb-3">Private notes</h5>
                      {careNotes.length ? (
                        <div className="space-y-3">
                          {careNotes.map((note: any) => (
                            <div
                              key={String(note._id)}
                              className="rounded-lg border border-border p-3"
                            >
                              <p className="text-sm whitespace-pre-wrap">
                                {note.content}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {note.authorOpenId} ·{" "}
                                {new Date(note.createdAt).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No private notes yet.
                        </p>
                      )}
                    </div>
                    <div>
                      <h5 className="font-medium mb-3">Activity</h5>
                      {careActivity.length ? (
                        <ol className="space-y-3">
                          {careActivity.map((activity: any) => (
                            <li
                              key={String(activity._id)}
                              className="text-sm border-l-2 border-ember/40 pl-3"
                            >
                              <p>{activity.summary}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {activity.actorOpenId} ·{" "}
                                {new Date(activity.createdAt).toLocaleString()}
                              </p>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No recorded activity yet.
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              )}
              <PaginationControls
                page={page}
                total={filteredCareRequests.length}
                pageSize={pageSize}
                onChange={setPage}
              />
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
