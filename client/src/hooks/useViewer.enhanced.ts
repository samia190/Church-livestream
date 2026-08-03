import { useCallback, useEffect, useRef, useState } from "react";

// Professional WebRTC Infrastructure — same as useViewer.ts
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.services.mozilla.com" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
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
 * useViewer (enhanced) — same robust implementation as useViewer.ts
 * with pre-stream support and silent background reconnection.
 *
 * CRITICAL: Never reloads the page. All reconnection is silent.
 */
export function useViewer() {
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const wsReconnectAttemptRef = useRef(0);
  const isConnectingRef = useRef(false);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceCandidateBufferRef = useRef<any[]>([]);
  const hasReceivedAnswerRef = useRef(false);
  const metaRef = useRef<StreamMeta | null>(null);

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

  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

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
      iceCandidatePoolSize: 10,
    });
    pcRef.current = pc;

    pc.onicecandidate = event => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "webrtc-ice-candidate", candidate: event.candidate }));
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[useViewer] Peer connection state: ${state}`);
      if (state === "connected") {
        setConnectionState("connected");
        reconnectAttemptRef.current = 0;
        if (connectionTimeoutRef.current) { clearTimeout(connectionTimeoutRef.current); connectionTimeoutRef.current = null; }
      } else if (state === "failed") {
        setConnectionState("reconnecting");
        try { pc.restartIce(); } catch (e) { console.error('[useViewer] ICE restart failed:', e); }
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = setTimeout(() => {
          if (pcRef.current && pcRef.current.connectionState !== 'connected') {
            cleanupPeerConnection();
            scheduleReconnect();
          }
        }, 5000);
      } else if (state === "closed") {
        setConnectionState("disconnected");
        setRemoteStream(null);
      } else if (state === "disconnected") {
        setConnectionState("reconnecting");
        try { pc.restartIce(); } catch (e) { console.error('[useViewer] ICE restart on disconnect failed:', e); }
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        try { pc.restartIce(); } catch (e) { console.error('[useViewer] ICE restart failed:', e); }
      }
    };

    return pc;
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    const delay = Math.min(1000 * Math.pow(2, Math.min(reconnectAttemptRef.current, 4)), 15000);
    reconnectAttemptRef.current++;
    reconnectTimerRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN && !isConnectingRef.current) {
        cleanupPeerConnection();
        wsRef.current.send(JSON.stringify({ type: "viewer-join" }));
        setConnectionState("reconnecting");
      }
    }, delay);
  }, [cleanupPeerConnection]);

  const setupTrackHandler = useCallback((pc: RTCPeerConnection) => {
    pc.ontrack = event => {
      console.log("[useViewer] Received remote track:", event.track.kind);
      const stream = event.streams[0];
      if (stream) {
        stream.getAudioTracks().forEach(t => { t.enabled = true; });
        stream.getVideoTracks().forEach(t => { t.enabled = true; });
        
        // Force a new MediaStream object to ensure React detects the change when tracks are added
        setRemoteStream(new MediaStream(stream.getTracks()));
        
        setConnectionState("connected");
        reconnectAttemptRef.current = 0;
      }
    };
  }, []);

  const createViewerOffer = useCallback(async (pc: RTCPeerConnection) => {
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      wsRef.current?.send(JSON.stringify({ type: "webrtc-offer", sdp: offer }));
      setConnectionState("connecting");
      for (const candidate of iceCandidateBufferRef.current) {
        wsRef.current?.send(JSON.stringify({ type: "webrtc-ice-candidate", candidate }));
      }
      iceCandidateBufferRef.current = [];
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = setTimeout(() => {
        if (pcRef.current && pcRef.current.connectionState !== 'connected' && !hasReceivedAnswerRef.current) {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            cleanupPeerConnection();
            const newPc = createPeerConnection();
            setupTrackHandler(newPc);
            createViewerOffer(newPc);
          }
        }
      }, 10000);
    } catch (error) {
      console.error("[useViewer] Failed to create viewer offer:", error);
      isConnectingRef.current = false;
    }
  }, [createPeerConnection, cleanupPeerConnection, setupTrackHandler]);

  const handleMessage = useCallback(async (event: MessageEvent) => {
    let msg: any;
    try { msg = JSON.parse(event.data); } catch { return; }

    switch (msg.type) {
      case "welcome": {
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
              try { new Notification("N.I.C.A. Kibugu is LIVE!", { body: `Join us now for: ${msg.session.title}`, icon: '/logo/logo.png' }); } catch (e) {}
            }
          }
          setMeta({
            sessionId: msg.session.sessionId, isLive: msg.session.isLive,
            broadcastMode: msg.session.broadcastMode || "offline", title: msg.session.title,
            description: msg.session.description, viewers: msg.session.viewers, startTime: msg.session.startTime,
          });
          if (isNowLive && !pcRef.current && !isConnectingRef.current) {
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
            sessionId: msg.session.sessionId, isLive: msg.session.isLive,
            broadcastMode: msg.session.broadcastMode || "offline", title: msg.session.title,
            description: msg.session.description, viewers: msg.session.viewers, startTime: msg.session.startTime,
          });
        }
        break;
      }
      case "viewer-joined": {
        if (isConnectingRef.current) break;
        isConnectingRef.current = true;
        cleanupPeerConnection();
        const pc = createPeerConnection();
        setupTrackHandler(pc);
        await createViewerOffer(pc);
        break;
      }
      case "webrtc-offer": {
        isConnectingRef.current = true;
        if (pcRef.current && (pcRef.current.connectionState === 'connected' || pcRef.current.connectionState === 'connecting')) {
          if (pcRef.current.signalingState !== "stable") break;
          console.log('[useViewer] Handling broadcaster offer as renegotiation');
        } else {
          cleanupPeerConnection();
          const pc = createPeerConnection();
          setupTrackHandler(pc);
        }
        const pc = pcRef.current!;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          wsRef.current?.send(JSON.stringify({ type: "webrtc-answer", sdp: answer }));
          setConnectionState("connecting");
          for (const candidate of iceCandidateBufferRef.current) {
            wsRef.current?.send(JSON.stringify({ type: "webrtc-ice-candidate", candidate }));
          }
          iceCandidateBufferRef.current = [];
        } catch (error) {
          console.error("[useViewer] Failed to handle broadcaster offer:", error);
          isConnectingRef.current = false;
        }
        break;
      }
      case "webrtc-answer": {
        const currentPc = pcRef.current;
        if (currentPc) {
          try {
            if (currentPc.signalingState !== "have-local-offer") {
              console.log(`[useViewer] Ignoring answer: signalingState is ${currentPc.signalingState}`);
              break;
            }
            await currentPc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            isConnectingRef.current = false;
            hasReceivedAnswerRef.current = true;
            for (const candidate of iceCandidateBufferRef.current) {
              try { await currentPc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
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
            if (pcRef.current.remoteDescription) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } else {
              iceCandidateBufferRef.current.push(msg.candidate);
            }
          } catch (error) {
            iceCandidateBufferRef.current.push(msg.candidate);
          }
        } else if (msg.candidate) {
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
        setMeta(prev => ({ ...prev, isLive: false, broadcastMode: "offline" }));
        break;
      }
      case "viewer-count-update": {
        setMeta(prev => ({ ...prev, viewers: msg.viewers }));
        break;
      }
      case "chat-message": {
        setChatMessages(prev => [...prev, { id: msg.id, user: msg.user, message: msg.message, timestamp: new Date(msg.timestamp), role: msg.role }]);
        break;
      }
      case "chat-message-deleted": {
        setChatMessages(prev => prev.filter(m => m.id !== msg.messageId));
        break;
      }
      default: break;
    }
  }, [createPeerConnection, cleanupPeerConnection, setupTrackHandler, createViewerOffer]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let isClosed = false;

    const connect = () => {
      if (isClosed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${window.location.host}/api/stream-sync`);
      wsRef.current = ws;
      ws.onopen = () => {
        wsReconnectAttemptRef.current = 0;
        ws!.send(JSON.stringify({ type: "subscribe", role: "viewer" }));
        setConnectionState(prev => prev === "connected" ? "connected" : "connecting");
      };
      ws.onmessage = handleMessage;
      ws.onclose = () => {
        if (isClosed) return;
        setConnectionState("reconnecting");
        cleanupPeerConnection();
        const delay = Math.min(1000 * Math.pow(1.5, Math.min(wsReconnectAttemptRef.current, 8)), 10000);
        wsReconnectAttemptRef.current++;
        wsReconnectTimerRef.current = setTimeout(() => connect(), delay);
      };
      ws.onerror = () => {};
    };

    connect();

    return () => {
      isClosed = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsReconnectTimerRef.current) clearTimeout(wsReconnectTimerRef.current);
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      if (ws) ws.close();
      cleanupPeerConnection();
    };
  }, [handleMessage, cleanupPeerConnection]);

  const sendChatMessage = useCallback((message: string, user: string = "Viewer") => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat-message", message, user }));
    }
  }, []);

  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    wsReconnectAttemptRef.current = 0;
    cleanupPeerConnection();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "viewer-join" }));
    }
  }, [cleanupPeerConnection]);

  return { remoteStream, meta, chatMessages, connectionState, sendChatMessage, reconnect };
}
