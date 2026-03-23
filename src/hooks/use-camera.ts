"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseCameraOptions {
  facingMode?: "user" | "environment";
}

export function useCamera(options: UseCameraOptions = {}) {
  const { facingMode = "environment" } = options;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isActiveRef = useRef(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Attach stream to video element — called when video element becomes available
  const attachStream = useCallback(() => {
    if (!streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (video.srcObject === streamRef.current) return; // already attached

    video.srcObject = streamRef.current;
    video.onloadedmetadata = () => {
      video.play().catch(console.error);
    };
    // Fallback: try play after short delay if metadata doesn't fire
    setTimeout(() => {
      if (video.paused && video.srcObject) {
        video.play().catch(() => {});
      }
    }, 1000);
  }, []);

  // Re-attach stream whenever videoRef changes (React re-renders the element)
  useEffect(() => {
    if (isActive && streamRef.current) {
      // Small delay to let React render the video element
      requestAnimationFrame(() => {
        attachStream();
      });
    }
  }, [isActive, attachStream]);

  const start = useCallback(async () => {
    try {
      setError(null);

      // Request camera
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
        });
      }

      streamRef.current = stream;
      isActiveRef.current = true;
      setIsActive(true); // This triggers React to render <video> element
      setHasPermission(true);

      // Stream will be attached in the useEffect above after React renders
    } catch (err) {
      const message = (err as Error).message || "";
      if (message.includes("Permission") || message.includes("NotAllowed")) {
        setError("Camera permission denied. Please allow camera access.");
        setHasPermission(false);
      } else if (message.includes("NotFound") || message.includes("DevicesNotFound")) {
        setError("No camera found on this device.");
      } else if (message.includes("NotReadable") || message.includes("TrackStartError")) {
        setError("Camera is in use by another app.");
      } else {
        setError("Failed to access camera. Please try again.");
      }
      console.error("Camera error:", err);
      isActiveRef.current = false;
      setIsActive(false);
    }
  }, [facingMode]);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isActiveRef.current = false;
    setIsActive(false);
  }, []);

  const captureAsync = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current || !isActiveRef.current) {
        resolve(null);
        return;
      }

      const video = videoRef.current;

      requestAnimationFrame(() => {
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          resolve(null);
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(
          (blob) => resolve(blob),
          "image/jpeg",
          0.85
        );
      });
    });
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    videoRef,
    isActive,
    error,
    hasPermission,
    start,
    stop,
    captureAsync,
  };
}
