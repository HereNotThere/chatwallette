import stringify from "fast-json-stable-stringify";
import keccak256 from "keccak256";
import { useCallback, useEffect, useMemo } from "react";
import { AuthRequestData } from "../../protocol/auth";
import { useStore } from "../store/store";
import { deleteAuth, getIceServers, postAuthRequest } from "../utils/authRequest";
import { usePrevious } from "./use_previous";
import { logger } from "../utils/logger";
import { useWeb3Context } from "./use_web3";

const signInMessage = (screenName: string, hash: string) =>
  `Hi ${screenName}, welcome to Chatwallette!

Click to sign in and accept the Chatwallette Terms of Service: https://chatwallette.xyz/tos

This request will not trigger a blockchain transaction or cost any gas fees.

Your authentication status will reset after 24 hours.

Hash: ${hash}`;

export enum AuthenticatingStatus {
  Unauthenticated = "Unauthenticated",
  SigningMessage = "SigningMessage",
  Authenticated = "Authenticated",
}

let timer: NodeJS.Timeout | undefined;

function stopLoginTimer(): void {
  if (timer) {
    clearTimeout(timer);
  }
  timer = undefined;
}

function useLoginTimer() {
  const { authenticatingStatus, setIsAuthenticated, setAuthenticatingStatus } = useStore();
  const prevAuthStatus = usePrevious<AuthenticatingStatus>(authenticatingStatus);

  const startLoginTimer = useCallback(() => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(async () => {
      await deleteAuth();
      setAuthenticatingStatus(AuthenticatingStatus.Unauthenticated);
      setIsAuthenticated(false);
      logger.error(`Login timed out. Deleted and reset auth states`);
    }, 45000);
  }, [setAuthenticatingStatus, setIsAuthenticated]);

  useEffect(() => {
    if (prevAuthStatus !== authenticatingStatus) {
      switch (authenticatingStatus) {
        case AuthenticatingStatus.SigningMessage:
          startLoginTimer();
          break;
        default:
          stopLoginTimer();
          break;
      }
    }
  }, [authenticatingStatus, prevAuthStatus, startLoginTimer]);

  useEffect(() => {
    return () => {
      stopLoginTimer();
    };
  }, []);
}

export const useWeb3Auth = () => {
  const {
    keypair,
    authData,
    setIsAuthenticated,
    setWalletAddress,
    setIceServers,
    authenticatingStatus,
    setAuthenticatingStatus,
  } = useStore();

  const { accounts, chainId, sign } = useWeb3Context();

  useLoginTimer();

  const walletAddress = useMemo(() => (accounts && accounts.length > 0 ? accounts[0] : undefined), [accounts]);

  const setUnauthenticated = useCallback(() => {
    setAuthenticatingStatus(AuthenticatingStatus.Unauthenticated);
    setIsAuthenticated(false);
  }, [setAuthenticatingStatus, setIsAuthenticated]);

  const handleLoginClick = useCallback(
    async (screenName: string) => {
      logger.info(`handleLoginClick start`, { walletAddress, chainId, authData });

      if (walletAddress && chainId && keypair && authData) {
        try {
          logger.info(`handleLoginClick SigningMessage`);
          setAuthenticatingStatus(AuthenticatingStatus.SigningMessage);

          const { publicKey } = JSON.parse(keypair);
          const authRequestData: AuthRequestData = {
            walletAddress,
            chainId,
            sessionId: authData.sessionId,
            nonce: authData.nonce,
            publicKey: JSON.stringify(publicKey),
            screenName,
          };

          const hash = keccak256(stringify(authRequestData)).toString("base64");

          const message = signInMessage(screenName, hash);
          const signature = await sign(message, walletAddress);

          logger.info(`handleLoginClick after signInMessage`, { message, signature, authRequestData });

          if (signature) {
            try {
              const status = await postAuthRequest({ message, signature, authRequestData });
              switch (status) {
                case 200: {
                  const iceServers = await getIceServers();
                  logger.info(`got iceServers ${JSON.stringify(iceServers)}`, iceServers);
                  if (iceServers) {
                    setIceServers(iceServers);
                  }
                  setAuthenticatingStatus(AuthenticatingStatus.Authenticated);
                  setIsAuthenticated(true);
                  setWalletAddress(walletAddress);
                  break;
                }
                case 401: {
                  setUnauthenticated();
                  break;
                }
                default: {
                  // Don't handle unknown status.
                  logger.error(`/auth POST returned a status that is not handled on the client, status: ${status}`);
                  break;
                }
              }
            } catch (ex) {
              setUnauthenticated();
              logger.error(`Failed to send data: ${signature}`, ex);
            }
          } else {
            setUnauthenticated();
          }
        } catch (err) {
          setUnauthenticated();
          logger.error(`error signing in`, err);
        }
      } else {
        logger.warn(`handleLoginClick ${JSON.stringify({ walletAddress, chainId, keypair, authData })}`);
      }
    },
    [
      authData,
      chainId,
      keypair,
      setAuthenticatingStatus,
      setIceServers,
      setIsAuthenticated,
      setUnauthenticated,
      setWalletAddress,
      sign,
      walletAddress,
    ],
  );

  return { authenticatingStatus, handleLoginClick };
};
