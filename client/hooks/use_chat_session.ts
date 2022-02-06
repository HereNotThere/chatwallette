import { useCallback, useEffect, useRef, useState } from "react";
import { isWebRTCNegotiationEvent, SignalingEvent } from "../../protocol/signaling_types";
import { useStore } from "../store/store";
import { ConnectionStatus } from "./use_local_video_controls";
import { useWhyDidYouUpdate } from "./use_why_did_you_update";
import { base64ToArrayBuffer } from "../utils/base64";
import { event } from "../utils/google_analytics";
import { logger } from "../utils/logger";

function publishLocalStream(localStream: MediaStream, newConnection: RTCPeerConnection) {
  try {
    const localSender = localStream.getTracks().map(track => newConnection.addTrack(track, localStream));
    logger.info(`created localSender ${JSON.stringify(localSender)}`, localSender);
    return localSender;
  } catch (err) {
    if (err instanceof DOMException) {
      logger.warn(
        `chatSession peerConnection.addTrack(track, localStream) name: ${err.name} ${
          newConnection.connectionState
        } ${JSON.stringify(newConnection.getTransceivers())} ${err.stack} `,
      );
    } else {
      logger.warn(`chatSession peerConnection.addTrack(track, localStream) unknown error ${err}`, err);
    }
    return [];
  }
}

export type SignalinRTCEvent = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
export type SignalinRTCEventListener = (event: SignalinRTCEvent) => Promise<void>;

export type ChatMessage = {
  timestamp: number;
  screenName: string;
  message: string;
};

export type ChatSession = ReturnType<typeof useChatSession>;

let peerConnectionCounter = 0;

