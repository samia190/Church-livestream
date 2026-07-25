import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Video, Mic, MicOff, Camera, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface WebRTCStreamerProps {
  onStreamReady?: (stream: MediaStream) => void;
  onError?: (error: string) => void;
}

export const WebRTCStreamer: React.FC<WebRTCStreamerProps> = ({ onStreamReady, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Enumerate available devices
  useEffect(() => {
    const enumerateDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const audioDevices = devices.filter(device => device.kind === 'audioinput');
        
        setCameras(videoDevices);
        setMicrophones(audioDevices);
        
        if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
        if (audioDevices.length > 0) {
          setSelectedMicrophone(audioDevices[0].deviceId);
        }
      } catch (err) {
        const errorMsg = 'Failed to enumerate devices';
        setError(errorMsg);
        onError?.(errorMsg);
        toast.error(errorMsg);
      }
    };

    enumerateDevices();

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
    };
  }, [onError]);

  // Start streaming
  const startStream = async () => {
    setLoading(true);
    setError('');
    
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
        audio: isMicOn ? (selectedMicrophone ? { deviceId: { exact: selectedMicrophone } } : true) : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsStreaming(true);
      onStreamReady?.(stream);
      toast.success('Camera and microphone connected successfully!');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to access camera/microphone';
      setError(errorMsg);
      onError?.(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Stop streaming
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
    toast.success('Stream stopped');
  };

  // Toggle microphone
  const toggleMicrophone = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicOn(!isMicOn);
      toast.success(`Microphone ${!isMicOn ? 'enabled' : 'disabled'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Video Preview */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 overflow-hidden">
        <div className="relative w-full aspect-video bg-black">
          {isStreaming ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Camera className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">Camera preview will appear here</p>
              </div>
            </div>
          )}

          {isStreaming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2"
            >
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-sm font-semibold">LIVE</span>
            </motion.div>
          )}
        </div>
      </Card>

      {/* Device Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Camera Selection */}
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
          <label className="block text-sm font-semibold text-foreground mb-2">
            <Video className="w-4 h-4 inline mr-2" />
            Select Camera
          </label>
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            disabled={isStreaming}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-foreground text-sm"
          >
            {cameras.map(camera => (
              <option key={camera.deviceId} value={camera.deviceId}>
                {camera.label || `Camera ${camera.deviceId.slice(0, 5)}`}
              </option>
            ))}
          </select>
        </Card>

        {/* Microphone Selection */}
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
          <label className="block text-sm font-semibold text-foreground mb-2">
            <Mic className="w-4 h-4 inline mr-2" />
            Select Microphone
          </label>
          <select
            value={selectedMicrophone}
            onChange={(e) => setSelectedMicrophone(e.target.value)}
            disabled={isStreaming}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-foreground text-sm"
          >
            {microphones.map(mic => (
              <option key={mic.deviceId} value={mic.deviceId}>
                {mic.label || `Microphone ${mic.deviceId.slice(0, 5)}`}
              </option>
            ))}
          </select>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-500">Error</p>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Controls */}
      <div className="flex gap-3 flex-wrap">
        {!isStreaming ? (
          <Button
            onClick={startStream}
            disabled={loading || !selectedCamera}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            {loading ? 'Connecting...' : 'Start Stream'}
          </Button>
        ) : (
          <>
            <Button
              onClick={stopStream}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
            >
              Stop Stream
            </Button>
            <Button
              onClick={toggleMicrophone}
              variant="outline"
              className="border-slate-600"
            >
              {isMicOn ? (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Mute
                </>
              ) : (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  Unmute
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {/* Device Info */}
      <Card className="p-4 bg-slate-900/50 border-slate-700">
        <p className="text-sm text-slate-400">
          <strong>Cameras found:</strong> {cameras.length} | <strong>Microphones found:</strong> {microphones.length}
        </p>
      </Card>
    </div>
  );
};
