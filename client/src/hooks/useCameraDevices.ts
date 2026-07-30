import { useCallback, useEffect, useRef, useState } from "react";

export interface CameraDeviceOption {
  deviceId: string;
  label: string;
  isCapturing: boolean; // true if this device currently has an active stream
}

/**
 * Manages camera acquisition and switching.
 *
 * Device coverage:
 * - USB webcams show up automatically as regular video input devices —
 *   nothing special is needed, `enumerateDevices()` lists them like any
 *   built-in camera.
 * - HDMI sources need a UVC-class HDMI capture card/dongle (e.g. a
 *   generic "HDMI to USB" capture stick). Once one is plugged in, the OS
 *   and browser see it exactly like a USB webcam, so it also just
 *   appears in this same device list — no separate "HDMI mode" exists
 *   in a browser, since a browser cannot read a raw HDMI signal without
 *   that capture hardware in between.
 * - Mobile front/back cameras are switched with the `facingMode`
 *   constraint, which is more reliable across phone browsers than
 *   picking a specific deviceId.
 */
export function useCameraDevices() {
  const [devices, setDevices] = useState<CameraDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(ua));
  }, []);

  const refreshDevices = useCallback(async (withProgress = false) => {
    if (withProgress) setIsScanning(true);

    // Simulate scanning phases for visual feedback
    const phases = [
      { progress: 15, message: "Initializing..." },
      { progress: 30, message: "Detecting USB devices..." },
      { progress: 50, message: "Checking HDMI capture cards..." },
      { progress: 70, message: "Enumerating video inputs..." },
      { progress: 90, message: "Resolving device labels..." },
      { progress: 100, message: "Scan complete" },
    ];

    for (const phase of phases) {
      setScanProgress(phase.progress);
      await new Promise(r => setTimeout(r, withProgress ? 250 : 0));
    }

    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = all
        .filter(d => d.kind === "videoinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
          isCapturing: streamRef.current?.getVideoTracks().some(t => t.getSettings().deviceId === d.deviceId) || false,
        }));
      setDevices(videoInputs);

      if (withProgress) {
        // Small delay to show "complete" state
        await new Promise(r => setTimeout(r, 300));
        setIsScanning(false);
        setScanProgress(0);
      }
    } catch (err) {
      console.error("[Camera] Failed to enumerate devices:", err);
      setIsScanning(false);
      setScanProgress(0);
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", () => refreshDevices());
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", () => refreshDevices());
  }, [refreshDevices]);

  const stopCurrentStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const acquireStream = useCallback(
    async (constraints: MediaStreamConstraints) => {
      stopCurrentStream();
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = newStream;
      setStream(newStream);
      setError(null);
      // Device labels are only populated by the browser after permission
      // has been granted at least once — refresh now that it has.
      refreshDevices();
      return newStream;
    },
    [refreshDevices, stopCurrentStream]
  );

  const start = useCallback(async () => {
    try {
      return await acquireStream({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
    } catch (err: any) {
      console.error("[Camera] Failed to start camera:", err);
      try {
        return await acquireStream({ video: true, audio: true });
      } catch (innerErr: any) {
        setError(innerErr?.message || "Could not access camera/microphone");
        throw innerErr;
      }
    }
  }, [acquireStream]);

  const switchToDevice = useCallback(
    async (deviceId: string) => {
      const newStream = await acquireStream({
        video: { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      setSelectedDeviceId(deviceId);
      return newStream;
    },
    [acquireStream]
  );

  const flipFacing = useCallback(async () => {
    const nextFacing: "user" | "environment" = facingMode === "user" ? "environment" : "user";
    try {
      const newStream = await acquireStream({
        video: { facingMode: { exact: nextFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      setFacingMode(nextFacing);
      setSelectedDeviceId(null);
      return newStream;
    } catch {
      const newStream = await acquireStream({
        video: { facingMode: nextFacing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      setFacingMode(nextFacing);
      setSelectedDeviceId(null);
      return newStream;
    }
  }, [facingMode, acquireStream]);

  useEffect(() => {
    return () => stopCurrentStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    devices,
    selectedDeviceId,
    facingMode,
    isMobile,
    stream,
    error,
    isScanning,
    scanProgress,
    start,
    switchToDevice,
    flipFacing,
    refreshDevices,
  };
}
