import stringify from "fast-json-stable-stringify";
import keccak256 from "keccak256";
import { NextPage } from "next";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBeforeunload } from "react-beforeunload";
import styled from "styled-components";
import {
  MatchCriteria,
  SignalingEvent,
  SignalingEventType,
  SignalingRequestType,
} from "../../protocol/signaling_types";
import { ERC20Result, NFTResult } from "../../protocol/tokens";
import { Box } from "../components/Box";
import { Button } from "../components/Button";
import { ChatPanel } from "../components/ChatPanel/ChatPanel";
import { Draggable } from "../components/Draggable/Draggable";
import { ExitIcon } from "../components/Icons";
import { Stack } from "../components/Stack";
import { TerminalLog } from "../components/Terminal/hooks/useTerminal";
import { RandomPrompt } from "../components/Terminal/RandomPrompt";
import { Terminal } from "../components/Terminal/Terminal";
import { SpanText } from "../components/Text/Text";
import { LocalMediaState, VideoPanel } from "../components/VideoPanel/VideoPanel";
import { useChatSession } from "../hooks/use_chat_session";
import { ConnectionStatus } from "../hooks/use_local_video_controls";
import { useMediaDevices } from "../hooks/use_media_devices";
import { EventSourceState, useSignaling } from "../hooks/use_signaling";
import { useWeb3Context } from "../hooks/use_web3";
import { useWhyDidYouUpdate } from "../hooks/use_why_did_you_update";
import { useStore } from "../store/store";
import { deleteAuth } from "../utils/authRequest";
import { arrayBufferToBase64 } from "../utils/base64";
import { isBrave } from "../utils/brave";
import { NoSSR } from "./_app";
import ConnectedSound from "../assets/ir10.wav";
import DisconnectedSound from "../assets/ir5.wav";
import { abbrevWalletAddress } from "../components/User/DisplayName";
import { logger } from "../utils/logger";
import { NFTToken } from "../components/Tokens/NFTToken";
import { Panel } from "../components/Panel";

const StyledExitIcon = styled(ExitIcon)`
  transform: translateY(3px);
`;
const enum PoolState {
  Entering = "Entering",
  InPool = "InPool",
  Exiting = "Exiting",
  OnSideline = "OnSideline",
}

const LocalMediaConstraints = {
  video: {
    width: { ideal: 480 },
    height: { ideal: 480 },
    frameRate: { ideal: 30 },
  },
  audio: true,
};

const MAX_EXCLUDE_LIST_LENGTH = 10;
let instanceCounter = 0;

