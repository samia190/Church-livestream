import { useEffect, useState } from 'react';
import { Bell, BellOff, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

type NotificationPreferences = {
  browserNotifications: boolean;
  prayerRoom: boolean;
  sermons: boolean;
  events: boolean;
  email: boolean;
};

export default function NotificationManager() {
  const { isAuthenticated } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [expanded, setExpanded] = useState(false);
  const preferencesQuery = trpc.notifications.mine.useQuery(undefined, { enabled: isAuthenticated });
  const updatePreferences = trpc.notifications.update.useMutation({
    onSuccess: () => preferencesQuery.refetch(),
    onError: () => toast.error('Unable to save notification preference'),
  });
  const preferences = preferencesQuery.data as NotificationPreferences | undefined;

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  useEffect(() => {
    if (permission === 'granted' && isAuthenticated && preferences?.browserNotifications === false) {
      updatePreferences.mutate({ browserNotifications: true });
    }
  }, [permission, isAuthenticated, preferences?.browserNotifications]);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('This browser does not support desktop notifications');
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      toast.success('Browser notifications enabled');
      if (isAuthenticated) updatePreferences.mutate({ browserNotifications: true });
    } else if (result === 'denied') {
      toast.error('Notifications are blocked in this browser.');
      if (isAuthenticated) updatePreferences.mutate({ browserNotifications: false });
    }
  };

  const togglePreference = (key: 'prayerRoom' | 'sermons' | 'events' | 'email') => {
    const current = preferences?.[key] ?? false;
    updatePreferences.mutate({ [key]: !current });
  };

  if (typeof window === 'undefined' || !('Notification' in window)) return null;

  return (
    <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-30">
      {expanded && (
        <Card className="mb-3 w-[min(20rem,calc(100vw-2rem))] p-4 bg-background/95 backdrop-blur-md shadow-xl border-border">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div><h2 className="font-semibold">Notification preferences</h2><p className="text-xs text-muted-foreground mt-1">Choose what you want to hear about. Changes are saved to your account.</p></div>
            <Settings2 className="w-4 h-4 text-ember shrink-0" aria-hidden="true" />
          </div>
          {!isAuthenticated ? <p className="text-sm text-muted-foreground">Sign in to save preferences across devices.</p> : <div className="space-y-3 text-sm">
            {(['prayerRoom', 'sermons', 'events', 'email'] as const).map(key => <label key={key} className="flex items-center justify-between gap-3"><span className="capitalize">{key === 'prayerRoom' ? 'Prayer Room gatherings' : key}</span><input type="checkbox" checked={Boolean(preferences?.[key])} onChange={() => togglePreference(key)} className="accent-ember" /></label>)}
            <p className="text-xs text-muted-foreground border-t border-border pt-3">Email delivery becomes active after the church configures a verified mail provider.</p>
          </div>}
        </Card>
      )}
      <div className="flex items-center gap-2">
        {permission !== 'granted' && <Button onClick={requestPermission} variant="outline" size="sm" className="bg-void/80 backdrop-blur-md border-ember/50 hover:bg-ember/20 text-foreground gap-2 rounded-full shadow-lg text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2"><Bell className="w-3 h-3 sm:w-4 sm:h-4 text-ember" /><span className="hidden sm:inline">Enable alerts</span><span className="sm:hidden">Alerts</span></Button>}
        <Button onClick={() => setExpanded(value => !value)} variant="outline" size="icon" aria-label="Open notification preferences" className="rounded-full bg-void/80 backdrop-blur-md border-border shadow-lg">{permission === 'granted' ? <Bell className="w-4 h-4 text-signal" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}</Button>
      </div>
    </div>
  );
}
