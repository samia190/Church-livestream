import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AmbientField from "./components/three/AmbientField";
import NotificationManager from "./components/NotificationManager";
const Home = lazy(() => import("./pages/Home"));
const Auth = lazy(() => import("./pages/Auth"));
const History = lazy(() => import("./pages/History"));
const Leadership = lazy(() => import("./pages/Leadership"));
const Events = lazy(() => import("./pages/Events"));
const Sermons = lazy(() => import("./pages/Sermons"));
const Community = lazy(() => import("./pages/Community"));
const Contact = lazy(() => import("./pages/Contact"));
const Prayer = lazy(() => import("./pages/Prayer"));
const Give = lazy(() => import("./pages/Give"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const LiveStream = lazy(() => import("./pages/LiveStream"));
const WatchLive = lazy(() => import("./pages/WatchLive"));
const RealLiveStream = lazy(() => import("./pages/RealLiveStream"));
const WelcomeJourney = lazy(() => import("./pages/WelcomeJourney"));
const FaithJournal = lazy(() => import("./pages/FaithJournal"));
const PrayerRoom = lazy(() => import("./pages/PrayerRoom"));
const CommunityHub = lazy(() => import("./pages/CommunityHub"));
const Care = lazy(() => import("./pages/Care"));
const FaithInAction = lazy(() => import("./pages/FaithInAction"));
const ScriptureCompanion = lazy(() => import("./pages/ScriptureCompanion"));
const PrayerRoomGatherings = lazy(() => import("./pages/PrayerRoomGatherings"));
const PrayerRoomLive = lazy(() => import("./pages/PrayerRoomLive"));
const ContributorCamera = lazy(() => import("./pages/ContributorCamera"));

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [location]);
  return null;
}

function Router() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <Switch>
        <Route path="/auth" component={Auth} />
        <Route path="/" component={Home} />
        <Route path="/history" component={History} />
        <Route path="/leadership" component={Leadership} />
        <Route path="/events" component={Events} />
        <Route path="/sermons" component={Sermons} />
        <Route path="/community" component={Community} />
        <Route path="/contact" component={Contact} />
        <Route path="/prayer" component={Prayer} />
        <Route path="/give" component={Give} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/livestream" component={LiveStream} />
        <Route path="/watch-live" component={WatchLive} />
        <Route path="/real-live" component={RealLiveStream} />
        <Route path="/journey" component={WelcomeJourney} />
        <Route path="/journal" component={FaithJournal} />
        <Route path="/prayer-room" component={PrayerRoom} />
        <Route path="/community-hub" component={CommunityHub} />
        <Route path="/care" component={Care} />
        <Route path="/faith-in-action" component={FaithInAction} />
        <Route path="/scripture-companion" component={ScriptureCompanion} />
        <Route path="/prayer-gatherings" component={PrayerRoomGatherings} />
        <Route
          path="/prayer-gatherings/:sessionId/live"
          component={PrayerRoomLive}
        />
        <Route path="/contribute/:code" component={ContributorCamera} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <ScrollToTop />
          <Toaster />
          <AmbientField />
          <NotificationManager />
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-lg"
          >
            Skip to main content
          </a>
          <div id="main-content" className="relative z-10" tabIndex={-1}>
            <Router />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
