import { useCallback, useEffect, useRef, useState } from "react";
import { useNetwork, getAdaptiveStreamSettings } from "./useNetwork";

// Professional WebRTC Infrastructure
// Note: For a production environment, you should use a paid TURN service (like Metered.ca, Twilio, or Xirsys)
// to ensure 100% connectivity on restrictive mobile networks.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun.services.mozilla.com" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export type BroadcastMode = "offline" | "pre-stream" | "live";

interface StreamMeta {
  sessionId: string | null;
  isLive: boolean;
  broadcastMode: BroadcastMode;
  title: string;
  description: string;
  viewers: number;
  startTime: number;
}

interface ChatMessage {
  id: string;
  user: string;
  message: string;
  timestamp: Date;
  role?: string;
}

type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";

/**
 * useViewer - Mobile-optimized WebRTC viewer hook
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Network-aware adaptive bitrate
 * - Mobile-friendly ICE trickle
 * - Connection state management for UI feedback
 * - Graceful degradation on poor networks
 */
export function useViewer() {
  const network = useNetwork();
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 8;
  const isConnectingRef = useRef(false);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [meta, setMeta] = useState<StreamMeta>({
    sessionId: null,
    isLive: false,
    broadcastMode: "offline",
    title: "",
    description: "",
    viewers: 0,
    startTime: 0,
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [networkInfo, setNetworkInfo] = useState({
    quality: network.quality,
    adaptiveSettings: getAdaptiveStreamSettings(network.quality),
  });

  // Update network info when network quality changes
  useEffect(() => {
    const settings = getAdaptiveStreamSettings(network.quality);
    setNetworkInfo({
      quality: network.quality,
      adaptiveSettings: settings,
    });

    // If network quality degraded significantly, try to renegotiate
    if (network.quality === 'poor' || network.quality === 'offline') {
      console.log('[useViewer] Network degraded, connection may need renegotiation');
    }
  }, [network.quality]);

  const cleanupPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    const settings = getAdaptiveStreamSettings(network.quality);
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      // Pre-gather candidates to save 1-2 seconds during handshake
      iceCandidatePoolSize: 10,
    });

    pcRef.current = pc;

    // Mobile-optimized: prefer mobile relay candidates
    pc.onicecandidate = event => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "webrtc-ice-candidate",
            candidate: event.candidate,
          })
        );
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[useViewer] Connection state: ${state}`);
      
      if (state === "connected") {
        setConnectionState("connected");
        reconnectAttemptRef.current = 0;
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
      } else if (["failed", "closed"].includes(state)) {
        setConnectionState("disconnected");
        setRemoteStream(null);
        scheduleReconnect();
      } else if (state === "disconnected") {
        setConnectionState("reconnecting");
        scheduleReconnect();
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "failed") {
        console.log('[useViewer] ICE connection failed, attempting recovery');
        // Try to restart ICE
        try {
          pc.restartIce();
        } catch (e) {
          console.error('[useViewer] ICE restart failed:', e);
        }
      }
    };

    return pc;
  }, [network.quality]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    if (reconnectAttemptRef.current >= maxReconnectAttempts) {
      console.log('[useViewer] Max reconnection attempts reached');
      setConnectionState("disconnected");
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 15000);
    reconnectAttemptRef.current++;

    console.log(`[useViewer] Scheduling reconnect in ${delay}ms (attempt ${reconnectAttemptRef.current})`);

    reconnectTimerRef.current = setTimeout(async () => {
      if (wsRef.current?.readyState === WebSocket.OPEN && !isConnectingRef.current) {
        isConnectingRef.current = true;
        setConnectionState("reconnecting");
        
        // Create new peer connection
        cleanupPeerConnection();
        const pc = createPeerConnection();
        
        pc.ontrack = (event) => {
          console.log('[useViewer] Received remote track on reconnect:', event.track.kind);
          const stream = event.streams[0];
          if (stream) {
            setRemoteStream(stream);
            // Mobile: ensure audio is enabled
            stream.getAudioTracks().forEach(t => { t.enabled = true; });
            stream.getVideoTracks().forEach(t => { t.enabled = true; });
          }
        };

        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          wsRef.current?.send(
            JSON.stringify({ type: "webrtc-offer", sdp: offer })
          );
        } catch (error) {
          console.error('[useViewer] Reconnect offer failed:', error);
          isConnectingRef.current = false;
        }
      }
    }, delay);
  }, [cleanupPeerConnection, createPeerConnection]);

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "welcome": {
          // Immediately signal that we are ready to join to minimize round-trip time
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "viewer-join" }));
          }
          break;
        }

        case "stream-update": {
          if (msg.session) {
            const wasLive = meta.isLive;
            const isNowLive = msg.session.isLive;

            if (!wasLive && isNowLive) {
              if (Notification.permission === 'granted') {
                new Notification("N.I.C.A. Kibugu is LIVE!", {
                  body: `Join us now for: ${msg.session.title}`,
                  icon: '/logo/logo.png'
                });
              }
            }

            setMeta({
              sessionId: msg.session.sessionId,
              isLive: msg.session.isLive,
              broadcastMode: msg.session.broadcastMode || "offline",
              title: msg.session.title,
              description: msg.session.description,
              viewers: msg.session.viewers,
              startTime: msg.session.startTime,
            });
          }
          break;
        }

        case "broadcast-mode-changed": {
          if (msg.session) {
            setMeta({
              sessionId: msg.session.sessionId,
              isLive: msg.session.isLive,
              broadcastMode: msg.session.broadcastMode || "offline",
              title: msg.session.title,
              description: msg.session.description,
              viewers: msg.session.viewers,
              startTime: msg.session.startTime,
            });
          }
          break;
        }

        case "viewer-joined": {
          isConnectingRef.current = true;
          const pc = createPeerConnection();

          pc.ontrack = event => {
            console.log("[useViewer] Received remote track:", event.track.kind);
            const stream = event.streams[0];
            if (stream) {
              // Mobile optimization: ensure tracks are enabled
              stream.getAudioTracks().forEach(t => { t.enabled = true; });
              stream.getVideoTracks().forEach(t => { t.enabled = true; });
              setRemoteStream(stream);
            }
            
            // Log adaptive settings for reference (bitrate control is handled via signaling)
            const settings = getAdaptiveStreamSettings(network.quality);
            console.log(`[useViewer] Network quality: ${network.quality}, max bitrate: ${settings.maxVideoBitrate}`);
          };

          try {
            const offer = await pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(offer);
            wsRef.current?.send(
              JSON.stringify({ type: "webrtc-offer", sdp: offer })
            );
            setConnectionState("connecting");

            // Professional: Set a timeout to detect stalled connections (e.g. 10s)
            if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = setTimeout(() => {
              if (pc.connectionState !== 'connected') {
                console.log("[useViewer] Connection stalled, attempting recovery...");
                scheduleReconnect();
              }
            }, 10000);
          } catch (error) {
            console.error("[useViewer] Failed to create offer:", error);
            isConnectingRef.current = false;
          }
          break;
        }

        case "webrtc-offer": {
          isConnectingRef.current = true;
          if (!pcRef.current) {
            const pc = createPeerConnection();
            pc.ontrack = event => {
              console.log("[useViewer] Received remote track:", event.track.kind);
              const stream = event.streams[0];
              if (stream) {
                stream.getAudioTracks().forEach(t => { t.enabled = true; });
                stream.getVideoTracks().forEach(t => { t.enabled = true; });
                setRemoteStream(stream);
              }
            };
          }

          const offerPc = pcRef.current;
          if (offerPc) {
            try {
              await offerPc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
              const answer = await offerPc.createAnswer();
              await offerPc.setLocalDescription(answer);
              wsRef.current?.send(
                JSON.stringify({ type: "webrtc-answer", sdp: answer })
              );
              setConnectionState("connecting");
            } catch (error) {
              console.error("[useViewer] Failed to handle offer:", error);
              isConnectingRef.current = false;
            }
          }
          break;
        }

        case "webrtc-answer": {
          const currentPc = pcRef.current;
          if (currentPc) {
            try {
              await currentPc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
              isConnectingRef.current = false;
            } catch (error) {
              console.error("[useViewer] Failed to set remote description:", error);
              isConnectingRef.current = false;
            }
          }
          break;
        }

        case "webrtc-ice-candidate": {
          if (pcRef.current && msg.candidate) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (error) {
              console.error("[useViewer] Failed to add ICE candidate:", error);
            }
          }
          break;
        }

        case "broadcast-ended": {
          cleanupPeerConnection();
          setRemoteStream(null);
          setConnectionState("disconnected");
          reconnectAttemptRef.current = 0;
          isConnectingRef.current = false;
          setMeta(prev => ({
            ...prev,
            isLive: false,
            broadcastMode: "offline",
          }));
          break;
        }

        case "viewer-count-update": {
          setMeta(prev => ({
            ...prev,
            viewers: msg.viewers,
          }));
          break;
        }

        case "chat-message": {
          setChatMessages(prev => [...prev, {
            id: msg.id,
            user: msg.user,
            message: msg.message,
            timestamp: new Date(msg.timestamp),
            role: msg.role,
          }]);
          break;
        }

        case "chat-message-deleted": {
          setChatMessages(prev => prev.filter(m => m.id !== msg.messageId));
          break;
        }

        default:
          break;
      }
    },
    [meta.isLive, createPeerConnection, cleanupPeerConnection]
  );

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/stream-sync`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[useViewer] Connected to signaling server");
      reconnectAttemptRef.current = 0;
      ws.send(JSON.stringify({ type: "subscribe", role: "viewer" }));
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      console.log("[useViewer] Disconnected from signaling server");
      setConnectionState("disconnected");
      setRemoteStream(null);
      cleanupPeerConnection();
      
      // Auto-reconnect WebSocket with backoff
      if (reconnectAttemptRef.current < maxReconnectAttempts) {
        const delay = Math.min(2000 * Math.pow(1.5, reconnectAttemptRef.current), 20000);
        reconnectAttemptRef.current++;
        
        console.log(`[useViewer] WebSocket will reconnect in ${delay}ms`);
        
        reconnectTimerRef.current = setTimeout(() => {
          // Force a page re-navigation to re-init the hook
          if (reconnectAttemptRef.current >= maxReconnectAttempts) {
            console.log('[useViewer] Max WebSocket reconnect attempts reached');
            return;
          }
          // Signal that we need to reconnect
          window.dispatchEvent(new CustomEvent('stream-reconnect'));
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error("[useViewer] WebSocket error:", error);
      setConnectionState("disconnected");
    };

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      ws.close();
      cleanupPeerConnection();
    };
  }, [handleMessage, cleanupPeerConnection]);

  const sendChatMessage = useCallback((message: string, user: string = "Viewer") => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "chat-message",
        message,
        user,
      }));
    }
  }, []);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    cleanupPeerConnection();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "viewer-join" }));
    }
  }, [cleanupPeerConnection]);

  return {
    remoteStream,
    meta,
    chatMessages,
    connectionState,
    sendChatMessage,
    networkInfo,
    reconnect,
  };
}
