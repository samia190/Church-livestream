import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AmbientField from "./components/three/AmbientField";
import NotificationManager from "./components/NotificationManager";
const Home = lazy(() => import("./pages/Home"));
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

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>}>
      <Switch>
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
      <ThemeProvider
        defaultTheme="dark"
      >
        <TooltipProvider>
          <Toaster />
          <AmbientField />
          <NotificationManager />
          <div className="relative z-10">
            <Router />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
