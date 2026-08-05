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
  /** The mixer-processed audio stream (UNIVERSAL audio source) */
  mixerProcessedStream?: MediaStream | null;
}

export type BroadcastMode = "offline" | "pre-stream" | "live";

export function useBroadcaster() {
  const wsRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceCandidateBuffersRef = useRef<Map<string, any[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const originalCameraStreamRef = useRef<MediaStream | null>(null);
  const mixerProcessedStreamRef = useRef<MediaStream | null>(null);
  // CRITICAL: one outbound MediaStream PER VIEWER, reused for every addTrack() call
  // for that viewer. WebRTC groups tracks into a single remote stream on the
  // receiving side based on which MediaStream object they were added with (msid).
  // Video came from the camera stream and audio came from the mixer's separate
  // MediaStreamAudioDestinationNode stream — two different objects — so without
  // this, the viewer's ontrack fires twice with TWO different remote streams and
  // ends up with only one track (usually video) surviving in state.
  const outboundStreamsRef = useRef<Map<string, MediaStream>>(new Map());
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
      outboundStreamsRef.current.delete(viewerId);
    }

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      iceCandidatePoolSize: 10,
    });
    peersRef.current.set(viewerId, pc);

    const stream = localStreamRef.current;
    const mixerAudio = mixerProcessedStreamRef.current;

    // Single shared MediaStream used for BOTH addTrack() calls below, so the
    // video and audio tracks are signaled to the viewer as one stream (same msid)
    // instead of two separate ones. This is what makes them arrive together in
    // a single `ontrack`-accumulated remote stream on the viewer's side.
    const outboundStream = new MediaStream();
    outboundStreamsRef.current.set(viewerId, outboundStream);

    if (stream) {
      // Add VIDEO track from the current stream
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        outboundStream.addTrack(videoTrack);
        const sender = pc.addTrack(videoTrack, outboundStream);
        // Set adaptive bitrate degradation for mobile viewers
        if (sender) {
          try {
            sender.setParameters({
              ...sender.getParameters(),
              degradationPreference: 'maintain-framerate',
              encodings: [{
                maxBitrate: 1500000,
                maxFramerate: 30,
                networkPriority: 'high',
              }],
            });
          } catch (e) {
            console.log('[useBroadcaster] setParameters not supported:', e);
          }
        }
      }

      // Add AUDIO track from the MIXER-PROCESSED stream (UNIVERSAL AUDIO)
      if (mixerAudio) {
        const audioTrack = mixerAudio.getAudioTracks()[0];
        if (audioTrack) {
          outboundStream.addTrack(audioTrack);
          pc.addTrack(audioTrack, outboundStream);
        }
      } else {
        // Fallback: use audio from the local stream
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          outboundStream.addTrack(audioTrack);
          pc.addTrack(audioTrack, outboundStream);
        }
      }
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
        try { pc.restartIce(); } catch (e) { console.log('[useBroadcaster] ICE restart failed:', e); }
        setTimeout(() => {
          if (pc.connectionState === 'failed') {
            try { pc.close(); } catch (e) {}
            peersRef.current.delete(viewerId);
            outboundStreamsRef.current.delete(viewerId);
          }
        }, 5000);
      } else if (state === "closed") {
        peersRef.current.delete(viewerId);
        outboundStreamsRef.current.delete(viewerId);
      } else if (state === "disconnected") {
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
      const existingPc = peersRef.current.get(viewerId);
      if (existingPc) {
        if (['connected', 'connecting'].includes(existingPc.connectionState)) {
          console.log(`[useBroadcaster] Viewer ${viewerId} already has active connection, skipping broadcaster offer`);
          return;
        }
        try { existingPc.close(); } catch (e) {}
        peersRef.current.delete(viewerId);
        outboundStreamsRef.current.delete(viewerId);
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

  /**
   * Renegotiate with a viewer whose peer connection is ALREADY connected —
   * e.g. after adding a track (like the mixer's audio track) mid-broadcast.
   *
   * This is deliberately separate from sendOfferToViewer(), which tears down
   * and recreates the peer connection. Recreating a live, working connection
   * just to add one track would drop video too and force full ICE re-gathering.
   * Instead we create a new offer on the SAME RTCPeerConnection so the browser
   * only signals the delta (the newly added track) via a standard WebRTC
   * renegotiation, which useViewer.ts already knows how to answer.
   */
  const renegotiateWithViewer = useCallback(async (viewerId: string) => {
    const pc = peersRef.current.get(viewerId);
    if (!pc) return;

    if (pc.signalingState !== 'stable') {
      // A negotiation is already in flight — retry shortly rather than
      // colliding with it (glare).
      setTimeout(() => renegotiateWithViewer(viewerId), 500);
      return;
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current?.send(
        JSON.stringify({ type: "webrtc-offer", targetViewerId: viewerId, sdp: offer })
      );
      console.log(`[useBroadcaster] Sent renegotiation offer to viewer ${viewerId}`);
    } catch (err) {
      console.error(`[useBroadcaster] Renegotiation failed for viewer ${viewerId}:`, err);
    }
  }, []);

  const handleViewerOffer = useCallback(
    async (viewerId: string, sdp: RTCSessionDescriptionInit) => {
      console.log(`[useBroadcaster] Received viewer-initiated offer from ${viewerId}`);

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
        outboundStreamsRef.current.delete(viewerId);
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

                const buf = iceCandidateBuffersRef.current.get(answerViewerId);
                if (buf && buf.length > 0) {
                  for (const item of buf) {
                    if (item.type === 'answer') continue;
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
                const buf = iceCandidateBuffersRef.current.get(answerViewerId) || [];
                buf.push({ type: 'answer', sdp: msg.sdp });
                iceCandidateBuffersRef.current.set(answerViewerId, buf);
              }
            } else {
              const buf = iceCandidateBuffersRef.current.get(answerViewerId) || [];
              buf.push({ type: 'answer', sdp: msg.sdp });
              iceCandidateBuffersRef.current.set(answerViewerId, buf);
            }
          }
          break;
        }
        case "webrtc-offer": {
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
                if (pc.remoteDescription) {
                  await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                } else {
                  const buf = iceCandidateBuffersRef.current.get(viewerId) || [];
                  buf.push(msg.candidate);
                  iceCandidateBuffersRef.current.set(viewerId, buf);
                }
              } catch (err) {
                console.error("[useBroadcaster] Failed to add ICE candidate", err);
                const buf = iceCandidateBuffersRef.current.get(viewerId) || [];
                buf.push(msg.candidate);
                iceCandidateBuffersRef.current.set(viewerId, buf);
              }
            } else {
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
            outboundStreamsRef.current.delete(msg.viewerId);
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
      mixerProcessedStreamRef.current = session.mixerProcessedStream || null;

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
    outboundStreamsRef.current.clear();

    localStreamRef.current = null;
    originalCameraStreamRef.current = null;
    mixerProcessedStreamRef.current = null;
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
   * Replace ONLY the video track on all peer connections.
   * Audio is ALWAYS from the mixer-processed stream — never replaced here.
   * This prevents audio collision where pre-stream audio bypasses the mixer.
   */
  const replaceStream = useCallback(async (newStream: MediaStream | null) => {
    if (!newStream) {
      console.warn("[useBroadcaster] Cannot replace with null stream");
      return;
    }

    try {
      // ONLY replace the VIDEO track — audio stays from the mixer
      const newVideoTrack = newStream.getVideoTracks()[0];

      for (const pc of Array.from(peersRef.current.values())) {
        const senders = pc.getSenders();
        for (const sender of senders) {
          if (sender.track?.kind === "video" && newVideoTrack) {
            await sender.replaceTrack(newVideoTrack);
            console.log("[useBroadcaster] Video track replaced — audio stays from mixer");
          }
          // DO NOT replace audio tracks — the mixer controls all audio
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
      console.log("[useBroadcaster] Video source changed — mixer audio unchanged");
    } catch (error) {
      console.error("[useBroadcaster] Failed to replace stream:", error);
      throw error;
    }
  }, []);

  /**
   * Replace ONLY the video track back to camera.
   * Audio remains from the mixer — NEVER restored to raw camera audio.
   */
  const restoreOriginalStream = useCallback(async () => {
    const originalStream = originalCameraStreamRef.current;
    if (!originalStream) {
      throw new Error("Original camera stream not available");
    }

    try {
      const videoTrack = originalStream.getVideoTracks()[0];

      for (const pc of Array.from(peersRef.current.values())) {
        const senders = pc.getSenders();
        for (const sender of senders) {
          if (sender.track?.kind === "video" && videoTrack) {
            await sender.replaceTrack(videoTrack);
            console.log("[useBroadcaster] Video track restored to camera");
          }
          // DO NOT replace audio — mixer controls all audio
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
      console.log("[useBroadcaster] Video restored to camera — mixer audio unchanged");
    } catch (error) {
      console.error("[useBroadcaster] Failed to restore stream:", error);
      throw error;
    }
  }, []);

  const updateLocalStream = useCallback((newStream: MediaStream) => {
    localStreamRef.current = newStream;
    originalCameraStreamRef.current = newStream;
    const newVideoTrack = newStream.getVideoTracks()[0];

    // ONLY replace video — audio is always from the mixer
    peersRef.current.forEach(pc => {
      pc.getSenders().forEach(sender => {
        if (sender.track?.kind === "video" && newVideoTrack) {
          sender.replaceTrack(newVideoTrack);
        }
      });
    });
  }, []);

  /**
   * Transition from pre-stream to live camera.
   * ONLY replaces video track — audio stays from mixer.
   */
  const goLiveFromPreStream = useCallback(async () => {
    const originalStream = originalCameraStreamRef.current;
    if (originalStream) {
      try {
        const videoTrack = originalStream.getVideoTracks()[0];

        for (const pc of Array.from(peersRef.current.values())) {
          const senders = pc.getSenders();
          for (const sender of senders) {
            if (sender.track?.kind === "video" && videoTrack) {
              await sender.replaceTrack(videoTrack);
              console.log("[useBroadcaster] Video track switched to camera for go-live");
            }
            // DO NOT replace audio — mixer owns all audio
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
    console.log("[useBroadcaster] Transitioned from pre-stream to live — mixer audio unchanged");
  }, []);

  /**
   * Update the mixer-processed audio stream reference.
   * Called by the ProfessionalAudioMixer when its output stream changes.
   * Replaces the audio track on all active peer connections.
   */
  const updateMixerAudio = useCallback(async (processedStream: MediaStream | null) => {
    mixerProcessedStreamRef.current = processedStream;

    if (!processedStream || !isLive) return;

    const newAudioTrack = processedStream.getAudioTracks()[0];
    if (!newAudioTrack) return;

    try {
      for (const [viewerId, pc] of Array.from(peersRef.current.entries())) {
        const senders = pc.getSenders();
        let audioSender = senders.find(s => s.track?.kind === "audio");
        
        if (audioSender) {
          await audioSender.replaceTrack(newAudioTrack);
        } else {
          // If no audio track was initially present, we MUST add it.
          // Add it to the SAME outbound stream used for this viewer's video
          // track (not `processedStream` directly) so it's grouped under the
          // same msid — otherwise it arrives as a separate remote stream on
          // the viewer's side and gets treated as unrelated to the video.
          const outboundStream = outboundStreamsRef.current.get(viewerId) || new MediaStream();
          outboundStreamsRef.current.set(viewerId, outboundStream);
          outboundStream.addTrack(newAudioTrack);
          pc.addTrack(newAudioTrack, outboundStream);
          // Renegotiate on this SAME connection to signal the new track —
          // do NOT use sendOfferToViewer here, since it tears down and
          // rebuilds already-connected peers instead of renegotiating them.
          await renegotiateWithViewer(viewerId);
          console.log(`[useBroadcaster] Added missing audio track and renegotiated with viewer ${viewerId}`);
        }
      }
      console.log("[useBroadcaster] Mixer audio track updated on all peers");
    } catch (err) {
      console.error("[useBroadcaster] Failed to update mixer audio:", err);
    }
  }, [isLive, renegotiateWithViewer]);

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
    updateMixerAudio,
    sendChatMessage,
    deleteChatMessage,
  };
}
