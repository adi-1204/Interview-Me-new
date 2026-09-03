import React, { useEffect, useRef, useState } from "react";
import "../style/media-recorder.scss";

const MediaRecorderView = ({
  onRecordingComplete,
  targetDurationSeconds = 90,
}) => {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);
  const visualizerContainerRef = useRef(null);

  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [recordingState, setRecordingState] = useState("idle"); // idle | recording | stopped
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const attachStreamToVideo = (node) => {
    videoRef.current = node;
    if (node && mediaStreamRef.current) {
      if (node.srcObject !== mediaStreamRef.current) {
        node.srcObject = mediaStreamRef.current;
      }
      node.play().catch(() => {});
    }
  };

  useEffect(() => {
    if (hasVideo && videoRef.current && mediaStreamRef.current) {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [hasVideo]);

  // Request permissions & setup media stream
  useEffect(() => {
    let isMounted = true;

    async function initMediaStream() {
      try {
        // Try full audio + video first
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: true,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        mediaStreamRef.current = stream;
        setHasVideo(true);
        setHasAudio(true);

        if (videoRef.current) {
          if (videoRef.current.srcObject !== stream) {
            videoRef.current.srcObject = stream;
          }
          videoRef.current.play().catch(() => {});
        }
        setupAudioVisualizer(stream);
      } catch (videoErr) {
        console.warn("Video access failed, attempting audio-only fallback:", videoErr);
        try {
          // Fallback to audio only
          const audioStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });

          if (!isMounted) {
            audioStream.getTracks().forEach((track) => track.stop());
            return;
          }

          mediaStreamRef.current = audioStream;
          setHasVideo(false);
          setHasAudio(true);
          setupAudioVisualizer(audioStream);
        } catch (audioErr) {
          console.error("Audio & Video permission denied or unavailable:", audioErr);
          if (!isMounted) return;
          setHasVideo(false);
          setHasAudio(false);
          setPermissionError(
            "Microphone and camera access were blocked. Please enable permissions in your browser settings to continue.",
          );
        }
      }
    }

    initMediaStream();

    return () => {
      isMounted = false;
      stopMediaStream();
    };
  }, []);

  // Timer while recording
  useEffect(() => {
    let timerId = null;
    if (recordingState === "recording") {
      timerId = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (recordingState === "idle") {
      setElapsedSeconds(0);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [recordingState]);

  // Setup Web Audio API volume visualizer using direct DOM manipulation (no React re-render churn)
  const setupAudioVisualizer = (stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        const baseHeight = Math.max(6, Math.min(32, (average / 128) * 32));
        const levels = [
          Math.max(4, baseHeight * 0.7),
          Math.max(4, baseHeight * 1.1),
          Math.max(4, baseHeight * 1.3),
          Math.max(4, baseHeight * 0.9),
          Math.max(4, baseHeight * 0.6),
        ];

        if (visualizerContainerRef.current) {
          const sticks = visualizerContainerRef.current.children;
          for (let i = 0; i < sticks.length && i < levels.length; i++) {
            sticks[i].style.height = `${levels[i]}px`;
          }
        }

        animFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (e) {
      console.warn("Could not setup audio visualizer:", e);
    }
  };

  const stopMediaStream = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  const selectSupportedMimeType = () => {
    const types = [
      "video/webm;codecs=vp9,opus",
      "video/webm",
      "video/mp4",
      "audio/webm",
      "audio/mp3",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return "";
  };

  const handleStartRecording = () => {
    if (!mediaStreamRef.current) return;

    chunksRef.current = [];
    const mimeType = selectSupportedMimeType();
    const options = mimeType ? { mimeType } : undefined;

    try {
      const recorder = new MediaRecorder(mediaStreamRef.current, options);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalType = recorder.mimeType || mimeType || "video/webm";
        const recordedBlob = new Blob(chunksRef.current, { type: finalType });

        if (onRecordingComplete) {
          onRecordingComplete(recordedBlob);
        }
      };

      recorder.start(500);
      mediaRecorderRef.current = recorder;
      setRecordingState("recording");
    } catch (err) {
      console.error("Failed to start MediaRecorder:", err);
      setPermissionError("Could not start media recorder on this device.");
    }
  };

  const handleStopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setRecordingState("stopped");
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="media-recorder-view">
      <div className="video-preview-wrapper">
        {permissionError ? (
          <div className="permission-denied-box">
            <h3>Camera / Mic Access Error</h3>
            <p>{permissionError}</p>
          </div>
        ) : hasVideo ? (
          <video
            ref={attachStreamToVideo}
            autoPlay
            playsInline
            muted
          />
        ) : hasAudio ? (
          <div className="audio-only-fallback">
            <span className="audio-icon">🎙️</span>
            <h3>Audio Mode Active</h3>
            <p>Video feed disabled or permission denied. Audio recording is ready.</p>
          </div>
        ) : (
          <div className="audio-only-fallback">
            <p>Requesting camera &amp; microphone permissions...</p>
          </div>
        )}

        {/* Live Recording Badge */}
        {recordingState === "recording" && (
          <div className="recording-status-overlay">
            <span className="recording-dot" />
            <span>REC {formatTime(elapsedSeconds)} / {formatTime(targetDurationSeconds)}</span>
          </div>
        )}

        {/* Live Audio Visualizer (DOM updated for 60fps performance) */}
        {(recordingState === "recording" || hasAudio) && !permissionError && (
          <div ref={visualizerContainerRef} className="audio-visualizer-bar">
            <div className="volume-stick" style={{ height: "6px" }} />
            <div className="volume-stick" style={{ height: "6px" }} />
            <div className="volume-stick" style={{ height: "6px" }} />
            <div className="volume-stick" style={{ height: "6px" }} />
            <div className="volume-stick" style={{ height: "6px" }} />
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="controls-bar">
        {recordingState === "idle" && (
          <button
            type="button"
            className="record-btn record-btn--start"
            disabled={!hasAudio && !hasVideo}
            onClick={handleStartRecording}
          >
            <span>⏺</span> Start Answer
          </button>
        )}

        {recordingState === "recording" && (
          <button
            type="button"
            className="record-btn record-btn--stop"
            onClick={handleStopRecording}
          >
            <span>⏹</span> Finish Answer
          </button>
        )}

        {recordingState === "stopped" && (
          <button type="button" className="record-btn record-btn--start" disabled>
            Processing Answer...
          </button>
        )}
      </div>
    </div>
  );
};

export default MediaRecorderView;