export const useChatSession = ({
  sendIceSignallingRequest,
  addEventListener,
  removeEventListener,
  sessionChatId,
  otherUser,
  participants,
  localStream,
  onLeaveChat,
  secretKey,
}: {
  sendIceSignallingRequest: (
    walletAddress: string,
    chatId: string,
    description: RTCSessionDescription | null,
    candidate: RTCIceCandidate | null,
  ) => Promise<void>;
  addEventListener: (listener: (event: SignalingEvent) => Promise<void>) => void;
  removeEventListener: (listener: (event: SignalingEvent) => Promise<void>) => void;
  sessionChatId: string | undefined;
  otherUser: string | undefined;
  participants: string[] | undefined;
  localStream?: MediaStream;
  onLeaveChat: (status: ConnectionStatus) => void;
  secretKey: CryptoKey | undefined;
}) => {
  const priorChatId = useRef<string>();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.Waiting);
  const priorConnectionStatus = useRef(connectionStatus);

  // List of messages. Both sent and received
  const [messages, setMessages] = useState<ChatMessage[] | undefined>();
  const [remoteStream, setRemoteStream] = useState<MediaStream>();
  const [chatChannel, setChatChannel] = useState<RTCDataChannel>();
  const { walletAddress, iceServers } = useStore();
  const peerConnection = useRef<RTCPeerConnection>();

  // If a chatChannel isn't established in 10 seconds set this chat session as failed
  useEffect(() => {
    if (sessionChatId && !chatChannel) {
      const timeout = setTimeout(() => {
        logger.warn(`chatFailedToConnect`);
        event({
          eventName: "chatFailedToConnect",
          eventParams: { event_label: "Chat timed out in connecting" },
        });
        logger.warn(`ConnectionStatus.Failed in useChatSession useEffect`, { sessionChatId, chatChannel });
        setConnectionStatus(ConnectionStatus.Failed);
      }, 20 * 1000);
      return () => clearTimeout(timeout);
    }
  }, [sessionChatId, chatChannel]);

  const closeCurrentChat = useCallback(() => {
    event({
      eventName: "closeCurrentChat",
      eventParams: { event_label: "User clicked close chat", chat_channel: Boolean(chatChannel) },
    });
    if (chatChannel) {
      chatChannel.close();
      setChatChannel(undefined);
      setConnectionStatus(ConnectionStatus.Disconnected);
    } else {
      logger.warn(`closeCurrentChat no chatChannel`);
      // If the user clicks close before a chatChannel is established, still close the chat
      setConnectionStatus(ConnectionStatus.Disconnected);
    }
  }, [chatChannel]);

  useEffect(() => {
    if (connectionStatus !== priorConnectionStatus.current) {
      logger.info(`connectionStatusChanged`, connectionStatus, priorConnectionStatus.current);
      if (connectionStatus === ConnectionStatus.Disconnected) {
        onLeaveChat(ConnectionStatus.Disconnected);
      } else if (connectionStatus === ConnectionStatus.Failed) {
        logger.warn(`ConnectionStatus.Failed in useChatSession connectionStateChanged onLeaveChat`);
        onLeaveChat(ConnectionStatus.Failed);
      }
      priorConnectionStatus.current = connectionStatus;
    }
  }, [connectionStatus, onLeaveChat]);
  // The channel we are using to communicate

  useEffect(() => {
    if (
      localStream &&
      sessionChatId &&
      priorChatId.current !== sessionChatId &&
      otherUser &&
      participants &&
      participants.length === 2 &&
      peerConnection.current === undefined &&
      secretKey &&
      iceServers
    ) {
      logger.info(`setting up new peerConnection ${JSON.stringify(iceServers)}`);
      const polite = participants[0] === walletAddress;
      const otherWalletAddress = participants[0] === walletAddress ? participants[1] : participants[0];
      const chatId = sessionChatId;

      const peerConnectionId = peerConnectionCounter++;

      const urlParams = new URLSearchParams(window.location.search);
      const privacyEnabled = urlParams.get("privacy") !== null;

      const newConnection = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: privacyEnabled ? "relay" : undefined,
      });

      const createChatChannel = (newConnection: RTCPeerConnection) => {
        try {
          const newChatChannel = newConnection.createDataChannel("chat", { negotiated: true, id: 0 });
          newChatChannel.onopen = () => {
            logger.info(`chatChannel opened ${newChatChannel.id}`);
            // Save the channel
            setChatChannel(newChatChannel);
          };
          // Listen for channel close events
          newChatChannel.onclose = () => {
            logger.info(`chatChannel onclose closed ${newChatChannel.id}`);
            setChatChannel(undefined);
            setConnectionStatus(ConnectionStatus.Disconnected);
          };
          // Append any received messages to the list
          newChatChannel.onmessage = ({ data }) =>
            setMessages(prevMessages => (prevMessages ? [...prevMessages, JSON.parse(data)] : [JSON.parse(data)]));

          newChatChannel.onerror = errorEvent => {
            // Chrome sends a failure event after the close event
            if (errorEvent.type === "error" && (errorEvent as any).error?.message === "Transport channel closed") {
              setChatChannel(undefined);
              setConnectionStatus(ConnectionStatus.Disconnected);
            } else {
              logger.warn(`chatChannel error ${newChatChannel.id} ${errorEvent.type}`, errorEvent);
              setChatChannel(undefined);
              logger.warn(`ConnectionStatus.Failed in useChatSession onerror`);
              setConnectionStatus(ConnectionStatus.Failed);
            }
          };
          return newChatChannel;
        } catch (err) {
          if (err instanceof DOMException) {
            logger.warn(
              `chatSession createDataChannel name: ${err.name} ${newConnection.connectionState} ${err.stack} `,
              err,
            );
          } else {
            logger.warn(`chatSession createDataChannel unknown error ${err}`, err);
          }
        }
      };
      /*
      newConnection.onsignalingstatechange = () => {
        logger.info(`onsignalingstatechange ${peerConnectionId} signalingState: ${newConnection.signalingState}`);
      };
      */

      // This only fires on Chrome, using oniceconnectionstatechange instead
      /*
      newConnection.onconnectionstatechange = () => {
        logger.info(
          `onconnectionstatechange ${peerConnectionId} connectionState: ${newConnection.connectionState}`,
        );
      };
      */

      newConnection.onicegatheringstatechange = () => {
        logger.info(
          `onicegatheringstatechange ${peerConnectionId} iceGatheringState: ${newConnection.iceGatheringState}`,
        );
      };

      // send any ice candidates to the other peer
      newConnection.onicecandidate = async ev => {
        const { candidate } = ev;
        if (candidate) {
          logger.info(`onicecandidate sending ice candidate`, peerConnectionId, candidate);
          await sendIceSignallingRequest(otherWalletAddress, chatId, null, candidate);
        }
      };

      newConnection.oniceconnectionstatechange = () => {
        logger.info(
          `oniceconnectionstatechange ${peerConnectionId} iceConnectionState ${newConnection.iceConnectionState}`,
        );
        switch (newConnection.iceConnectionState) {
          case "checking":
            setConnectionStatus(ConnectionStatus.Connecting);
            break;
          case "connected":
            setConnectionStatus(ConnectionStatus.Connected);
            break;
          case "disconnected":
            setConnectionStatus(ConnectionStatus.Disconnected);
            break;
          case "failed":
            setConnectionStatus(ConnectionStatus.Failed);
            logger.warn(`ConnectionStatus.Failed in oniceconnectionstatechange`);
            // logger.warn(`oniceconnectionstatechange restarting ice`, peerConnectionId);
            // newConnection.restartIce();
            break;
          default:
            logger.info(`ignoring case ${newConnection.iceConnectionState}`);
        }
      };
      // keep track of some negotiation state to prevent races and errors
      // Following the example here https://www.w3.org/TR/webrtc/#perfect-negotiation-example
      let makingOffer = false;
      let ignoreOffer = false;
      let isSettingRemoteAnswerPending = false;

      // let the "negotiationneeded" event trigger offer generation
      newConnection.onnegotiationneeded = async () => {
        const connectionState = newConnection.connectionState;
        logger.info(`onnegotiationneeded`, peerConnectionId, connectionState);
        try {
          // If the chat had moved on, stop sending offers for this old connection
          if (peerConnection.current === newConnection) {
            makingOffer = true;
            await newConnection.setLocalDescription();
            const localDescription = newConnection.localDescription;
            await sendIceSignallingRequest(otherWalletAddress, chatId, localDescription, null);
          } else {
            logger.info(
              `onnegotiationneeded ignoring negotiation start after close`,
              peerConnectionId,
              connectionState,
            );
          }
        } catch (err) {
          logger.error(`onnegotiationneeded error`, peerConnectionId, err);
        } finally {
          makingOffer = false;
        }
      };

      const chatChannel = createChatChannel(newConnection);
      const localTracks = publishLocalStream(localStream, newConnection);
      localTracks.forEach(track => {
        logger.info(
          `published track ${track.track?.id} for  ${track.track?.label} from localMediaStream`,
          peerConnectionId,
        );
      });

      // Start listening the signaling server for any new WebRTCNegotiation messages
      const listener = async (signalingEvent: SignalingEvent) => {
        try {
          if (isWebRTCNegotiationEvent(signalingEvent)) {
            const { encodedIceNegotiation, encodedIv } = signalingEvent;
            const dec = new TextDecoder();
            const decodedIceNegotitaion = base64ToArrayBuffer(encodedIceNegotiation);
            const iv = base64ToArrayBuffer(encodedIv);

            const decryptedIceNegotiation: ArrayBuffer = await window.crypto.subtle.decrypt(
              {
                name: "AES-GCM",
                iv,
              },
              secretKey,
              decodedIceNegotitaion,
            );

            const decodedDecryptedIceNegotiation = dec.decode(decryptedIceNegotiation);
            const {
              description,
              candidate,
              chatId: targetChatId,
            }: {
              description: RTCSessionDescription | null;
              candidate: RTCIceCandidate | null;
              chatId: string;
              notificationCounter: number;
            } = JSON.parse(decodedDecryptedIceNegotiation);

            if (chatId === targetChatId) {
              if (description) {
                // An offer may come in while we are busy processing SRD(answer).
                // In this case, we will be in "stable" by the time the offer is processed
                // so it is safe to chain it on our Operations Chain now.
                const readyForOffer =
                  !makingOffer && (newConnection.signalingState == "stable" || isSettingRemoteAnswerPending);
                const offerCollision = description.type == "offer" && !readyForOffer;

                ignoreOffer = !polite && offerCollision;
                if (ignoreOffer) {
                  return;
                }
                isSettingRemoteAnswerPending = description.type == "answer";

                logger.info(
                  `chatSession listener calling setRemoteDescription`,
                  peerConnectionId,
                  isSettingRemoteAnswerPending,
                  description,
                  newConnection,
                );
                await newConnection.setRemoteDescription(description); // SRD rolls back as needed
                logger.info(
                  `chatSession listener setRemoteDescription after`,
                  peerConnectionId,
                  description,
                  newConnection.remoteDescription,
                );
                isSettingRemoteAnswerPending = false;
                if (description.type === "offer") {
                  logger.info(
                    `chatSession listener calling newConnection.setLocalDescription`,
                    peerConnectionId,
                    description,
                  );
                  await newConnection.setLocalDescription();
                  const localDescription = newConnection.localDescription;
                  logger.info(
                    `chatSession listener sending localDescription in response to offer`,
                    peerConnectionId,
                    localDescription,
                  );
                  await sendIceSignallingRequest(otherWalletAddress, chatId, newConnection.localDescription, null);
                }
              } else if (candidate) {
                try {
                  logger.info(`chatSession listener adding candidate from remote`, peerConnectionId, candidate);
                  await newConnection.addIceCandidate(candidate);
                } catch (err) {
                  // Suppress ignored offer's candidates
                  if (!ignoreOffer) {
                    if (err instanceof DOMException) {
                      logger.warn(
                        `chatSession listener addIceCandidate failed ${err.stack}`,
                        err,
                        candidate,
                        newConnection,
                      );
                    } else {
                      logger.warn(`chatSession listener addIceCandidate failed ${err}`, err, candidate, newConnection);
                    }
                  }
                }
              }
            } else {
              logger.warn(`chatId doesn't match targetChatId ${JSON.stringify({ chatId, targetChatId })}`);
            }
          }
        } catch (err: any) {
          logger.error(`use_calling listener error ${err.message}`, err);
        } finally {
        }
      };

      const newRemoteStream = new MediaStream();
      logger.info(`create new remote mediaStream ${newRemoteStream.id}`);

      const trackListener = (event: RTCTrackEvent) => {
        event.track.onended = ev => logger.info(`trackListener ended`, peerConnectionId, event.track, ev);
        event.track.onmute = ev => logger.info(`trackListener mute`, peerConnectionId, event.track, ev);
        event.track.onunmute = () => {
          logger.info(
            `trackListener Add a track ${event.track.id} of kind ${event.track.kind} to stream ${newRemoteStream.id}`,
          );
          newRemoteStream.addTrack(event.track);
        };
      };
      newConnection.addEventListener("track", trackListener);

      addEventListener(listener);
      peerConnection.current = newConnection;
      setRemoteStream(newRemoteStream);
      setMessages(undefined);
      priorChatId.current = chatId;
      logger.info(`created peerConnection`);
      const startTime = Date.now();

      // Disconnect
      return () => {
        logger.info(`shutting down peerConnection`);
        chatChannel?.close();
        localTracks.forEach(track => {
          logger.info(`removing track ${track.track?.id} from newConnection`);
          newConnection.removeTrack(track);
        });
        newConnection.removeEventListener("track", trackListener);
        removeEventListener(listener);
        newRemoteStream.getTracks().forEach(track => {
          logger.info(`stopping remote track ${track.id}`);
          track.stop();
        });
        newConnection.close();
        peerConnection.current = undefined;
        setRemoteStream(undefined);
        setMessages(undefined);
        priorChatId.current = undefined;
        logger.info(`shut down peerConnection`);
        const duration = Date.now() - startTime;
        event({
          eventName: "timing_complete",
          eventParams: {
            name: "chat_session",
            value: duration,
          },
        });
      };
    }
  }, [
    sessionChatId,
    participants,
    otherUser,
    addEventListener,
    removeEventListener,
    sendIceSignallingRequest,
    localStream,
    onLeaveChat,
    secretKey,
    walletAddress,
    iceServers,
  ]);

  useWhyDidYouUpdate("useEffect peerConnection", {
    addEventListener,
    sessionChatId,
    localStream,
    onLeaveChat,
    participants,
    removeEventListener,
    secretKey,
    sendIceSignallingRequest,
    walletAddress,
    iceServers,
  });

  const sendChatMessage = useCallback(
    (message: ChatMessage) => {
      event({ eventName: "sendChatMessage", eventParams: { event_label: "User sent chat message" } });
      chatChannel?.send(JSON.stringify(message));
      setMessages(messages =>
        messages ? [...messages, { ...message, screenName: "You" }] : [{ ...message, screenName: "You" }],
      );
    },
    [chatChannel],
  );

  useWhyDidYouUpdate("chatSession", {
    messages,
    sendChatMessage,
    localStream,
    remoteStream,
    closeCurrentChat,
  });

  return {
    connectionStatus,
    messages,
    sendChatMessage,
    localStream,
    remoteStream,
    closeCurrentChat,
  };
};
