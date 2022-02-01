import stringify from "fast-json-stable-stringify";
import keccak256 from "keccak256";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthenticatingStatus, AuthRequestData } from "../../protocol/auth";
import { useStore } from "../store/store";
import { getIceServers, postAuthRequest } from "../utils/authRequest";
import { logger } from "../utils/logger";
import { useWeb3Context } from "./use_web3";

const signInMessage = (screenName: string, hash: string) =>
  `Hi ${screenName}, welcome to Chatwallette!

Click to sign in and accept the Chatwallette Terms of Service: https://chatwallette.xyz/tos

This request will not trigger a blockchain transaction or cost any gas fees.

Your authentication status will reset after 24 hours.

Hash: ${hash}`;

export const useWeb3Auth = () => {
  // If the user is in the handleLoginClick flow for 45 seconds, abort and let them try again
  // If handleLoginClick is still running when useWeb3Auth unmounts, abort it
  const timer = useRef<NodeJS.Timeout | undefined>();
  const [abort, setAbort] = useState<AbortController>();
  useEffect(
    () => () => {
      abort?.abort();
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [abort],
  );

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const {
    keypair,
    authData,
    setIsAuthenticated,
    setWalletAddress,
    setIceServers,
    authenticatingStatus,
    setAuthenticatingStatus,
    setScreenName,
  } = useStore();

  const { accounts, chainId, sign } = useWeb3Context();

  useEffect(() => {
    if (timer.current) {
      logger.warn(`Prior timer should have already been cleared`);
      clearTimeout(timer.current);
      timer.current = undefined;
    }

    timer.current = setTimeout(async () => {
      if (abort) {
        abort.abort();
      } else {
        logger.warn(`handleLoginClick timed out but there was nothing to abort`);
      }
    }, 45000);
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = undefined;
      }
    };
  }, [abort]);

  const walletAddress = useMemo(() => (accounts && accounts.length > 0 ? accounts[0] : undefined), [accounts]);

  const setUnauthenticated = useCallback(() => {
    setAuthenticatingStatus(AuthenticatingStatus.Unauthenticated);
    setIsAuthenticated(false);
  }, [setAuthenticatingStatus, setIsAuthenticated]);

  const handleLoginClick = useCallback(
    async (screenName: string) => {
      logger.info(`handleLoginClick start`, { walletAddress, chainId, authData });

      if (walletAddress && chainId && keypair && authData) {
        const localAbort = new AbortController();
        setAbort(localAbort);
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
          if (localAbort.signal.aborted) {
            throw Error(`handleLoginClick aborted at sign`);
          }

          logger.info(`handleLoginClick after signInMessage`, { message, signature, authRequestData });

          if (signature) {
            try {
              const status = await postAuthRequest({ message, signature, authRequestData }, localAbort.signal);
              if (localAbort.signal.aborted) {
                throw Error(`handleLoginClick aborted at postAuthRequest`);
              }

              switch (status) {
                case 200: {
                  const iceServers = await getIceServers(localAbort.signal);
                  if (localAbort.signal.aborted) {
                    throw Error(`handleLoginClick aborted at getIceServers`);
                  }
                  logger.info(`got iceServers ${JSON.stringify(iceServers)}`, iceServers);
                  if (iceServers) {
                    setIceServers(iceServers);
                  }
                  setAuthenticatingStatus(AuthenticatingStatus.Authenticated);
                  setIsAuthenticated(true);
                  setWalletAddress(walletAddress);
                  setScreenName(screenName);
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
        } finally {
          if (timer.current) {
            clearTimeout(timer.current);
            timer.current = undefined;
          }
          setAbort(undefined);
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
      setScreenName,
      setUnauthenticated,
      setWalletAddress,
      sign,
      walletAddress,
    ],
  );

  return { authenticatingStatus, handleLoginClick };
};
