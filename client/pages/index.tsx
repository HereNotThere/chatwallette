import { Base64 } from "js-base64";
import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Box } from "../components/Box";
import { Button } from "../components/Button";
import { EmailIcon, GithubIcon, QuestionIcon, TwitterIcon } from "../components/Icons";
import { IntroModule } from "../components/IntroModule/IntroModule";
import { NFTBackground } from "../components/NFTBackground/NFTBackground";
import { Stack } from "../components/Stack";
import { SmallParagraph, SpanText } from "../components/Text/Text";
import { abbrevWalletAddress } from "../components/User/DisplayName";
import { useWeb3Context, WalletStatus } from "../hooks/use_web3";
import { useWhyDidYouUpdate } from "../hooks/use_why_did_you_update";
import { useStore } from "../store/store";
import { getAuthRequestWalletData } from "../utils/authRequest";
import { logger } from "../utils/logger";

const Home: NextPage = () => {
  const {
    authenticatingStatus,
    setWalletAddress,
    isAuthenticated,
    setIsAuthenticated,
    setKeypair,
    setAuthRequestWalletData,
    authData,
    keypair,
  } = useStore();

  useWhyDidYouUpdate("Home store", {
    authenticatingStatus,
    setWalletAddress,
    isAuthenticated,
    setIsAuthenticated,
    setKeypair,
    setAuthRequestWalletData,
    authData,
    keypair,
  });

  useEffect(() => {
    logger.info(
      `Home ctor ${JSON.stringify({
        authenticatingStatus,

        setWalletAddress,
        isAuthenticated,
        setIsAuthenticated,
        setKeypair,
        setAuthRequestWalletData,
        authData,
        keypair,
      })}`,
    );
    return () => {
      logger.info(
        `Home dtor ${JSON.stringify({
          setWalletAddress,
          isAuthenticated,
          setIsAuthenticated,
          setKeypair,
          setAuthRequestWalletData,
          authData,
          keypair,
        })}`,
      );
    };
  }, [
    authData,
    authenticatingStatus,
    isAuthenticated,
    keypair,
    setAuthRequestWalletData,
    setIsAuthenticated,
    setKeypair,
    setWalletAddress,
  ]);

  const { walletStatus, accounts, chainId } = useWeb3Context();
  const chainName = useMemo(() => (chainId === "0x1" ? "Ethereum Mainnet" : chainId), [chainId]);

  const fetchAuthData = useCallback(
    async (signal: AbortSignal) => {
      logger.info(`fetchAuthData`, signal.aborted);
      try {
        if (chainId && accounts && accounts.length > 0 && accounts[0]) {
          const nonceArray = new Uint8Array(16);
          self.crypto.getRandomValues(nonceArray);
          logger.info(`fetchAuthData finished  getRandomValues`, signal.aborted);

          // Since this is going in the URL query string it needs to be URL safe
          const nonce = Base64.fromUint8Array(nonceArray, true);
          const [authRequestWalletData, keypair] = await Promise.all([
            await getAuthRequestWalletData(chainId, accounts[0], nonce, signal),
            await window.crypto.subtle.generateKey(
              {
                name: "ECDH",
                namedCurve: "P-384",
              },
              true,
              ["deriveKey"],
            ),
          ]);
          logger.info(`fetchAuthData finished  authRequestWalletData/keypair`, signal.aborted);
          if (signal.aborted) {
            logger.warn(`fetchAuthData abandoned authRequestWalletData/keypair`, signal.aborted);
            return;
          }
          if (!authRequestWalletData) {
            logger.error(`fetchAuthData failed getting authRequestWalletData`);
            return;
          }
          const [exportedPrivateKey, exportedPublicKey] = await Promise.all([
            keypair.privateKey ? await crypto.subtle.exportKey("jwk", keypair.privateKey) : undefined,
            keypair.publicKey ? await crypto.subtle.exportKey("jwk", keypair.publicKey) : undefined,
          ]);
          logger.info(`fetchAuthData finished  exportedPrivateKey/exportedPublicKey`, signal.aborted);
          if (signal.aborted) {
            logger.warn(`fetchAuthData abandoned exportedPrivateKey/exportedPublicKey`, signal.aborted);
            return;
          }
          const exportedKeypair = JSON.stringify({ publicKey: exportedPublicKey, privateKey: exportedPrivateKey });
          const walletAddress = accounts[0].toLowerCase();
          return { walletAddress, authRequestWalletData, exportedKeypair };
        }
      } catch (err) {
        logger.error(`error in fetchAuthData`, err);
      }
    },
    [accounts, chainId],
  );

  const fetchingAuthData = useRef(false);

  useEffect(() => {
    // IF we have everything we need to fetch auth data, but aren't fetching, start fetching
    if (fetchingAuthData.current === false && !authData && chainId && accounts && accounts.length > 0 && accounts[0]) {
      logger.info(
        `Fetching authData as the user just unlocked the wallet`,
        fetchingAuthData.current,
        accounts,
        chainId,
        authData,
      );
      fetchingAuthData.current = true;
      const abort = new AbortController();
      let done = false;
      void (async () => {
        try {
          const result = await fetchAuthData(abort.signal);
          done = true;
          if (!abort.signal.aborted && result) {
            const { walletAddress, authRequestWalletData, exportedKeypair } = result;
            setWalletAddress(walletAddress);
            setAuthRequestWalletData(authRequestWalletData);
            setKeypair(exportedKeypair);
            logger.info(`Fetching authData as the user just unlocked the wallet - done`);
          } else {
            logger.warn(`Fetching authData request abandoned`);
          }
        } finally {
          fetchingAuthData.current = false;
        }
      })();
      return () => {
        if (!done) {
          logger.warn(`Fetching authData aborting request`);
          abort.abort();
        }
      };
    }
  }, [accounts, authData, chainId, fetchAuthData, setAuthRequestWalletData, setKeypair, setWalletAddress]);

  useEffect(() => {
    if (walletStatus === WalletStatus.Unknown && authData && isAuthenticated) {
      logger.info(`No wallet, setIsAuthenticated(false)`);
      setIsAuthenticated(false);
    }
  }, [authData, isAuthenticated, setIsAuthenticated, walletStatus]);

  return (
    <>
      <Head>
        <title>{"ChatWallette"}</title>
        <meta property="og:title" content="ChatWallette" />
        <meta name="description" content="Talk to fellow NFT holders" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://chatwallette.xyz" />
        <meta property="og:image" content="https://chatwallette.xyz/chatwallette_og.png" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <NFTBackground />

      <Stack shrink row basis={185}>
        <Stack alignItems="start" row>
          <Stack row justifyContent="end">
            {chainId ? (
              <Box border padding="xs" background="panel">
                ChainId: {chainName}
              </Box>
            ) : null}
            {isAuthenticated && accounts && accounts[0] && (
              <Box padding="xs" background="input">
                <SpanText bold>{abbrevWalletAddress(accounts && accounts[0])}</SpanText>
              </Box>
            )}
          </Stack>
        </Stack>
      </Stack>

      <Stack row grow>
        <IntroModule />
      </Stack>

      <Stack shrink basis={185} centerContent alignItems="center" justifyContent="center" textColor="NeonPurple">
        <Stack shrink row centerContent>
          <Link href={"https://github.com/HereNotThere/ChatWallette"} passHref={true}>
            <a
              aria-label="Go read the source and contribute to Chatwallette.xyz here"
              target="_blank"
              rel="noreferrer noopener"
            >
              <Button name={"Github"} icon={<GithubIcon />} background={"body"} textColor="NeonPurple" />
            </a>
          </Link>
          <Link href={"https://twitter.com/hntlabs"} passHref={true}>
            <a aria-label="Follow Chatwallette.xyz on Twitter" target="_blank" rel="noreferrer noopener">
              <Button name={"Twitter"} icon={<TwitterIcon />} background={"body"} textColor="NeonPurple"></Button>
            </a>
          </Link>
          <a
            aria-label="Send the people of Chatwallette.xyz an e-mail"
            href="mailto:Hello@hntlabs.com"
            rel="noreferrer noopener"
          >
            <Button name={"Email"} icon={<EmailIcon />} background={"body"} textColor="NeonPurple" />
          </a>
          <Link href={"https://docs.google.com/document/d/1y0nyxqbFr_trb_10NgWM4pnWv5KbdzOTgVKoMxTse3I/edit?usp=sharing"} passHref={true}>
            <a aria-label="Read FAQ about Chatwallette.xyz" target="_blank" rel="noreferrer noopener">
              <Button name={"FAQ"} icon={<QuestionIcon />} background={"body"} textColor="NeonPurple" />
            </a>
          </Link>
        </Stack>
        <SmallParagraph textColor="White">
          A fun experiment by{" "}
          <a href="https://hntlabs.com" target="_blank" rel="noreferrer">
            <SpanText textColor="NeonPurple">Here Not There Labs</SpanText>
          </a>
        </SmallParagraph>
      </Stack>
    </>
  );
};

export default Home;
