import { useCallback, useEffect, useRef, useState } from "react";
import { useNetwork, getAdaptiveStreamSettings } from "./useNetwork";
import { ICE_SERVERS } from "@/lib/iceServers";

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
 * CRITICAL DESIGN PRINCIPLES:
 * 1. NEVER reload the page on connection issues — all reconnection happens silently in the background
 * 2. The WebSocket effect must NOT depend on any state that changes during a stream (e.g. meta.isLive)
 *    to avoid tearing down and recreating the socket mid-stream
 * 3. Support both viewer-initiated and broadcaster-initiated WebRTC handshakes for maximum compatibility
 * 4. Buffer ICE candidates properly and flush them when the peer connection is ready
 * 5. Use ICE restarts instead of full connection teardown when ICE fails
 */
export function useViewer(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const network = useNetwork();
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const wsReconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 999; // Effectively unlimited — keep trying
  const isConnectingRef = useRef(false);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceCandidateBufferRef = useRef<any[]>([]);
  const hasReceivedAnswerRef = useRef(false);
  const metaRef = useRef<StreamMeta | null>(null); // Keep latest meta in a ref for use inside stable callbacks

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

  // Keep metaRef in sync so stable callbacks can read the latest meta
  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

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
    isConnectingRef.current = false;
  }, []);

  const createPeerConnection = useCallback(() => {
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
      console.log(`[useViewer] Peer connection state: ${state}`);

      if (state === "connected") {
        setConnectionState("connected");
        reconnectAttemptRef.current = 0;
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
      } else if (state === "failed") {
        // ICE failed — try ICE restart before giving up
        console.log('[useViewer] Connection failed, attempting ICE restart');
        setConnectionState("reconnecting");
        try {
          pc.restartIce();
        } catch (e) {
          console.error('[useViewer] ICE restart failed:', e);
          // Fall through to scheduleReconnect
          scheduleReconnect();
        }
        // If ICE restart doesn't recover within 5s, do a full reconnect
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = setTimeout(() => {
          if (pcRef.current && pcRef.current.connectionState !== 'connected') {
            console.log('[useViewer] ICE restart did not recover, full reconnect');
            cleanupPeerConnection();
            scheduleReconnect();
          }
        }, 5000);
      } else if (state === "closed") {
        setConnectionState("disconnected");
        setRemoteStream(null);
      } else if (state === "disconnected") {
        // Brief connectivity loss — don't tear down, just mark as reconnecting
        setConnectionState("reconnecting");
        // Try ICE restart first
        try {
          pc.restartIce();
        } catch (e) {
          console.error('[useViewer] ICE restart on disconnect failed:', e);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`[useViewer] ICE connection state: ${state}`);
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
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    if (reconnectAttemptRef.current >= maxReconnectAttempts) {
      console.log('[useViewer] Max reconnection attempts reached');
      setConnectionState("disconnected");
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, Math.min(reconnectAttemptRef.current, 4)), 15000);
    reconnectAttemptRef.current++;

    console.log(`[useViewer] Scheduling WebRTC reconnect in ${delay}ms (attempt ${reconnectAttemptRef.current})`);

    reconnectTimerRef.current = setTimeout(() => {
      // Only reconnect if the WebSocket is still alive
      if (wsRef.current?.readyState === WebSocket.OPEN && !isConnectingRef.current) {
        console.log('[useViewer] Reconnecting via WebSocket re-subscription');
        cleanupPeerConnection();
        // Send viewer-join to re-establish the WebRTC connection
        wsRef.current.send(JSON.stringify({ type: "viewer-join" }));
        setConnectionState("reconnecting");
      }
    }, delay);
  }, [cleanupPeerConnection]);

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
        setConnectionState("connected");
        reconnectAttemptRef.current = 0;
      }
    };
  }, []);

  // Create a viewer-initiated offer (proactive — doesn't wait for broadcaster)
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
          console.log("[useViewer] Viewer-initiated offer stalled, retrying...");
          // Retry by sending viewer-join again
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            cleanupPeerConnection();
            const newPc = createPeerConnection();
            setupTrackHandler(newPc);
            createViewerOffer(newPc);
          }
        }
      }, 4000);
    } catch (error) {
      console.error("[useViewer] Failed to create viewer offer:", error);
      isConnectingRef.current = false;
    }
  }, [createPeerConnection, cleanupPeerConnection, setupTrackHandler]);

  // Stable message handler — does NOT depend on meta or any changing state
  // All state reads use refs, all state writes use functional updates
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
            const wasLive = metaRef.current?.isLive;
            const isNowLive = msg.session.isLive;

            if (!wasLive && isNowLive) {
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try {
                  new Notification("N.I.C.A. Kibugu is LIVE!", {
                    body: `Join us now for: ${msg.session.title}`,
                    icon: '/logo/logo.png'
                  });
                } catch (e) { /* ignore */ }
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

            // If the stream just went live and we don't have a peer connection,
            // proactively start the WebRTC handshake
            if (isNowLive && !pcRef.current && !isConnectingRef.current) {
              console.log('[useViewer] Stream is live, proactively starting WebRTC handshake');
              isConnectingRef.current = true;
              const pc = createPeerConnection();
              setupTrackHandler(pc);
              createViewerOffer(pc);
            }
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
          if (isConnectingRef.current) {
            console.log('[useViewer] Already connecting, skipping viewer-joined');
            return;
          }
          isConnectingRef.current = true;

          cleanupPeerConnection();
          const pc = createPeerConnection();
          setupTrackHandler(pc);

          // Create our own offer proactively (viewer-initiated mode)
          // This ensures we connect even if the broadcaster's offer is missed
          await createViewerOffer(pc);
          break;
        }

        case "webrtc-offer": {
          // BROADCASTER-INITIATED: Broadcaster sent us an offer to answer
          isConnectingRef.current = true;

          // If we already have a connection in progress, don't create a new one
          // (this can happen with dual-mode — both sides try simultaneously)
          if (pcRef.current && (pcRef.current.connectionState === 'connected' || pcRef.current.connectionState === 'connecting')) {
            console.log('[useViewer] Already have active connection, ignoring broadcaster offer');
            break;
          }

          cleanupPeerConnection();
          const pc = createPeerConnection();
          setupTrackHandler(pc);

          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
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

              // Flush buffered ICE candidates
              for (const candidate of iceCandidateBufferRef.current) {
                try {
                  await currentPc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                  console.error('[useViewer] Failed to flush buffered ICE candidate:', e);
                }
              }
              iceCandidateBufferRef.current = [];
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
              // Only add if remote description is set
              if (pcRef.current.remoteDescription) {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
              } else {
                // Buffer until remote description is set
                iceCandidateBufferRef.current.push(msg.candidate);
              }
            } catch (error) {
              console.error("[useViewer] Failed to add ICE candidate:", error);
              // Buffer for retry
              iceCandidateBufferRef.current.push(msg.candidate);
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
    [createPeerConnection, cleanupPeerConnection, setupTrackHandler, createViewerOffer]
  );

  // WebSocket connection effect — STABLE: does NOT depend on any changing state
  // This is the critical fix: the previous version had `handleMessage` depending on `meta.isLive`,
  // which caused the WebSocket to be torn down and recreated every time the stream status changed,
  // triggering `window.location.reload()` in the onclose handler.
  useEffect(() => {
    if (!enabled) {
      cleanupPeerConnection();
      setConnectionState("disconnected");
      return;
    }
    let ws: WebSocket | null = null;
    let isClosed = false;

    const connect = () => {
      if (isClosed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${window.location.host}/api/stream-sync`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[useViewer] Connected to signaling server");
        wsReconnectAttemptRef.current = 0;
        ws!.send(JSON.stringify({ type: "subscribe", role: "viewer" }));
        setConnectionState(prev => prev === "connected" ? "connected" : "connecting");
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        if (isClosed) return; // Component unmounted, don't reconnect
        console.log("[useViewer] Disconnected from signaling server, will reconnect in background");
        setConnectionState("reconnecting");
        // DO NOT set remoteStream to null — keep the last frame visible
        // DO NOT call window.location.reload() — reconnect silently in the background
        cleanupPeerConnection();

        // Auto-reconnect WebSocket with backoff — SILENTLY IN THE BACKGROUND
        const delay = Math.min(1000 * Math.pow(1.5, Math.min(wsReconnectAttemptRef.current, 8)), 10000);
        wsReconnectAttemptRef.current++;

        console.log(`[useViewer] WebSocket will reconnect in ${delay}ms (attempt ${wsReconnectAttemptRef.current})`);

        wsReconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error("[useViewer] WebSocket error:", error);
        // Don't change connectionState here — onclose will handle reconnection
      };
    };

    connect();

    return () => {
      isClosed = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsReconnectTimerRef.current) {
        clearTimeout(wsReconnectTimerRef.current);
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      if (ws) {
        ws.close();
      }
      cleanupPeerConnection();
    };
  }, [enabled, handleMessage, cleanupPeerConnection]);

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
    if (!enabled) return;
    reconnectAttemptRef.current = 0;
    wsReconnectAttemptRef.current = 0;
    cleanupPeerConnection();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "viewer-join" }));
    } else {
      // Force reconnect the WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/stream-sync`);
      wsRef.current = ws;
      ws.onopen = () => {
        wsReconnectAttemptRef.current = 0;
        ws.send(JSON.stringify({ type: "subscribe", role: "viewer" }));
      };
      ws.onmessage = handleMessage;
      ws.onclose = () => {
        setConnectionState("disconnected");
      };
    }
  }, [enabled, cleanupPeerConnection, handleMessage]);

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
