import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocalVideoControls } from "../../hooks/use_local_video_controls";
import { Box } from "../Box";
import { Button } from "../Button";
import { MicIcon, MicOffIcon } from "../Icons";
import { Panel } from "../Panel";
import { Stack } from "../Stack";
import { useWhyDidYouUpdate } from "../../hooks/use_why_did_you_update";
import { motion, useAnimation } from "framer-motion";
import styled from "styled-components";

export const enum LocalMediaState {
  Pending = "Pending",
  NotAllowed = "NotAllowed",
  OtherError = "OtherError",
  Opened = "Opened",
  Requested = "Requested",
}

type Props = {
  remoteStream?: MediaStream;
  localStream: MediaStream;
};

const ChatVideo = styled.video`
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const VideoContainer = styled(motion.div)`
  aspect-ratio: 4/4;
  position: absolute;
  top: 0;
  right: 0;
  width: 100%;
  height: 100%;
`;

const MainContainer = styled(Box)`
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
`;

export const VideoPanel = (props: Props) => {
  const { localStream, remoteStream } = props;
  const remoteVideoElement = useRef<HTMLVideoElement | null>(null);
  const localVideoElement = useRef<HTMLVideoElement | null>(null);
  const [showRemoteVideo, setShowRemoteVideo] = useState(false);

  //const { remoteStream, setupLocalStream } = signalingClient;
  const { isMicrophoneOn, toggleMicrophone } = useLocalVideoControls(localStream);

  // using useLayoutEffect to trigger the animation to start via the useEffect synchrounously
  // with the remoteStream going away
  useLayoutEffect(() => {
    if (remoteVideoElement.current) {
      if (remoteStream) {
        remoteVideoElement.current.srcObject = remoteStream;
      } else {
        setShowRemoteVideo(false);
        remoteVideoElement.current.srcObject = null;
      }
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoElement.current && localStream) {
      localVideoElement.current.srcObject = localStream;
    }
  }, [localStream]);

  useWhyDidYouUpdate("VideoPanel", {
    addEventListener,
    removeEventListener,
    localStream,
    close,
  });

  const localVideoControls = useAnimation();

  useEffect(() => {
    if (showRemoteVideo) {
      // Ignore promise that resolves when animations end
      void localVideoControls.start({
        // scale: 0.25,
        // transformOrigin: "95% 5%",
        width: "25%",
        height: "25%",
        translateX: "-15%",
        translateY: "15%",
        transition: { duration: 0.5 },
      });
    } else {
      // Ignore promise that resolves when animations end
      void localVideoControls.start({
        // scale: 1,
        // transformOrigin: "95% 5%",
        width: "100%",
        height: "100%",
        translateX: 0,
        translateY: 0,
        transition: { duration: 0.5 },
      });
    }
  }, [showRemoteVideo, localVideoControls]);

  return (
    <Panel border padding="xs" background={"body"} panelTitle={"video"} fullscreen>
      <MainContainer background="panel">
        <VideoContainer>
          <ChatVideo
            style={{
              visibility: showRemoteVideo ? "visible" : "hidden",
            }}
            ref={remoteVideoElement}
            autoPlay
            playsInline
            // Only set the show flag once the video is playing to avoid a blank/black frame
            onPlaying={() => setShowRemoteVideo(true)}
          />
        </VideoContainer>
        <VideoContainer animate={localVideoControls}>
          <ChatVideo
            ref={localVideoElement}
            autoPlay
            playsInline
            muted
            style={{
              transform: `scaleX(-1)`,
            }}
          />
        </VideoContainer>
        <Box grow />

        {/* <Stack row centerContent>
          {!readyToChatButtonDisabled && (
            <Button id="readyToChatButton" onClick={onClickReadyToChat} disabled={readyToChatButtonDisabled}>
              Ready to Chat
            </Button>
          )}
          {!leaveChatButtonDisabled && (
            <Button id="leaveChatButton" onClick={onClickLeaveChat} disabled={leaveChatButtonDisabled}>
              Leave Chat
            </Button>
          )}
        </Stack> */}
        <Stack row justifyContent="end" shrink padding>
          <Button icon={isMicrophoneOn ? <MicIcon /> : <MicOffIcon />} onClick={toggleMicrophone} />
        </Stack>
      </MainContainer>
    </Panel>
  );
};
