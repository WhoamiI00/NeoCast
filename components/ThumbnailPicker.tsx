"use client";

import { useEffect, useRef, useState } from "react";

interface ThumbnailPickerProps {
  videoUrl: string;
  onPick: (file: File) => void;
  currentThumbnailUrl: string | null;
}

const ThumbnailPicker = ({
  videoUrl,
  onPick,
  currentThumbnailUrl,
}: ThumbnailPickerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      if (isFinite(v.duration) && v.duration > 0) {
        setDuration(v.duration);
      }
    };
    v.addEventListener("loadedmetadata", onMeta);
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [videoUrl]);

  const handleSeek = (value: number) => {
    setTime(value);
    if (videoRef.current) videoRef.current.currentTime = value;
  };

  const waitForSeek = (v: HTMLVideoElement, target: number) =>
    new Promise<void>((resolve) => {
      if (Math.abs(v.currentTime - target) < 0.05 && v.readyState >= 2) {
        resolve();
        return;
      }
      const onSeeked = () => {
        v.removeEventListener("seeked", onSeeked);
        resolve();
      };
      v.addEventListener("seeked", onSeeked);
      v.currentTime = target;
    });

  const capture = async () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;

    setIsCapturing(true);
    try {
      await waitForSeek(v, time);
      const w = v.videoWidth || 1280;
      const h = v.videoHeight || 720;
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) =>
        c.toBlob((b) => resolve(b), "image/jpeg", 0.85)
      );
      if (!blob) return;
      const file = new File([blob], `thumbnail-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      onPick(file);
    } finally {
      setIsCapturing(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="font-medium text-sm">Thumbnail</label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-xs text-gray-500">Pick a frame</span>
          <video
            ref={videoRef}
            src={videoUrl}
            preload="auto"
            muted
            playsInline
            controls
            className="w-full rounded-lg bg-black aspect-video"
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            disabled={!duration}
            className="w-full"
          />
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{formatTime(time)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <button
            type="button"
            onClick={capture}
            disabled={!duration || isCapturing}
            className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
          >
            {isCapturing ? "Capturing..." : "Use this frame"}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs text-gray-500">Selected thumbnail</span>
          {currentThumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentThumbnailUrl}
              alt="thumbnail preview"
              className="w-full rounded-lg aspect-video object-cover bg-gray-100"
            />
          ) : (
            <div className="w-full aspect-video rounded-lg bg-gray-100 flex items-center justify-center text-sm text-gray-400">
              No thumbnail selected
            </div>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default ThumbnailPicker;
