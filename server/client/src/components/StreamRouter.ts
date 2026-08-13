/**
 * StreamRouter: Manages switching between camera and pre-stream media.
 *
 * This module provides a clean abstraction for routing the broadcast stream
 * between the live camera feed and captured pre-stream media. It ensures
 * that track replacement is done safely and that state is kept in sync.
 */

import type { BroadcastMode } from "@/hooks/useBroadcaster.enhanced";

export interface StreamRouterConfig {
  onModeChange?: (mode: BroadcastMode) => void;
  onError?: (error: Error) => void;
}

export class StreamRouter {
  private currentMode: BroadcastMode = "offline";
  private cameraStream: MediaStream | null = null;
  private preStreamStream: MediaStream | null = null;
  private config: StreamRouterConfig;

  constructor(config: StreamRouterConfig = {}) {
    this.config = config;
  }

  /**
   * Set the camera stream reference.
   * This is the original stream that will be restored when exiting pre-stream mode.
   */
  setCameraStream(stream: MediaStream | null): void {
    this.cameraStream = stream;
  }

  /**
   * Switch to pre-stream mode with the captured media stream.
   */
  async switchToPreStream(
    preStreamStream: MediaStream,
    replaceStreamFn: (stream: MediaStream) => Promise<void>
  ): Promise<void> {
    try {
      if (!preStreamStream || preStreamStream.getTracks().length === 0) {
        throw new Error("Invalid pre-stream: no tracks available");
      }

      // Perform the actual track replacement
      await replaceStreamFn(preStreamStream);

      // Update state
      this.preStreamStream = preStreamStream;
      this.currentMode = "pre-stream";

      // Notify listeners
      this.config.onModeChange?.("pre-stream");

      console.log("[StreamRouter] Switched to pre-stream mode");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.config.onError?.(err);
      throw err;
    }
  }

  /**
   * Switch back to live camera mode.
   */
  async switchToLive(
    restoreStreamFn: (stream: MediaStream) => Promise<void>
  ): Promise<void> {
    try {
      if (!this.cameraStream || this.cameraStream.getTracks().length === 0) {
        throw new Error("Camera stream not available");
      }

      // Perform the actual track replacement
      await restoreStreamFn(this.cameraStream);

      // Update state
      this.currentMode = "live";

      // Notify listeners
      this.config.onModeChange?.("live");

      console.log("[StreamRouter] Switched to live mode");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.config.onError?.(err);
      throw err;
    }
  }

  /**
   * Get the current broadcast mode.
   */
  getMode(): BroadcastMode {
    return this.currentMode;
  }

  /**
   * Check if currently in pre-stream mode.
   */
  isPreStream(): boolean {
    return this.currentMode === "pre-stream";
  }

  /**
   * Check if currently in live mode.
   */
  isLive(): boolean {
    return this.currentMode === "live";
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    // Stop all tracks in pre-stream
    if (this.preStreamStream) {
      this.preStreamStream.getTracks().forEach(track => track.stop());
      this.preStreamStream = null;
    }

    // Note: We don't stop the camera stream as it's managed externally
    this.cameraStream = null;
    this.currentMode = "offline";
  }
}
