import { useCallback, useEffect, useRef, useState } from "react";

// Free, public, no-account-needed STUN servers. These help two peers on
// typical home/office networks discover how to reach each other directly.
// There is deliberately no TURN server here (a relay of last resort for
// very restrictive networks) since that needs paid or self-hosted
// infrastructure — on most networks STUN alone is enough for a direct
// peer-to-peer connection to succeed.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface StartBroadcastArgs {
  sessionId: string;
  title: string;
  description?: string;
}

export function useBroadcaster() {
  const wsRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [isLive, setIsLive] = useState(false);
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
      // Get stats from the first peer connection as a proxy for the whole stream
      const firstPeer = Array.from(peersRef.current.values())[0];
      if (!firstPeer) return;

      try {
        const stats = await firstPeer.getStats();
        let bitrate = 0;
        let fps = 0;
        let resolution = "";
        let packetsLost = 0;

        stats.forEach(report => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            // Bitrate calculation would need previous value, but we can approximate or just show current
            bitrate = (report.bytesSent * 8) / 1000000; // Simplified
            fps = report.framesPerSecond || 0;
            packetsLost = report.packetsLost || 0;
          }
          if (report.type === 'track' && report.kind === 'video') {
            resolution = `${report.frameWidth}x${report.frameHeight}`;
          }
        });

        setStreamStats({ bitrate, fps, resolution, packetsLost });
      } catch (err) {
        console.error("Failed to get RTC stats", err);
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
              console.error("[Broadcaster] Failed to add ICE candidate", err);
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
          })
        );
        setIsLive(true);
      };
      ws.onmessage = handleMessage;
      ws.onclose = () => {
        setConnected(false);
        setIsLive(false);
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
  }, []);

  const updateBroadcast = useCallback((title: string, description: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "go-live", // Re-sending go-live updates the session info
        sessionId: "", // Not strictly needed for update but good for consistency
        title,
        description
      }));
    }
  }, []);

  // Called when the admin switches camera (device or front/back) while
  // already live. Replaces the outgoing track on every existing peer
  // connection in place — via RTCRtpSender.replaceTrack — so viewers keep
  // watching the same connection instead of it dropping and reconnecting.
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

  return { connected, isLive, viewerCount, streamStats, chatMessages, setChatMessages, startBroadcast, stopBroadcast, updateBroadcast, updateLocalStream, sendChatMessage, deleteChatMessage };
}
