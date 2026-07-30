import { useCallback, useEffect, useRef, useState } from "react";

// Free, public, no-account-needed STUN servers
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface StartBroadcastArgs {
  sessionId: string;
  title: string;
  description?: string;
}

export type BroadcastMode = "offline" | "pre-stream" | "live";

export function useBroadcaster() {
  const wsRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
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
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(viewerId, pc);

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    pc.onicecandidate = event => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "webrtc-ice-candidate",
            targetViewerId: viewerId,
            candidate: event.candidate,
          })
        );
      }
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        pc.close();
        peersRef.current.delete(viewerId);
      }
    };

    return pc;
  }, []);

  const sendOfferToViewer = useCallback(
    async (viewerId: string) => {
      const pc = createPeerForViewer(viewerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current?.send(
        JSON.stringify({ type: "webrtc-offer", targetViewerId: viewerId, sdp: offer })
      );
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
          const pc = peersRef.current.get(msg.viewerId);
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          break;
        }
        case "webrtc-ice-candidate": {
          const pc = peersRef.current.get(msg.viewerId);
          if (pc && msg.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (err) {
              console.error("[useBroadcaster] Failed to add ICE candidate", err);
            }
          }
          break;
        }
        case "viewer-left": {
          const pc = peersRef.current.get(msg.viewerId);
          if (pc) {
            pc.close();
            peersRef.current.delete(msg.viewerId);
          }
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
    [sendOfferToViewer]
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

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/stream-sync`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: "subscribe", role: "admin" }));
        ws.send(
          JSON.stringify({
            type: "go-live",
            sessionId: session.sessionId,
            title: session.title,
            description: session.description || "",
            broadcastMode: "live",
          })
        );
        setIsLive(true);
        setBroadcastMode("live");
      };
      ws.onmessage = handleMessage;
      ws.onclose = () => {
        setConnected(false);
        setIsLive(false);
        setBroadcastMode("offline");
      };
      ws.onerror = () => setConnected(false);
    },
    [handleMessage]
  );

  const stopBroadcast = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end-live" }));
    }
    wsRef.current?.close();
    wsRef.current = null;

    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();

    localStreamRef.current = null;
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
   * This is used to switch between camera and pre-stream media.
   * Uses RTCRtpSender.replaceTrack() to avoid reconnection.
   */
  const replaceStream = useCallback(async (newStream: MediaStream | null) => {
    if (!newStream) {
      console.warn("[useBroadcaster] Cannot replace with null stream");
      return;
    }

    try {
      const newVideoTrack = newStream.getVideoTracks()[0];
      const newAudioTrack = newStream.getAudioTracks()[0];

      // Replace tracks in all peer connections
      for (const pc of peersRef.current.values()) {
        const senders = pc.getSenders();

        for (const sender of senders) {
          if (sender.track?.kind === "video" && newVideoTrack) {
            await sender.replaceTrack(newVideoTrack);
            console.log("[useBroadcaster] Video track replaced");
          } else if (sender.track?.kind === "audio" && newAudioTrack) {
            await sender.replaceTrack(newAudioTrack);
            console.log("[useBroadcaster] Audio track replaced");
          }
        }
      }

      // Update local stream reference
      localStreamRef.current = newStream;

      // Notify server of mode change
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "broadcast-mode-changed",
          broadcastMode: "pre-stream",
        }));
      }

      setBroadcastMode("pre-stream");
      console.log("[useBroadcaster] Stream replaced successfully");
    } catch (error) {
      console.error("[useBroadcaster] Failed to replace stream:", error);
      throw error;
    }
  }, []);

  /**
   * Switch back to the original camera/microphone stream.
   */
  const restoreOriginalStream = useCallback(async (originalStream: MediaStream) => {
    try {
      const videoTrack = originalStream.getVideoTracks()[0];
      const audioTrack = originalStream.getAudioTracks()[0];

      for (const pc of peersRef.current.values()) {
        const senders = pc.getSenders();

        for (const sender of senders) {
          if (sender.track?.kind === "video" && videoTrack) {
            await sender.replaceTrack(videoTrack);
            console.log("[useBroadcaster] Video track restored");
          } else if (sender.track?.kind === "audio" && audioTrack) {
            await sender.replaceTrack(audioTrack);
            console.log("[useBroadcaster] Audio track restored");
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
      console.log("[useBroadcaster] Stream restored successfully");
    } catch (error) {
      console.error("[useBroadcaster] Failed to restore stream:", error);
      throw error;
    }
  }, []);

  const updateLocalStream = useCallback((newStream: MediaStream) => {
    localStreamRef.current = newStream;
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
    sendChatMessage,
    deleteChatMessage,
  };
}
