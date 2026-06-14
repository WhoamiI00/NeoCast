"use client";

import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { incrementVideoViews } from "@/lib/actions/video";

interface Props extends VideoPlayerProps {
  transcript?: string;
}

const VideoPlayer = ({
  videoId,
  videoUrl,
  thumbnailUrl,
  transcript,
  className,
}: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasIncremented, setHasIncremented] = useState(false);

  const captionUrl = useMemo(() => {
    if (!transcript || !transcript.trim().startsWith("WEBVTT")) return null;
    const blob = new Blob([transcript], { type: "text/vtt" });
    return URL.createObjectURL(blob);
  }, [transcript]);

  useEffect(() => {
    return () => {
      if (captionUrl) URL.revokeObjectURL(captionUrl);
    };
  }, [captionUrl]);

  useEffect(() => {
    setHasIncremented(false);
  }, [videoId]);

  const handlePlay = async () => {
    if (hasIncremented) return;
    setHasIncremented(true);
    try {
      await incrementVideoViews(videoId);
    } catch (error) {
      console.error("Failed to increment view count:", error);
    }
  };

  return (
    <div className={cn("video-player", className)}>
      <video
        ref={videoRef}
        src={videoUrl}
        poster={thumbnailUrl}
        controls
        preload="auto"
        playsInline
        onPlay={handlePlay}
        className="w-full h-full rounded-lg"
      >
        {captionUrl && (
          <track
            kind="subtitles"
            src={captionUrl}
            srcLang="auto"
            label="Auto-generated"
            default
          />
        )}
      </video>
    </div>
  );
};

export default VideoPlayer;
