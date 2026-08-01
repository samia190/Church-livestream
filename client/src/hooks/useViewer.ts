import { useCallback, useEffect, useRef, useState } from "react";
import { useNetwork, getAdaptiveStreamSettings } from "./useNetwork";

// Professional WebRTC Infrastructure
// STUN servers for NAT traversal + multiple redundant sources
// For production, add a TURN server for guaranteed mobile connectivity
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.services.mozilla.com" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
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
 * 
 * SUPPORTS TWO HANDSHAKE MODES:
 * 1. Broadcaster-initiated: Server tells broadcaster to create offer for viewer
 * 2. Viewer-initiated: Viewer creates offer and sends to broadcaster
 * 
 * This dual-mode approach ensures mobile devices (which may miss the fast-start
 * broadcast from the server) can always establish a connection.
 */
export function useViewer() {
  const network = useNetwork();
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 10;
  const isConnectingRef = useRef(false);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceCandidateBufferRef = useRef<any[]>([]);
  const hasReceivedAnswerRef = useRef(false);

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
    iceCandidateBufferRef.current = [];
    hasReceivedAnswerRef.current = false;
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

    // Mobile-optimized: send ICE candidates immediately as they're gathered
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
        console.log('[useViewer] Reconnecting via WebSocket re-subscription');
        // Send viewer-join to re-establish the WebRTC connection
        wsRef.current.send(JSON.stringify({ type: "viewer-join" }));
      }
    }, delay);
  }, []);

  // Set up ontrack handler for a peer connection
  const setupTrackHandler = useCallback((pc: RTCPeerConnection) => {
    pc.ontrack = event => {
      console.log("[useViewer] Received remote track:", event.track.kind);
      const stream = event.streams[0];
      if (stream) {
        // Mobile optimization: ensure tracks are enabled
        stream.getAudioTracks().forEach(t => { t.enabled = true; });
        stream.getVideoTracks().forEach(t => { t.enabled = true; });
        setRemoteStream(stream);
      }
    };
  }, []);

  // Create a viewer-initiated offer
  const createViewerOffer = useCallback(async (pc: RTCPeerConnection) => {
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      
      // Send the offer to the server (which routes it to broadcaster)
      wsRef.current?.send(
        JSON.stringify({ type: "webrtc-offer", sdp: offer })
      );
      setConnectionState("connecting");
      
      // Flush any buffered ICE candidates
      for (const candidate of iceCandidateBufferRef.current) {
        wsRef.current?.send(
          JSON.stringify({ type: "webrtc-ice-candidate", candidate })
        );
      }
      iceCandidateBufferRef.current = [];
      
      // Set a timeout to detect stalled connections
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = setTimeout(() => {
        if (pcRef.current && pcRef.current.connectionState !== 'connected' && !hasReceivedAnswerRef.current) {
          console.log("[useViewer] Viewer-initiated offer stalled, waiting for broadcaster answer...");
        }
      }, 15000);
    } catch (error) {
      console.error("[useViewer] Failed to create viewer offer:", error);
      isConnectingRef.current = false;
    }
  }, []);

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
          // This is sent by the server when the broadcaster is notified about a new viewer.
          // If the broadcaster creates an offer for us, we'll receive it as a "webrtc-offer" message.
          // But to be safe, ALSO create our own offer (dual-mode for maximum compatibility).
          isConnectingRef.current = true;
          
          cleanupPeerConnection();
          const pc = createPeerConnection();
          setupTrackHandler(pc);

          // Create our own offer proactively (viewer-initiated mode)
          // This ensures we connect even if the broadcaster's offer is missed
          await createViewerOffer(pc);
          
          // Also set a timer: if we don't get an answer within 8 seconds,
          // we know our viewer-initiated offer path is working (or we need to retry)
          if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = setTimeout(() => {
            if (pcRef.current && pcRef.current.connectionState !== 'connected') {
              console.log("[useViewer] No answer received after 8s, will retry on reconnect cycle");
            }
          }, 8000);
          break;
        }

        case "webrtc-offer": {
          // BROADCASTER-INITIATED: Broadcaster sent us an offer to answer
          isConnectingRef.current = true;
          
          // Use existing peer connection if available, otherwise create new
          if (!pcRef.current) {
            const pc = createPeerConnection();
            setupTrackHandler(pc);
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
              console.log("[useViewer] Sent answer to broadcaster's offer");
              
              // Flush buffered ICE candidates
              for (const candidate of iceCandidateBufferRef.current) {
                wsRef.current?.send(
                  JSON.stringify({ type: "webrtc-ice-candidate", candidate })
                );
              }
              iceCandidateBufferRef.current = [];
            } catch (error) {
              console.error("[useViewer] Failed to handle broadcaster offer:", error);
              isConnectingRef.current = false;
            }
          }
          break;
        }

        case "webrtc-answer": {
          // VIEWER-INITIATED FLOW: We sent an offer, broadcaster answered
          const currentPc = pcRef.current;
          if (currentPc) {
            try {
              await currentPc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
              isConnectingRef.current = false;
              hasReceivedAnswerRef.current = true;
              console.log("[useViewer] Applied broadcaster's answer");
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
          } else if (msg.candidate) {
            // Buffer ICE candidates until peer connection is ready
            iceCandidateBufferRef.current.push(msg.candidate);
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
    [meta.isLive, createPeerConnection, cleanupPeerConnection, setupTrackHandler, createViewerOffer]
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
          if (reconnectAttemptRef.current >= maxReconnectAttempts) {
            console.log('[useViewer] Max WebSocket reconnect attempts reached');
            return;
          }
          // Force re-navigation to re-init the hook
          window.location.reload();
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
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
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