function deriveSecretKey(privateKey: CryptoKey, publicKey: CryptoKey) {
  return window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

// Audio is not defined on the server.
// Put sound definitions behind isBrowser, which will only
// be rendered on client side.
const isBrowser = typeof window !== "undefined";
const connectedSound = isBrowser ? new Audio(ConnectedSound) : undefined;
const disconnectedSound = isBrowser ? new Audio(DisconnectedSound) : undefined;

const ChatPage: NextPage = () => {
  const [participants, setParticipants] = useState<string[]>();
  const [otherUser, setOtherUser] = useState<string>();
  const [otherERC20, setOtherERC20] = useState<ERC20Result[]>([]);
  const [otherNFT, setOtherNFT] = useState<NFTResult[]>([]);
  const [matchedNFT, setMatchedNFT] = useState<NFTResult[]>([]);
  const [otherWalletENS, setOtherWalletENS] = useState<string>();
  const [otherWalletAddress, setOtherWalletAddress] = useState<string>();

  const [poolState, setPoolState] = useState<PoolState>(PoolState.OnSideline);
  const { sendRequest, addEventListener, removeEventListener, eventSourceState } = useSignaling();
  const { ecRecover } = useWeb3Context();
  const [excludeList, setExcludeList] = useState<string[]>([]);
  const [matchTokens, setMatchTokens] = useState<boolean>(true);

  const [privateKey, setPrivateKey] = useState<CryptoKey>();
  const [secretKey, setSecretKey] = useState<CryptoKey>();

  const [terminalLog, setTerminalLog] = useState<TerminalLog>([]);

  const { chainId } = useWeb3Context();
  const chainName = useMemo(() => (chainId === "0x1" ? "Ethereum Mainnet" : chainId), [chainId]);

  const { setIsAuthenticated, walletAddress, keypair, setSelfERC20, selfNFT, setSelfNFT, setWalletENS } = useStore();

  const sendIceSignallingRequest = useCallback(
    async (
      walletAddress: string,
      chatId: string,
      description: RTCSessionDescription | null,
      candidate: RTCIceCandidate | null,
    ) => {
      if (secretKey && chatId) {
        const enc = new TextEncoder();

        const iv = window.crypto.getRandomValues(new Uint8Array(16));

        const encodedEvent = enc.encode(JSON.stringify({ chatId, description, candidate }));
        try {
          const encryptedEvent: ArrayBuffer = await window.crypto.subtle.encrypt(
            {
              name: "AES-GCM",
              iv,
            },
            secretKey,
            encodedEvent,
          );
          const encodedIceNegotiation = arrayBufferToBase64(encryptedEvent);
          const encodedIv = arrayBufferToBase64(iv);
          const success = await sendRequest({
            type: SignalingRequestType.WebRTCNegotiation,
            walletAddress,
            encodedIv,
            encodedIceNegotiation,
          });
          if (!success) {
            logger.warn(`Failed to send WebRTCNegotiation request`);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          logger.info(`error encrypting ${err.message}`, err);
        }
      } else {
        logger.warn(`trying sendIceSignallingRequest without a secretKey or chatId ${chatId}`);
      }
    },
    [secretKey, sendRequest],
  );

  useWhyDidYouUpdate("sendIceSignallingRequest", {
    secretKey,
    sendRequest,
  });

  useEffect(() => {
    if (keypair) {
      void (async () => {
        const { privateKey }: { publicKey: JsonWebKey; privateKey: JsonWebKey } = JSON.parse(keypair);

        const importedPrivateKey = await window.crypto.subtle.importKey(
          "jwk",
          privateKey,
          {
            name: "ECDH",
            namedCurve: "P-384",
          },
          true,
          ["deriveKey"],
        );
        setPrivateKey(importedPrivateKey);
      })();
    } else {
      setPrivateKey(undefined);
    }
  }, [keypair]);
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [localMediaState, setLocalMediaState] = useState<LocalMediaState>(LocalMediaState.Pending);

  const onLeaveChat = useCallback(
    (status: ConnectionStatus) => {
      // reset to starting states.
      setMatchTokens(true);
      setChatId(undefined);

      if (status === ConnectionStatus.Disconnected) {
        setTerminalLog(log =>
          log.concat(
            <SpanText>
              <StyledExitIcon /> <strong>{otherUser}</strong> left the chat with you
            </SpanText>,
          ),
        );
      }
      if (status === ConnectionStatus.Failed) {
        setTerminalLog(log =>
          log.concat(
            <SpanText>
              Chat failed connecting to chat with <strong>{otherUser}</strong>
            </SpanText>,
          ),
        );
      }
      if (participants) {
        setParticipants(undefined);
        setOtherUser(undefined);
        setOtherERC20([]);
        setOtherNFT([]);
        setMatchedNFT([]);
        setOtherWalletAddress(undefined);
        setOtherWalletENS(undefined);
      }
    },
    [otherUser, participants],
  );

  useWhyDidYouUpdate("onLeaveChat", {
    otherUser,
    participants,
  });

  const [chatId, setChatId] = useState<string | undefined>();

  const chatSession = useChatSession({
    sendIceSignallingRequest,
    addEventListener,
    removeEventListener,
    sessionChatId: chatId,
    otherUser,
    participants,
    localStream,
    onLeaveChat,
    secretKey,
  });

  useEffect(() => {
    switch (chatSession.connectionStatus) {
      case ConnectionStatus.Connected:
        void (async () => {
          await connectedSound?.play();
        })();
        break;
      case ConnectionStatus.Disconnected:
        void (async () => {
          await disconnectedSound?.play();
        })();
        break;
      default:
        // No sound
        break;
    }
  }, [chatSession.connectionStatus]);

  const { devices } = useMediaDevices();
  useEffect(() => logger.info(`devicesLength: ${devices.length}`), [devices]);

  useEffect(() => {
    logger.info(`Chat.tsx ctor`);
    return () => logger.info(`Chat.tsx dtor`);
  }, []);

  useEffect(() => {
    const instance = instanceCounter++;
    logger.info(`ChatPanel media ${instance} starting`);
    let shutdown = false;
    let localStream: MediaStream | undefined = undefined;
    void (async () => {
      try {
        setLocalMediaState(LocalMediaState.Requested);
        const start = Date.now();
        logger.info(`ChatPanel media ${instance} requesting`);

        localStream = await navigator.mediaDevices.getUserMedia(LocalMediaConstraints);
        const finished = Date.now();

        logger.info(`ChatPanel media ${instance} useEffect opened ${finished - start} shutdown: ${shutdown}`);
        if (!shutdown) {
          setLocalMediaState(LocalMediaState.Opened);
          setLocalStream(localStream);
        }
      } catch (err) {
        if (!shutdown) {
          if (err instanceof DOMException) {
            if (err.name === "NotAllowedError") {
              setLocalMediaState(LocalMediaState.NotAllowed);
            } else {
              logger.warn(`ChatPanel media ${instance} useEffect failed to getUserMedia ${err.name}`, err);
              setLocalMediaState(LocalMediaState.OtherError);
            }
          } else {
            logger.warn(
              `ChatPanel media ${instance} useEffect failed to getUserMedia with unexpected error ${err}`,
              err,
            );
            setLocalMediaState(LocalMediaState.OtherError);
          }
        } else {
          logger.warn(
            `ChatPanel media ${instance} useEffect failed after shutdown to getUserMedia with unexpected error ${err}`,
            err,
          );
        }
      }
    })();
    return () => {
      // chat shutdown, let the async getUserMedia call know once it returns
      shutdown = true;
      logger.info(`ChatPanel media ${instance} useEffect shutting down`);
      const tempLocalStream = localStream;
      if (tempLocalStream) {
        tempLocalStream.getTracks().forEach(track => {
          track.stop();
          tempLocalStream.removeTrack(track);
        });
      }
      logger.info(`ChatPanel media ${instance} useEffect shutdown`, tempLocalStream);
    };
  }, []);

  const [cameraMessage, setCameraMessage] = useState(false);
  // If in the Requested state for 5 seconds, add this to the terminal log
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (localMediaState === LocalMediaState.Requested || localMediaState === LocalMediaState.NotAllowed) {
      timeout = setTimeout(() => {
        logger.info(`localMediaState ${localMediaState}`);
        setCameraMessage(true);
      }, 5000);
    }
    return () => {
      clearTimeout(timeout);
    };
  }, [localMediaState]);

  useEffect(() => {
    if (cameraMessage) {
      setTerminalLog(log =>
        log.concat(<SpanText textColor="Pink">⚠️ Enable camera and microphone to continue</SpanText>),
      );
    }
  }, [cameraMessage]);

  const enterPool = useCallback(
    async (matchTokens: boolean, excludeList: string[]) => {
      logger.info(`enterPool`);
      setPoolState(PoolState.Entering);
      const success = await sendRequest({
        type: SignalingRequestType.EnterPool,
        excludeList,
        matchTokens,
      });
      if (success) {
        // If this races with the JoinChat event we want that result (OnSidline) to stay
        setPoolState(state => (state === PoolState.Entering ? PoolState.InPool : state));
      } else {
        setPoolState(PoolState.OnSideline);
      }
    },
    [sendRequest],
  );

  useWhyDidYouUpdate("useEffect enterPool", {
    participants,
    enterPool,
    eventSourceState,
    poolState,
    matchTokens,
  });

  useEffect(() => {
    if (
      localStream &&
      poolState === PoolState.OnSideline &&
      !participants &&
      eventSourceState === EventSourceState.Connected
    ) {
      // Ignore promise that resolves when enterPool completes
      logger.info(`entering the pool with matchTokens: ${matchTokens}`);
      void (async () => {
        await enterPool(matchTokens, excludeList);
      })();
    }
  }, [localStream, participants, enterPool, eventSourceState, poolState, matchTokens, excludeList]);

  // Should not be called by client directly.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const leavePool = useCallback(async () => {
    logger.info(`leavePool ${poolState}`);
    if (poolState === PoolState.InPool) {
      setPoolState(PoolState.Exiting);
      const success = await sendRequest({
        type: SignalingRequestType.LeavePool,
      });
      if (success) {
        setPoolState(PoolState.OnSideline);
      } else {
        setPoolState(PoolState.InPool);
      }
    }
  }, [poolState, sendRequest]);

  useEffect(() => {
    if (walletAddress) {
      const listener = async (signalingEvent: SignalingEvent) => {
        switch (signalingEvent.type) {
          case SignalingEventType.SelfTokensEvent:
            {
              setSelfERC20(signalingEvent.allERC20);
              setSelfNFT(signalingEvent.allNFT);
              setWalletENS(signalingEvent.walletENS);
            }
            break;
          case SignalingEventType.OtherParticipantTokensEvent:
            {
              if (signalingEvent.matchedNFTs.length) {
                // Show any matched tokens.
                const matchedOnly: NFTResult[] = [];
                for (const t of signalingEvent.allNFT) {
                  if (signalingEvent.matchedNFTs.includes(t.token_address)) {
                    matchedOnly.push(t);
                  }
                }
                setMatchedNFT(matchedOnly);
              } else {
                setMatchedNFT([]);
              }
              setOtherNFT(signalingEvent.allNFT);
              setOtherERC20(signalingEvent.allERC20);
              setOtherWalletENS(signalingEvent.walletENS);
              logger.info(`recevied OtherParticipantTokensEvent ${JSON.stringify(signalingEvent)}`);
            }
            break;
          case SignalingEventType.JoinChatEvent:
            {
              const cleanupState = () => {
                setSecretKey(undefined);
                setChatId(undefined);
                setParticipants(undefined);
                setOtherUser(undefined);
              };

              logger.info(`recevied JoinChatEvent ${JSON.stringify(signalingEvent)}`);
              const selfIndex = signalingEvent.participants.indexOf(walletAddress);
              const otherIndex = selfIndex === 0 ? 1 : 0;
              const otherWalletAddress = signalingEvent.participants[otherIndex];
              setOtherWalletAddress(otherWalletAddress);
              setExcludeList(oldList => [otherWalletAddress, ...oldList].slice(0, MAX_EXCLUDE_LIST_LENGTH));

              // Need the private key created and loaded before client can join a chat
              if (privateKey) {
                const { message, signature, authRequestData } = signalingEvent.authRequest[otherIndex];
                const publicKey: JsonWebKey = JSON.parse(authRequestData.publicKey);
                const otherScreenName = authRequestData.screenName;
                try {
                  const otherPublicKeyPromise = window.crypto.subtle.importKey(
                    "jwk",
                    publicKey,
                    {
                      name: "ECDH",
                      namedCurve: "P-384",
                    },
                    false,
                    [],
                  );

                  const [otherPublicKey, signingWalletAddress] = await Promise.all([
                    otherPublicKeyPromise,
                    ecRecover(message, signature),
                  ]);

                  const hash = keccak256(stringify(authRequestData)).toString("base64");
                  const hashFromMessage = message.split(`\n`).pop()?.match("Hash:\\s(\\S*)")?.pop();

                  logger.info(
                    `signature match ${JSON.stringify({
                      signingWalletAddress,
                      hashFromMessage,
                      hash,
                      walletAddress,
                      otherWalletAddress,
                      otherIndex,
                      selfIndex,
                      signalingEvent,
                    })}`,
                  );

                  // Brave prior to 1.35 doesn't support ecRecover so skipping signature verification on brave when
                  // signingWalletAddress not present
                  if (
                    hash === hashFromMessage &&
                    ((isBrave() && signingWalletAddress === undefined) ||
                      signingWalletAddress?.toLowerCase() === otherWalletAddress.toLowerCase())
                  ) {
                    const tempKey = await deriveSecretKey(privateKey, otherPublicKey);
                    logger.info(`JoinChatEvent deriveSecretKey`);
                    setSecretKey(tempKey);
                    setChatId(signalingEvent.chatId);
                    setParticipants(signalingEvent.participants);
                    setOtherUser(otherScreenName);
                  } else {
                    logger.warn(
                      `JoinChatEvent hash doesn't match ${JSON.stringify({
                        hash,
                        hashFromMessage,
                        signingWalletAddress,
                        otherWalletAddress,
                      })}`,
                    );
                    cleanupState();
                  }
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (err: any) {
                  logger.info(`JoinChatEvent failed ${err.message}`);
                  cleanupState();
                }
              } else {
                logger.info(`JoinChatEvent no privateKey`);
                cleanupState();
              }
            }
            break;
          case SignalingEventType.WalletNotProvided:
            {
              // Something is wrong with our auth cookie
              setIsAuthenticated(false);
            }
            break;
          default:
            break;
        }
      };
      addEventListener(listener);
      return () => removeEventListener(listener);
    }
  }, [
    addEventListener,
    ecRecover,
    privateKey,
    removeEventListener,
    setIsAuthenticated,
    setSelfERC20,
    setSelfNFT,
    setWalletENS,
    walletAddress,
  ]);

  useEffect(() => {
    // It's possible for the JoinChat event to arrive at the client before the EnterPool async fetch completes
    // and sets the InPool state so we consider Entering as well.
    setPoolState(state =>
      (state === PoolState.InPool || state === PoolState.Entering) && !participants ? PoolState.OnSideline : state,
    );
  }, [participants]);

  useEffect(() => {
    if (participants && otherUser) {
      setTerminalLog(log =>
        log.concat(
          <SpanText>
            You matched with <strong>{otherUser}</strong>
          </SpanText>,
        ),
      );
    }
  }, [otherUser, participants]);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const videoPanelRef = useRef<HTMLDivElement | null>(null);
  const chatPanelRef = useRef<HTMLDivElement | null>(null);
  const deleteAuthAbort = useRef<AbortController>();

  const onLogout = useCallback(async () => {
    if (!deleteAuthAbort.current) {
      logger.info(`onLogout`);
      const abort = new AbortController();
      deleteAuthAbort.current = abort;
      await deleteAuth(abort.signal);
      deleteAuthAbort.current = undefined;
      if (!abort.signal.aborted) {
        setIsAuthenticated(false);
      }
    } else {
      logger.warn(`onLogout called while waiting on deleteAuth, ignoring`);
    }
  }, [setIsAuthenticated]);

  // If deleteAuth is running during unmount, abort the request
  useEffect(() => () => deleteAuthAbort.current?.abort(), []);

  const [lastDraggedPanelIndex, setLastDraggedPanelIndex] = useState(0);
  const onStartDrag = useCallback((index: number) => {
    setLastDraggedPanelIndex(index);
  }, []);

  useBeforeunload(() => {
    onLeaveChat(ConnectionStatus.Disconnected);
  });

  const [enableRandomPrompt, setEnableRandomPrompt] = useState(false);

  useEffect(() => {
    if (participants) {
      setEnableRandomPrompt(false);
      return;
    }

    const timeout = setTimeout(() => {
      if (!participants) {
        setEnableRandomPrompt(true);
      }
    }, 10000);
    return () => {
      clearTimeout(timeout);
    };
  }, [participants]);

  const onNoSelected = useCallback(async () => {
    logger.info("onNoSelected");
    setEnableRandomPrompt(false);
    setMatchTokens(true);
    if (eventSourceState === EventSourceState.Connected) {
      const matchCriteria: MatchCriteria = {
        matchTokens: true,
        excludeList,
      };
      await sendRequest({
        type: SignalingRequestType.UpdateMatchCriteria,
        matchCriteria,
      });
    }
  }, [eventSourceState, excludeList, sendRequest]);

  const onYesSelected = useCallback(async () => {
    logger.info("onYesSelected");
    setEnableRandomPrompt(false);
    setMatchTokens(false);
    if (eventSourceState === EventSourceState.Connected) {
      const matchCriteria: MatchCriteria = {
        matchTokens: false,
        excludeList,
      };
      await sendRequest({
        type: SignalingRequestType.UpdateMatchCriteria,
        matchCriteria,
      });
    }
  }, [eventSourceState, excludeList, sendRequest]);

  useEffect(() => {
    if (!enableRandomPrompt) {
      return;
    }

    setTerminalLog(log => log.concat(<SpanText>No matches for your wallet found.</SpanText>));
    setTerminalLog(log =>
      log.concat(
        <>
          Want to chat with someone random?{" "}
          <RandomPrompt onNoSelected={onNoSelected} onYesSelected={onYesSelected}></RandomPrompt>
        </>,
      ),
    );
  }, [enableRandomPrompt, matchTokens, onNoSelected, onYesSelected]);

  const hasParticipants = participants && participants.length > 0;

  // TODO replace this popup with a better control to let you see all of your own NFT
  const [showAllNFT, setShowAllNFT] = useState(false);
  const onClickShowNft = useCallback(() => setShowAllNFT(flag => !flag), []);

  return (
    <NoSSR>
      <>
        <Box fullscreen ref={boxRef}>
          <Stack row spaceBetween padding overflowVisible>
            <Terminal
              terminalLog={terminalLog}
              showLookingForMatch={!hasParticipants && !enableRandomPrompt}
              matchTokens={matchTokens}
            />
            <Box>
              <Stack shrink>
                <Stack shrink row>
                  <Box className="body-text" border padding="xs" background="panel">
                    ChainID: {chainName}
                  </Box>
                  <Stack row itemSpace="no">
                    <Button className="body-text" border padding="xs" background="panel" onClick={onClickShowNft}>
                      {selfNFT.length} NFT{selfNFT.length === 1 ? "" : "s"}
                    </Button>
                    <Box className="body-text" border padding="xs" background="input">
                      <SpanText bold>{abbrevWalletAddress(walletAddress)}</SpanText>
                    </Box>
                  </Stack>
                  <Button
                    border={false}
                    background="input"
                    onClick={onLogout}
                    textColor="White"
                    icon={<ExitIcon className="logout" />}
                  />
                </Stack>
                {showAllNFT && (
                  <Panel padding="xs" onClose={onClickShowNft} panelTitle={"Your NFT"}>
                    <Box grow centerContent>
                      <div style={{ display: "inline-flex", flexWrap: "wrap" }}>
                        {selfNFT.map(nft => (
                          <div
                            key={`${nft.token_address}-${nft.token_id}`}
                            style={{ width: "20px", height: "20px", overflow: "hidden" }}
                          >
                            <NFTToken token={nft} />
                          </div>
                        ))}
                      </div>
                    </Box>
                  </Panel>
                )}
              </Stack>
            </Box>
          </Stack>
        </Box>
        <Box grow centerContent>
          {hasParticipants && (
            <Draggable
              ref={chatPanelRef}
              boxRef={boxRef}
              width="30vw"
              height="50vh"
              minWidth="400px"
              maxWidth="min(70vw, 1000px)"
              maxHeight="min(70vh, 1000px)"
              left="10vw"
              top="25vh"
              onStartDrag={onStartDrag}
              lastDraggedPanelIndex={lastDraggedPanelIndex}
            >
              <ChatPanel
                chatSession={chatSession}
                onClose={chatSession.closeCurrentChat}
                participants={participants}
                otherWalletAddress={otherWalletAddress}
                otherUsername={otherUser}
                otherWalletENS={otherWalletENS}
                otherERC20={otherERC20}
                otherNFT={otherNFT}
                matchedNFT={matchedNFT}
                chainId={chainId}
              />
            </Draggable>
          )}
          {localMediaState === LocalMediaState.Opened && localStream && (
            <Draggable
              ref={videoPanelRef}
              boxRef={boxRef}
              width="min(60vh,50vw)"
              minWidth="400px"
              maxWidth="1000px"
              left="50vw"
              top="10vw"
              onStartDrag={onStartDrag}
              lastDraggedPanelIndex={lastDraggedPanelIndex}
            >
              <VideoPanel localStream={localStream} remoteStream={chatSession.remoteStream} />
            </Draggable>
          )}
        </Box>
      </>
    </NoSSR>
  );
};

export default ChatPage;
