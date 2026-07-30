import { useCallback, useEffect, useRef, useState } from "react";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
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

export function useViewer() {
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
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
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected">("disconnected");

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
          // Viewer received their ID, now request to join
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "viewer-join" }));
          }
          break;
        }

        case "stream-update": {
          // Update stream metadata including broadcast mode
          if (msg.session) {
            const wasLive = meta.isLive;
            const isNowLive = msg.session.isLive;

            if (!wasLive && isNowLive) {
              // Stream just went live!
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
          // Handle broadcast mode changes (pre-stream to live, etc.)
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
            console.log(`[useViewer] Broadcast mode changed to: ${msg.broadcastMode}`);
          }
          break;
        }

        case "viewer-joined": {
          // Server is ready for us to send an offer
          const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          pcRef.current = pc;

          pc.ontrack = event => {
            console.log("[useViewer] Received remote track:", event.track.kind);
            setRemoteStream(event.streams[0]);
            setConnectionState("connected");
          };

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
            console.log(`[useViewer] Connection state: ${pc.connectionState}`);
            if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
              setConnectionState("disconnected");
              setRemoteStream(null);
            }
          };

          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            wsRef.current?.send(
              JSON.stringify({ type: "webrtc-offer", sdp: offer })
            );
            setConnectionState("connecting");
          } catch (error) {
            console.error("[useViewer] Failed to create offer:", error);
          }
          break;
        }

        case "webrtc-offer": {
          // Receive offer from broadcaster
          if (!pcRef.current) {
            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            pcRef.current = pc;

            pc.ontrack = event => {
              console.log("[useViewer] Received remote track:", event.track.kind);
              setRemoteStream(event.streams[0]);
              setConnectionState("connected");
            };

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
              console.log(`[useViewer] Connection state: ${pc.connectionState}`);
              if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
                setConnectionState("disconnected");
                setRemoteStream(null);
              }
            };
          }

          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            wsRef.current?.send(
              JSON.stringify({ type: "webrtc-answer", sdp: answer })
            );
            setConnectionState("connecting");
          } catch (error) {
            console.error("[useViewer] Failed to handle offer:", error);
          }
          break;
        }

        case "webrtc-answer": {
          // Receive answer from broadcaster
          if (pcRef.current) {
            try {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            } catch (error) {
              console.error("[useViewer] Failed to set remote description:", error);
            }
          }
          break;
        }

        case "webrtc-ice-candidate": {
          // Receive ICE candidate from broadcaster
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
          // Broadcaster ended the stream
          if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
          }
          setRemoteStream(null);
          setConnectionState("disconnected");
          setMeta(prev => ({
            ...prev,
            isLive: false,
            broadcastMode: "offline",
          }));
          break;
        }

        case "viewer-count-update": {
          // Update viewer count
          setMeta(prev => ({
            ...prev,
            viewers: msg.viewers,
          }));
          break;
        }

        case "chat-message": {
          // Receive chat message
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
          // Remove deleted chat message
          setChatMessages(prev => prev.filter(m => m.id !== msg.messageId));
          break;
        }

        default:
          break;
      }
    },
    []
  );

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/stream-sync`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[useViewer] Connected to signaling server");
      ws.send(JSON.stringify({ type: "subscribe", role: "viewer" }));
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      console.log("[useViewer] Disconnected from signaling server");
      setConnectionState("disconnected");
      setRemoteStream(null);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };

    ws.onerror = (error) => {
      console.error("[useViewer] WebSocket error:", error);
      setConnectionState("disconnected");
    };

    return () => {
      ws.close();
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, [handleMessage]);

  const sendChatMessage = useCallback((message: string, user: string = "Viewer") => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "chat-message",
        message,
        user,
      }));
    }
  }, []);

  return {
    remoteStream,
    meta,
    chatMessages,
    connectionState,
    sendChatMessage,
  };
}
