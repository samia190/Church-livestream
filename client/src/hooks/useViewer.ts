import { useCallback, useEffect, useRef, useState } from "react";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface StreamMeta {
  sessionId: number | null;
  isLive: boolean;
  title: string;
  description: string;
  viewers: number;
  startTime: number;
}

const EMPTY_META: StreamMeta = {
  sessionId: null,
  isLive: false,
  title: "",
  description: "",
  viewers: 0,
  startTime: 0,
};

export function useViewer() {
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wasLiveRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [meta, setMeta] = useState<StreamMeta>(EMPTY_META);

  const teardownPeer = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    setRemoteStream(null);
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.ontrack = event => {
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = event => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "webrtc-ice-candidate", candidate: event.candidate })
        );
      }
    };

    pcRef.current = pc;
    return pc;
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "stream-update": {
          const wasLive = wasLiveRef.current;
          wasLiveRef.current = !!msg.session.isLive;
          setMeta({
            sessionId: msg.session.sessionId,
            isLive: msg.session.isLive,
            title: msg.session.title,
            description: msg.session.description,
            viewers: msg.session.viewers,
            startTime: msg.session.startTime,
          });
          if (msg.session.isLive && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "viewer-join" }));
          } else if (!msg.session.isLive && wasLive) {
            teardownPeer();
          }
          break;
        }

        case "viewer-count-update":
          setMeta(prev => ({ ...prev, viewers: msg.viewers }));
          break;

        case "webrtc-offer": {
          const pc = createPeerConnection();
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          wsRef.current?.send(JSON.stringify({ type: "webrtc-answer", sdp: answer }));
          break;
        }

        case "webrtc-ice-candidate": {
          if (pcRef.current && msg.candidate) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (err) {
              console.error("[Viewer] Failed to add ICE candidate", err);
            }
          }
          break;
        }

        case "broadcast-ended":
          teardownPeer();
          break;

        default:
          break;
      }
    };

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/stream-sync`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "subscribe", role: "viewer" }));
    };
    ws.onmessage = handleMessage;
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => {
      teardownPeer();
      ws.close();
      wsRef.current = null;
    };
    // Intentionally connect once per mount — reconnecting on every meta
    // change would tear down an in-progress viewing session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createPeerConnection, teardownPeer]);

  return { connected, remoteStream, meta };
}
