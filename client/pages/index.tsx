import type { NextPage } from "next";
import Head from "next/head";

import { logger } from "../utils/logger";
import { Button } from "../components/Button";
import { InfoIcon, TwitterIcon, EmailIcon, QuestionIcon, GithubIcon } from "../components/Icons";
import { Stack } from "../components/Stack";
import Link from "next/link";

import React, { useCallback, useEffect, useRef } from "react";
import IntroModule from "../components/IntroModule/IntroModule";
import { Box } from "../components/Box";
import { useWeb3Context, WalletStatus } from "../hooks/use_web3";
import { Base64 } from "js-base64";
import { getAuthRequestWalletData } from "../utils/authRequest";
import { useStore } from "../store/store";
import { useWhyDidYouUpdate } from "../hooks/use_why_did_you_update";
import { abbrevWalletAddress } from "../components/User/DisplayName";
import { SpanText } from "../components/Text/Text";
import { LogoBackground } from "../components/LogoBackground/LogoBackground";

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

  const onWalletAvailable = useCallback(async () => {
    logger.info(`onWalletAvailable`);
    try {
      if (chainId && accounts && accounts.length > 0 && accounts[0]) {
        const nonceArray = new Uint8Array(16);
        self.crypto.getRandomValues(nonceArray);

        // Since this is going in the URL query string it needs to be URL safe
        const nonce = Base64.fromUint8Array(nonceArray, true);
        const [authRequestWalletData, keypair] = await Promise.all([
          await getAuthRequestWalletData(chainId, accounts[0], nonce),
          await window.crypto.subtle.generateKey(
            {
              name: "ECDH",
              namedCurve: "P-384",
            },
            true,
            ["deriveKey"],
          ),
        ]);
        if (!authRequestWalletData) {
          logger.error(`onWalletAvailable failed getting authRequestWalletData`);
          throw new Error("Failed to obtain authRequestWalletData");
        }
        setAuthRequestWalletData(authRequestWalletData);
        const walletAddress = accounts[0].toLowerCase();
        setWalletAddress(walletAddress);
        const exportedPrivateKey = keypair.privateKey
          ? await crypto.subtle.exportKey("jwk", keypair.privateKey)
          : undefined;
        const exportedPublicKey = keypair.publicKey
          ? await crypto.subtle.exportKey("jwk", keypair.publicKey)
          : undefined;

        const exportedKeypair = JSON.stringify({ publicKey: exportedPublicKey, privateKey: exportedPrivateKey });
        setKeypair(exportedKeypair);
      }
    } catch (err) {
      logger.error(`error in onWalletAvailable`, err);
    }
  }, [accounts, chainId, setAuthRequestWalletData, setKeypair, setWalletAddress]);

  const connectingWallet = useRef<"Unconnected" | "Connecting" | "Connected">("Unconnected");

  useEffect(() => {
    if (
      connectingWallet.current === "Unconnected" &&
      walletStatus === WalletStatus.Unlocked &&
      chainId &&
      accounts &&
      accounts.length > 0 &&
      accounts[0]
    ) {
      void (async () => {
        logger.info(`Fetching authData as the user just unlocked the wallet`);
        connectingWallet.current = "Connecting";
        await onWalletAvailable();
        connectingWallet.current = "Connected";
        logger.info(`Fetching authData as the user just unlocked the wallet - done`);
      })();
    }
  }, [accounts, chainId, onWalletAvailable, walletStatus]);

  useEffect(() => {
    if (connectingWallet.current !== "Unconnected" && !chainId && (!accounts || accounts.length === 0)) {
      logger.info(`connectingWallet.current=Unconnected`);
      connectingWallet.current = "Unconnected";
    }
  }, [accounts, chainId]);

  useEffect(() => {
    if (walletStatus === WalletStatus.Unknown && authData && isAuthenticated) {
      logger.info(`No wallet, setIsAuthenticated(false)`);
      setIsAuthenticated(false);
    }
  }, [authData, isAuthenticated, setIsAuthenticated, walletStatus]);

  useEffect(() => {
    if (
      connectingWallet.current === "Connected" &&
      walletStatus === WalletStatus.Unlocked &&
      chainId &&
      accounts &&
      accounts.length > 0 &&
      accounts[0] &&
      !authData &&
      !keypair
    ) {
      void (async () => {
        logger.info(`Re-fetching authData since the user logged out but the wallet is still unlocked`);
        connectingWallet.current = "Connecting";
        await onWalletAvailable();
        connectingWallet.current = "Connected";
        logger.info(`Re-fetching authData since the user logged out but the wallet is still unlocked - done`);
      })();
    }
  }, [accounts, authData, chainId, keypair, onWalletAvailable, walletStatus]);

  return (
    <>
      <Head>
        <title>{"Chat Wallette"}</title>
        <meta name="description" content="Chat Wallette" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <LogoBackground />

      <Stack shrink row>
        <Box grow />
        <Box alignItems="end">
          <Stack row>
            {chainId ? (
              <Box className="body-text" border padding="xs" background="panel">
                ChainId: {chainId}
              </Box>
            ) : null}
            {isAuthenticated && accounts && accounts[0] && (
              <Box className="body-text" border padding="xs" background="input">
                <SpanText bold>{abbrevWalletAddress(accounts && accounts[0])}</SpanText>
              </Box>
            )}
          </Stack>
        </Box>
      </Stack>

      <Stack grow centerContent itemSpace="sm">
        <IntroModule />
      </Stack>
      <Stack centerContent row shrink itemSpace="no">
        <Link href={"https://github.com/HereNotThere/ChatWallette"} passHref={true}>
          <a
            aria-label="Go read the source and contribute to Chatwallette.xyz here"
            target="_blank"
            rel="noreferrer noopener"
          >
            <Button name={"Github"} icon={<GithubIcon />} background={"body"} />
          </a>
        </Link>
        <Link
          href={"https://herenottherelabs.notion.site/ChatWallette-About-Us-d6da63ef1a65415a8be2566915c48f96"}
          passHref={true}
        >
          <a aria-label="Go read more about this Chatwallette.xyz here" target="_blank" rel="noreferrer noopener">
            <Button name={"Info"} icon={<InfoIcon />} background={"body"} />
          </a>
        </Link>
        <Link href={"https://twitter.com/hntlabs"} passHref={true}>
          <a aria-label="Follow Chatwallette.xyz on Twitter" target="_blank" rel="noreferrer noopener">
            <Button name={"Twitter"} icon={<TwitterIcon />} background={"body"}></Button>
          </a>
        </Link>
        <a
          aria-label="Send the people of Chatwallette.xyz an e-mail"
          href="mailto:Hello@hntlabs.com"
          rel="noreferrer noopener"
        >
          <Button name={"Email"} icon={<EmailIcon />} background={"body"} />
        </a>
        <Link href={"https://herenottherelabs.notion.site/FAQ-2b0dce108daa4998a1a2a64f39604184"} passHref={true}>
          <a aria-label="Read FAQ about Chatwallette.xyz" target="_blank" rel="noreferrer noopener">
            <Button name={"FAQ"} icon={<QuestionIcon />} background={"body"} />
          </a>
        </Link>
      </Stack>
    </>
  );
};

export default Home;
