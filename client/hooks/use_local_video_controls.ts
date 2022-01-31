import { useCallback, useEffect, useState } from "react";
import { logger } from "../utils/logger";
import { useWhyDidYouUpdate } from "./use_why_did_you_update";

export enum ConnectionStatus {
  Waiting = "Waiting",
  Connecting = "Connecting",
  Connected = "Connected",
  Disconnected = "Disconnected",
  Failed = "Failed",
}

export type LocalVideoControls = ReturnType<typeof useLocalVideoControls>;

const VideoConstraints = {
  video: {
    width: { min: 640, max: 1920 },
    height: { min: 400, max: 1080 },
    frameRate: { min: 15, max: 30, ideal: 30 },
    resizeMode: { ideal: "crop-and-scale" },
  },
};

export function useLocalVideoControls(localStream: MediaStream) {
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false);
  const [isMicrophoneOn, setIsMicrophoneOn] = useState<boolean>(false);

  const getIsMicrophoneOn = useCallback(() => {
    let isOn = false;
    localStream.getAudioTracks().forEach(track => {
      // If any local audio track is not muted, then
      // consider the microphone is on.
      isOn = isOn || track.enabled;
    });
    return isOn;
  }, [localStream]);

  const getIsCameraOn = useCallback(() => {
    let isOn = false;
    localStream.getVideoTracks().forEach(track => {
      // If any local video track is enabled, then
      // consider the camera is on.
      isOn = isOn || track.enabled;
    });
    return isOn;
  }, [localStream]);

  const startCamera = useCallback(async (): Promise<void> => {
    // Camera light stays on in Chrome when the video media track is disabled.
    // Stopping the stream is the onyl way to turn the light off.
    // Re-enabling the stream does not work on a stopped video stream.
    // Create a new media stream and add video tracks to the old stream.
    const devices = navigator.mediaDevices;
    const newStream = await devices.getUserMedia(VideoConstraints);
    newStream.getVideoTracks().forEach(track => {
      localStream.addTrack(track);
      // Todo: Need to stop track when component is unmounted
    });
  }, [localStream]);

  const stopCamera = useCallback(() => {
    localStream.getVideoTracks().forEach(track => {
      track.enabled = false;
      track.stop(); // Must call stop, otherwise light stays on
      localStream.removeTrack(track);
    });
  }, [localStream]);

  const startMicrophone = useCallback(() => {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = true;
    });
  }, [localStream]);

  const stopMicrophone = useCallback(() => {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = false;
    });
  }, [localStream]);

  const toggleCamera = useCallback(async () => {
    logger.info("toggleCamera");
    let isOn = getIsCameraOn();
    if (isOn) {
      stopCamera();
    } else {
      await startCamera();
    }

    isOn = getIsCameraOn();
    logger.info(`Is camera on: ${isOn}`);
    setIsCameraOn(isOn);
  }, [getIsCameraOn, startCamera, stopCamera]);

  const toggleMicrophone = useCallback(() => {
    logger.info("toggleMicrophone");
    let isOn = getIsMicrophoneOn();
    if (isOn) {
      stopMicrophone();
    } else {
      startMicrophone();
    }

    isOn = getIsMicrophoneOn();
    logger.info(`Is microphone on: ${isOn}`);
    setIsMicrophoneOn(isOn);
  }, [getIsMicrophoneOn, startMicrophone, stopMicrophone]);

  useEffect(() => {
    setIsCameraOn(getIsCameraOn());
    setIsMicrophoneOn(getIsMicrophoneOn());
  }, [getIsCameraOn, getIsMicrophoneOn]);

  useWhyDidYouUpdate("use_video_chat", {
    addEventListener,
    removeEventListener,
    close,
    isCameraOn,
    isMicrophoneOn,
    toggleCamera,
    toggleMicrophone,
    getIsMicrophoneOn,
  });

  return {
    isCameraOn,
    isMicrophoneOn,
    toggleCamera,
    toggleMicrophone,
    getIsCameraOn,
    getIsMicrophoneOn,
  };
}
