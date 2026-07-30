import { useState, useEffect, useCallback, useRef } from 'react';

export type NetworkQuality = 'excellent' | 'good' | 'moderate' | 'poor' | 'offline';

interface NetworkState {
  quality: NetworkQuality;
  downlink: number;
  rtt: number;
  effectiveType: string;
  saveData: boolean;
  online: boolean;
}

const DEFAULT_STATE: NetworkState = {
  quality: 'good',
  downlink: 10,
  rtt: 100,
  effectiveType: '4g',
  saveData: false,
  online: true,
};

export function useNetwork(): NetworkState {
  const [state, setState] = useState<NetworkState>(DEFAULT_STATE);
  const connRef = useRef<any>(null);

  useEffect(() => {
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    connRef.current = conn;

    const updateNetworkState = () => {
      const isOnline = navigator.onLine;
      
      if (!isOnline) {
        setState({
          quality: 'offline',
          downlink: 0,
          rtt: Infinity,
          effectiveType: 'offline',
          saveData: false,
          online: false,
        });
        return;
      }

      if (conn) {
        const downlink = conn.downlink || 10;
        const rtt = conn.rtt || 100;
        const effectiveType = conn.effectiveType || '4g';
        const saveData = conn.saveData || false;

        let quality: NetworkQuality = 'good';
        if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 0.5) {
          quality = 'poor';
        } else if (effectiveType === '3g' || downlink < 2) {
          quality = 'moderate';
        } else if (downlink < 5) {
          quality = 'good';
        } else {
          quality = 'excellent';
        }

        if (saveData) {
          quality = quality === 'poor' ? 'poor' : 'moderate';
        }

        setState({
          quality,
          downlink,
          rtt,
          effectiveType,
          saveData,
          online: true,
        });
      } else {
        setState(prev => ({ ...prev, online: isOnline }));
      }
    };

    updateNetworkState();

    // Listen for network changes
    window.addEventListener('online', updateNetworkState);
    window.addEventListener('offline', updateNetworkState);

    if (conn) {
      conn.addEventListener('change', updateNetworkState);
    }

    // Poll for network quality every 10 seconds
    const interval = setInterval(updateNetworkState, 10000);

    return () => {
      window.removeEventListener('online', updateNetworkState);
      window.removeEventListener('offline', updateNetworkState);
      if (conn) {
        conn.removeEventListener('change', updateNetworkState);
      }
      clearInterval(interval);
    };
  }, []);

  return state;
}

/**
 * Returns adaptive stream settings based on network quality
 */
export function getAdaptiveStreamSettings(quality: NetworkQuality): {
  maxVideoBitrate: number;
  maxAudioBitrate: number;
  preferredResolution: string;
  enableVideo: boolean;
  enableAudio: boolean;
  bufferingStrategy: 'aggressive' | 'moderate' | 'minimal';
} {
  switch (quality) {
    case 'poor':
      return {
        maxVideoBitrate: 150_000,
        maxAudioBitrate: 32_000,
        preferredResolution: '360p',
        enableVideo: true,
        enableAudio: true,
        bufferingStrategy: 'aggressive',
      };
    case 'moderate':
      return {
        maxVideoBitrate: 500_000,
        maxAudioBitrate: 64_000,
        preferredResolution: '480p',
        enableVideo: true,
        enableAudio: true,
        bufferingStrategy: 'moderate',
      };
    case 'good':
      return {
        maxVideoBitrate: 1_200_000,
        maxAudioBitrate: 128_000,
        preferredResolution: '720p',
        enableVideo: true,
        enableAudio: true,
        bufferingStrategy: 'moderate',
      };
    case 'excellent':
      return {
        maxVideoBitrate: 2_500_000,
        maxAudioBitrate: 192_000,
        preferredResolution: '1080p',
        enableVideo: true,
        enableAudio: true,
        bufferingStrategy: 'minimal',
      };
    case 'offline':
    default:
      return {
        maxVideoBitrate: 0,
        maxAudioBitrate: 0,
        preferredResolution: '0',
        enableVideo: false,
        enableAudio: false,
        bufferingStrategy: 'minimal',
      };
  }
}
