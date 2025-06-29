"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { useScreenRecording } from "@/lib/hooks/useScreenRecording";
import { ICONS } from "@/constants";

const RecordScreen = () => {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const {
    isRecording,
    recordedBlob,
    recordedVideoUrl,
    recordingDuration,
    startRecording,
    stopRecording,
    resetRecording,
  } = useScreenRecording();

  // Debug: Log state changes
  useEffect(() => {
    console.log('Recording state:', { 
      isRecording, 
      hasRecordedVideo: !!recordedVideoUrl,
      recordingDuration 
    });
  }, [isRecording, recordedVideoUrl, recordingDuration]);

  const closeModal = () => {
    resetRecording();
    setIsOpen(false);
  };

  const handleStart = async () => {
    try {
      console.log('Starting recording...');
      await startRecording();
      console.log('Recording started successfully');
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handleStop = async () => {
    try {
      console.log('Stopping recording...');
      await stopRecording();
      console.log('Recording stopped successfully');
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const recordAgain = async () => {
    try {
      console.log('Recording again...');
      resetRecording();
      await startRecording();
    } catch (error) {
      console.error('Failed to record again:', error);
    }
  };

  const goToUpload = () => {
    if (!recordedBlob) {
      console.error('No recorded blob available');
      return;
    }
    
    const url = URL.createObjectURL(recordedBlob);
    sessionStorage.setItem(
      "recordedVideo",
      JSON.stringify({
        url,
        name: "screen-recording.webm",
        type: recordedBlob.type,
        size: recordedBlob.size,
        duration: recordingDuration || 0,
      })
    );
    router.push("/upload");
    closeModal();
  };

  // Format duration for display
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="record">
      <button onClick={() => setIsOpen(true)} className="primary-btn">
        <Image src={ICONS.record} alt="record" width={16} height={16} />
        <span className="truncate">Record a video</span>
      </button>

      {isOpen && (
        <section className="dialog">
          <div className="overlay-record" onClick={closeModal} />
          <div className="dialog-content">
            <figure className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Screen Recording</h3>
              <button 
                onClick={closeModal}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Image src={ICONS.close} alt="Close" width={20} height={20} />
              </button>
            </figure>

            <section className="mb-6">
              {isRecording ? (
                <article className="flex items-center justify-center gap-3 p-6 text-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
                  <span className="text-red-600 font-medium">
                    Recording in progress... {formatDuration(recordingDuration)}
                  </span>
                </article>
              ) : recordedVideoUrl ? (
                <div className="flex justify-center">
                  <video 
                    ref={videoRef} 
                    src={recordedVideoUrl} 
                    controls 
                    className="w-full max-w-md rounded-lg shadow-md"
                  />
                </div>
              ) : (
                <div className="text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-600">Click record to start capturing your screen</p>
                </div>
              )}
            </section>

            <div className="record-box flex gap-3 justify-center">
              {!isRecording && !recordedVideoUrl && (
                <button 
                  onClick={handleStart} 
                  className="record-start bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
                >
                  <Image
                    src={ICONS.record}
                    alt="record"
                    width={16}
                    height={16}
                  />
                  Record
                </button>
              )}
              
              {isRecording && (
                <button 
                  onClick={handleStop} 
                  className="record-stop bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium animate-pulse"
                >
                  <div className="w-3 h-3 bg-white rounded-sm" />
                  Stop Recording
                </button>
              )}
              
              {recordedVideoUrl && !isRecording && (
                <>
                  <button 
                    onClick={recordAgain} 
                    className="record-again bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors font-medium"
                  >
                    Record Again
                  </button>
                  <button 
                    onClick={goToUpload} 
                    className="record-upload bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
                  >
                    <Image
                      src={ICONS.upload}
                      alt="Upload"
                      width={16}
                      height={16}
                    />
                    Continue to Upload
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default RecordScreen;
