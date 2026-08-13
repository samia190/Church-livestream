import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function NotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        },
        (err) => {
          console.log('ServiceWorker registration failed: ', err);
        }
      );
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('This browser does not support desktop notification');
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    
    if (result === 'granted') {
      toast.success('Notifications enabled!');
      // In a real app, you would send the subscription to the server here
    } else if (result === 'denied') {
      toast.error('Notifications blocked. Please enable them in your browser settings.');
    }
  };

  if (!('Notification' in window)) return null;

  return (
    <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-30">
      {permission !== 'granted' ? (
        <Button
          onClick={requestPermission}
          variant="outline"
          size="sm"
          className="bg-void/80 backdrop-blur-md border-ember/50 hover:bg-ember/20 text-foreground gap-2 rounded-full shadow-lg animate-bounce text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2"
        >
          <Bell className="w-3 h-3 sm:w-4 sm:h-4 text-ember" />
          <span className="hidden sm:inline">Get Live Updates</span>
          <span className="sm:hidden">Alerts</span>
        </Button>
      ) : (
        <div className="bg-void/80 backdrop-blur-md border border-signal/30 p-1.5 sm:p-2 rounded-full shadow-lg">
          <Bell className="w-3 h-3 sm:w-4 sm:h-4 text-signal" />
        </div>
      )}
    </div>
  );
}
