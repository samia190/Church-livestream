import { useCallback, useEffect, useRef, useState } from "react";

// Professional WebRTC Infrastructure
// STUN servers for NAT discovery + redundant sources
// TURN servers ensure connectivity through carrier-grade NATs (CGNAT) on 3G/4G/5G
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.services.mozilla.com" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:openrelay.metered.ca:80" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

interface StartBroadcastArgs {
  sessionId: string;
  title: string;
  description?: string;
  /** The initial broadcast mode: "live" or "pre-stream" */
  initialMode?: "live" | "pre-stream";
  /** Optional: the original camera stream to save for restoration */
  originalCameraStream?: MediaStream;
}

export type BroadcastMode = "offline" | "pre-stream" | "live";

export function useBroadcaster() {
  const wsRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceCandidateBuffersRef = useRef<Map<string, any[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const originalCameraStreamRef = useRef<MediaStream | null>(null);
  const sessionInfoRef = useRef<{ sessionId: string; title: string; description: string; initialMode: string } | null>(null);
  const wsReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsReconnectAttemptRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [broadcastMode, setBroadcastMode] = useState<BroadcastMode>("offline");
  const [viewerCount, setViewerCount] = useState(0);
  const [streamStats, setStreamStats] = useState({
    bitrate: 0,
    fps: 0,
    resolution: "",
    packetsLost: 0
  });

  // Stats polling interval
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(async () => {
      const firstPeer = Array.from(peersRef.current.values())[0];
      if (!firstPeer) return;

      try {
        const stats = await firstPeer.getStats();
        let bitrate = 0;
        let fps = 0;
        let resolution = "";
        let packetsLost = 0;

        stats.forEach(report => {
          if (report.type === "outbound-rtp" && report.kind === "video") {
            bitrate = (report.bytesSent * 8) / 1000000;
            fps = report.framesPerSecond || 0;
            packetsLost = report.packetsLost || 0;
          }
          if (report.type === "track" && report.kind === "video") {
            resolution = `${report.frameWidth}x${report.frameHeight}`;
          }
        });

        setStreamStats({ bitrate, fps, resolution, packetsLost });
      } catch (err) {
        console.error("[useBroadcaster] Failed to get RTC stats", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isLive]);

  const createPeerForViewer = useCallback((viewerId: string) => {
    // If we already have a peer for this viewer, close it first
    const existingPc = peersRef.current.get(viewerId);
    if (existingPc) {
      try { existingPc.close(); } catch (e) {}
      peersRef.current.delete(viewerId);
    }

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      iceCandidatePoolSize: 10,
    });
    peersRef.current.set(viewerId, pc);

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => {
        const sender = pc.addTrack(track, stream);
        // Set adaptive bitrate degradation for mobile viewers
        if (track.kind === 'video' && sender) {
          try {
            sender.setParameters({
              ...sender.getParameters(),
              degradationPreference: 'maintain-framerate',
              encodings: [{
                // Start with a lower bitrate to ensure fast first frame on mobile data
                maxBitrate: 1500000,
                maxFramerate: 30,
                networkPriority: 'high',
              }],
            });
          } catch (e) {
            console.log('[useBroadcaster] setParameters not supported:', e);
          }
        }
      });
    }

    pc.onicecandidate = event => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "webrtc-ice-candidate",
            targetViewerId: viewerId,
            viewerId: viewerId,
            candidate: event.candidate,
          })
        );
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[useBroadcaster] Viewer ${viewerId} connection state: ${state}`);
      if (state === "failed") {
        // Try ICE restart before giving up
        try { pc.restartIce(); } catch (e) { console.log('[useBroadcaster] ICE restart failed:', e); }
        // If still failed after 5s, clean up
        setTimeout(() => {
          if (pc.connectionState === 'failed') {
            try { pc.close(); } catch (e) {}
            peersRef.current.delete(viewerId);
          }
        }, 5000);
      } else if (state === "closed") {
        peersRef.current.delete(viewerId);
      } else if (state === "disconnected") {
        // Brief connectivity loss — try ICE restart
        try { pc.restartIce(); } catch (e) {}
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        console.log(`[useBroadcaster] ICE failed for viewer ${viewerId}, attempting restart`);
        try { pc.restartIce(); } catch (e) { console.log('[useBroadcaster] ICE restart failed:', e); }
      }
    };

    return pc;
  }, []);

  const sendOfferToViewer = useCallback(
    async (viewerId: string) => {
      // If we already have a peer connection for this viewer that's connected or connecting, skip
      const existingPc = peersRef.current.get(viewerId);
      if (existingPc) {
        if (['connected', 'connecting'].includes(existingPc.connectionState)) {
          console.log(`[useBroadcaster] Viewer ${viewerId} already has active connection, skipping broadcaster offer`);
          return;
        }
        // Connection is in 'new' or 'failed' state — recreate
        try { existingPc.close(); } catch (e) {}
        peersRef.current.delete(viewerId);
      }

      const pc = createPeerForViewer(viewerId);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current?.send(
        JSON.stringify({ type: "webrtc-offer", targetViewerId: viewerId, sdp: offer })
      );
    },
    [createPeerForViewer]
  );

  // Handle a viewer-initiated offer (viewer creates offer, broadcaster answers)
  const handleViewerOffer = useCallback(
    async (viewerId: string, sdp: RTCSessionDescriptionInit) => {
      console.log(`[useBroadcaster] Received viewer-initiated offer from ${viewerId}`);

      // If we already have a connected peer, skip
      const existingPc = peersRef.current.get(viewerId);
      if (existingPc && existingPc.connectionState === 'connected') {
        console.log(`[useBroadcaster] Viewer ${viewerId} already connected, skipping offer`);
        return;
      }

      const pc = createPeerForViewer(viewerId);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsRef.current?.send(
          JSON.stringify({ type: "webrtc-answer", targetViewerId: viewerId, sdp: answer })
        );

        // Flush buffered ICE candidates for this viewer
        const buf = iceCandidateBuffersRef.current.get(viewerId);
        if (buf && buf.length > 0) {
          for (const item of buf) {
            try {
              if (item.type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(item.sdp));
              } else {
                await pc.addIceCandidate(new RTCIceCandidate(item));
              }
            } catch (err) {
              console.error(`[useBroadcaster] Failed to apply buffered item for ${viewerId}:`, err);
            }
          }
          iceCandidateBuffersRef.current.delete(viewerId);
        }
      } catch (error) {
        console.error(`[useBroadcaster] Failed to handle viewer offer from ${viewerId}:`, error);
        try { pc.close(); } catch (e) {}
        peersRef.current.delete(viewerId);
        iceCandidateBuffersRef.current.delete(viewerId);
      }
    },
    [createPeerForViewer]
  );

  const [chatMessages, setChatMessages] = useState<any[]>([]);

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "viewer-joined":
          await sendOfferToViewer(msg.viewerId);
          break;
        case "webrtc-answer": {
          const answerViewerId = msg.viewerId || msg.targetViewerId;
          if (answerViewerId && msg.sdp) {
            const pc = peersRef.current.get(answerViewerId);
            if (pc) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                console.log(`[useBroadcaster] Applied answer from viewer ${answerViewerId}`);

                // Flush buffered ICE candidates
                const buf = iceCandidateBuffersRef.current.get(answerViewerId);
                if (buf && buf.length > 0) {
                  for (const item of buf) {
                    if (item.type === 'answer') continue; // Already applied
                    try {
                      await pc.addIceCandidate(new RTCIceCandidate(item));
                    } catch (err) {
                      console.error(`[useBroadcaster] Failed to flush ICE candidate for ${answerViewerId}:`, err);
                    }
                  }
                  iceCandidateBuffersRef.current.delete(answerViewerId);
                }
              } catch (err) {
                console.error(`[useBroadcaster] Failed to set remote description for ${answerViewerId}:`, err);
                // Buffer for later
                const buf = iceCandidateBuffersRef.current.get(answerViewerId) || [];
                buf.push({ type: 'answer', sdp: msg.sdp });
                iceCandidateBuffersRef.current.set(answerViewerId, buf);
              }
            } else {
              // Buffer for later if peer connection not yet created
              const buf = iceCandidateBuffersRef.current.get(answerViewerId) || [];
              buf.push({ type: 'answer', sdp: msg.sdp });
              iceCandidateBuffersRef.current.set(answerViewerId, buf);
            }
          }
          break;
        }
        case "webrtc-offer": {
          // Viewer-initiated offer: broadcaster answers it
          if (msg.viewerId && msg.sdp) {
            await handleViewerOffer(msg.viewerId, msg.sdp);
          }
          break;
        }
        case "webrtc-ice-candidate": {
          const viewerId = msg.viewerId || msg.targetViewerId;
          if (viewerId && msg.candidate) {
            const pc = peersRef.current.get(viewerId);
            if (pc) {
              try {
                // Only add if remote description is set
                if (pc.remoteDescription) {
                  await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                } else {
                  // Buffer until remote description is set
                  const buf = iceCandidateBuffersRef.current.get(viewerId) || [];
                  buf.push(msg.candidate);
                  iceCandidateBuffersRef.current.set(viewerId, buf);
                }
              } catch (err) {
                console.error("[useBroadcaster] Failed to add ICE candidate", err);
                // Buffer for retry
                const buf = iceCandidateBuffersRef.current.get(viewerId) || [];
                buf.push(msg.candidate);
                iceCandidateBuffersRef.current.set(viewerId, buf);
              }
            } else {
              // Buffer ICE candidates until peer connection is created
              const buf = iceCandidateBuffersRef.current.get(viewerId) || [];
              buf.push(msg.candidate);
              iceCandidateBuffersRef.current.set(viewerId, buf);
            }
          }
          break;
        }
        case "viewer-left": {
          const pc = peersRef.current.get(msg.viewerId);
          if (pc) {
            try { pc.close(); } catch (e) {}
            peersRef.current.delete(msg.viewerId);
          }
          iceCandidateBuffersRef.current.delete(msg.viewerId);
          break;
        }
        case "viewer-count-update":
          setViewerCount(msg.viewers);
          break;
        case "chat-message":
          setChatMessages(prev => [...prev, {
            id: msg.id,
            user: msg.user,
            message: msg.message,
            timestamp: new Date(msg.timestamp),
            role: msg.role
          }]);
          break;
        case "chat-message-deleted":
          setChatMessages(prev => prev.filter(m => m.id !== msg.messageId));
          break;
        default:
          break;
      }
    },
    [sendOfferToViewer, handleViewerOffer]
  );

  const sendChatMessage = useCallback((message: string, user: string = "Admin") => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "chat-message",
        message,
        user
      }));
    }
  }, []);

  const deleteChatMessage = useCallback((messageId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "delete-chat-message",
        messageId
      }));
    }
  }, []);

  const startBroadcast = useCallback(
    (stream: MediaStream, session: StartBroadcastArgs) => {
      localStreamRef.current = stream;
      originalCameraStreamRef.current = session.originalCameraStream || stream;

      const initialMode = session.initialMode || "live";
      sessionInfoRef.current = {
        sessionId: session.sessionId,
        title: session.title,
        description: session.description || "",
        initialMode,
      };

      const connectWs = () => {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(`${protocol}//${window.location.host}/api/stream-sync`);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          wsReconnectAttemptRef.current = 0;
          ws.send(JSON.stringify({ type: "subscribe", role: "admin" }));
          ws.send(
            JSON.stringify({
              type: "go-live",
              sessionId: session.sessionId,
              title: session.title,
              description: session.description || "",
              broadcastMode: initialMode,
            })
          );
          setIsLive(true);
          setBroadcastMode(initialMode);
        };
        ws.onmessage = handleMessage;
        ws.onclose = () => {
          setConnected(false);
          // SILENT background reconnection — never reload the page
          if (isLive) {
            const delay = Math.min(1000 * Math.pow(1.5, Math.min(wsReconnectAttemptRef.current, 8)), 10000);
            wsReconnectAttemptRef.current++;
            console.log(`[useBroadcaster] WebSocket closed, reconnecting in ${delay}ms`);
            wsReconnectTimerRef.current = setTimeout(() => connectWs(), delay);
          }
        };
        ws.onerror = () => setConnected(false);
      };

      connectWs();
    },
    [handleMessage, isLive]
  );

  const stopBroadcast = useCallback(() => {
    if (wsReconnectTimerRef.current) {
      clearTimeout(wsReconnectTimerRef.current);
      wsReconnectTimerRef.current = null;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end-live" }));
    }
    wsRef.current?.close();
    wsRef.current = null;

    peersRef.current.forEach(pc => {
      try { pc.close(); } catch (e) {}
    });
    peersRef.current.clear();
    iceCandidateBuffersRef.current.clear();

    localStreamRef.current = null;
    originalCameraStreamRef.current = null;
    sessionInfoRef.current = null;
    setIsLive(false);
    setViewerCount(0);
    setBroadcastMode("offline");
  }, []);

  const updateBroadcast = useCallback((title: string, description: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "go-live",
        sessionId: "",
        title,
        description,
        broadcastMode,
      }));
    }
  }, [broadcastMode]);

  /**
   * Replace the current broadcast stream with a new one.
   * Used to switch between camera and pre-stream media while live.
   */
  const replaceStream = useCallback(async (newStream: MediaStream | null) => {
    if (!newStream) {
      console.warn("[useBroadcaster] Cannot replace with null stream");
      return;
    }

    try {
      const newVideoTrack = newStream.getVideoTracks()[0];
      const newAudioTrack = newStream.getAudioTracks()[0];

      for (const pc of Array.from(peersRef.current.values())) {
        const senders = pc.getSenders();
        for (const sender of senders) {
          if (sender.track?.kind === "video" && newVideoTrack) {
            await sender.replaceTrack(newVideoTrack);
            console.log("[useBroadcaster] Video track replaced with media");
          } else if (sender.track?.kind === "audio" && newAudioTrack) {
            await sender.replaceTrack(newAudioTrack);
            console.log("[useBroadcaster] Audio track replaced with media");
          }
        }
      }

      localStreamRef.current = newStream;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "broadcast-mode-changed",
          broadcastMode: "pre-stream",
        }));
      }

      setBroadcastMode("pre-stream");
      console.log("[useBroadcaster] Stream replaced with pre-stream media");
    } catch (error) {
      console.error("[useBroadcaster] Failed to replace stream:", error);
      throw error;
    }
  }, []);

  const restoreOriginalStream = useCallback(async () => {
    const originalStream = originalCameraStreamRef.current;
    if (!originalStream) {
      throw new Error("Original camera stream not available");
    }

    try {
      const videoTrack = originalStream.getVideoTracks()[0];
      const audioTrack = originalStream.getAudioTracks()[0];

      for (const pc of Array.from(peersRef.current.values())) {
        const senders = pc.getSenders();
        for (const sender of senders) {
          if (sender.track?.kind === "video" && videoTrack) {
            await sender.replaceTrack(videoTrack);
            console.log("[useBroadcaster] Video track restored to camera");
          } else if (sender.track?.kind === "audio" && audioTrack) {
            await sender.replaceTrack(audioTrack);
            console.log("[useBroadcaster] Audio track restored to microphone");
          }
        }
      }

      localStreamRef.current = originalStream;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "broadcast-mode-changed",
          broadcastMode: "live",
        }));
      }

      setBroadcastMode("live");
      console.log("[useBroadcaster] Stream restored to live camera");
    } catch (error) {
      console.error("[useBroadcaster] Failed to restore stream:", error);
      throw error;
    }
  }, []);

  const updateLocalStream = useCallback((newStream: MediaStream) => {
    localStreamRef.current = newStream;
    originalCameraStreamRef.current = newStream;
    const newVideoTrack = newStream.getVideoTracks()[0];
    const newAudioTrack = newStream.getAudioTracks()[0];

    peersRef.current.forEach(pc => {
      pc.getSenders().forEach(sender => {
        if (sender.track?.kind === "video" && newVideoTrack) {
          sender.replaceTrack(newVideoTrack);
        } else if (sender.track?.kind === "audio" && newAudioTrack) {
          sender.replaceTrack(newAudioTrack);
        }
      });
    });
  }, []);

  const goLiveFromPreStream = useCallback(async () => {
    const originalStream = originalCameraStreamRef.current;
    if (originalStream) {
      try {
        const videoTrack = originalStream.getVideoTracks()[0];
        const audioTrack = originalStream.getAudioTracks()[0];

        for (const pc of Array.from(peersRef.current.values())) {
          const senders = pc.getSenders();
          for (const sender of senders) {
            if (sender.track?.kind === "video" && videoTrack) {
              await sender.replaceTrack(videoTrack);
              console.log("[useBroadcaster] Video track switched to camera for go-live");
            } else if (sender.track?.kind === "audio" && audioTrack) {
              await sender.replaceTrack(audioTrack);
              console.log("[useBroadcaster] Audio track switched to mic for go-live");
            }
          }
        }
        localStreamRef.current = originalStream;
      } catch (error) {
        console.error("[useBroadcaster] Failed to restore camera for go-live:", error);
      }
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "broadcast-mode-changed",
        broadcastMode: "live",
      }));
    }
    setBroadcastMode("live");
    console.log("[useBroadcaster] Transitioned from pre-stream to live");
  }, []);

  return {
    connected,
    isLive,
    broadcastMode,
    viewerCount,
    streamStats,
    chatMessages,
    setChatMessages,
    startBroadcast,
    stopBroadcast,
    updateBroadcast,
    updateLocalStream,
    replaceStream,
    restoreOriginalStream,
    goLiveFromPreStream,
    sendChatMessage,
    deleteChatMessage,
  };
}
