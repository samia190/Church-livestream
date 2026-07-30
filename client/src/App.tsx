import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AmbientField from "./components/three/AmbientField";
import NotificationManager from "./components/NotificationManager";
import Home from "./pages/Home";
import History from "./pages/History";
import Leadership from "./pages/Leadership";
import Events from "./pages/Events";
import Sermons from "./pages/Sermons";
import Community from "./pages/Community";
import Contact from "./pages/Contact";
import Prayer from "./pages/Prayer";
import Give from "./pages/Give";
import AdminDashboard from "./pages/AdminDashboard";
import LiveStream from "./pages/LiveStream";
import WatchLive from "./pages/WatchLive";
import RealLiveStream from "./pages/RealLiveStream";

function Router() {
  return (
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
