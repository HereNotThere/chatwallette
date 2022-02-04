import { AnimatePresence, motion } from "framer-motion";
import React, { ChangeEvent, useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { AuthenticatingStatus } from "../../../protocol/auth";
import { useWeb3Context, WalletStatus } from "../../hooks/use_web3";
import { useWeb3Auth } from "../../hooks/use_web3_auth";
import { useStore } from "../../store/store";
import { Box } from "../Box";
import { Button } from "../Button";
import { ArrowIcon } from "../Icons";
import { InputField } from "../InputField/InputField";
import { Spinner } from "../Spinner/Spinner";
import { Stack } from "../Stack";
import { SpanText } from "../Text/Text";

const AuthStatus = ({
  authData,
  authenticatingStatus,
  screenName,
}: {
  authData: {
    nonce: string;
    sessionId: string;
  } | null;
  authenticatingStatus: AuthenticatingStatus;
  screenName?: string;
}) => {
  const { walletStatus, requestAccounts } = useWeb3Context();
  const onConnectClick = useCallback(() => requestAccounts(), [requestAccounts]);

  if (walletStatus === WalletStatus.Unknown || walletStatus === WalletStatus.Error) {
    return (
      <FadeContainer>
        <Button icon={<ArrowIcon />} border={false} onClick={onConnectClick} horizontalPadding="lg">
          Connect Wallet
        </Button>
      </FadeContainer>
    );
  } else if (walletStatus === WalletStatus.RequestUnlocked) {
    return <FadeContainer>Connecting wallet</FadeContainer>;
  } else if (walletStatus === WalletStatus.StillRequestUnlocked) {
    return <FadeContainer>Connecting wallet - please unlock your wallet provider</FadeContainer>;
  } else if (
    walletStatus === WalletStatus.Unlocked &&
    authData === null &&
    authenticatingStatus === AuthenticatingStatus.Authenticated
  ) {
    return (
      <FadeContainer>
        <NoWrap>
          Fetching wallet data <Spinner mode="connecting" />
        </NoWrap>
      </FadeContainer>
    );
  } else {
    switch (authenticatingStatus) {
      case AuthenticatingStatus.SigningMessage: {
        return (
          <FadeContainer>
            <NoWrap>
              Signing in as {screenName} <Spinner mode="connecting" />
            </NoWrap>
          </FadeContainer>
        );
      }
      default:
        return (
          <FadeContainer>
            <NoWrap>
              Fetching wallet data <Spinner mode="connecting" />
            </NoWrap>
          </FadeContainer>
        );
    }
  }
};

const NoWrap = styled.div`
  white-space: nowrap;
  color: var(--fg-muted);
`;

export const UserForm = () => {
  const { providerInstalled, walletStatus } = useWeb3Context();
  const { authenticatingStatus, handleLoginClick } = useWeb3Auth();
  const { authData } = useStore();

  const [error, setError] = useState(false);
  const [screenName, setScreenName] = useState<string>();

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setScreenName(e.target.value);
  }, []);

  const onLoginClick = useCallback(() => screenName && handleLoginClick(screenName), [handleLoginClick, screenName]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && screenName) {
        void handleLoginClick(screenName);
      }
    },
    [handleLoginClick, screenName],
  );

  useEffect(() => {
    if (error && screenName?.length) {
      setError(false);
    }
  }, [error, screenName?.length]);

  return (
    <AnimatePresence exitBeforeEnter>
      {!providerInstalled ? (
        <FadeContainer key="wallet">
          <SpanText centerText>A Wallet provider is required to use Chat Wallette</SpanText>
        </FadeContainer>
      ) : authData !== null &&
        walletStatus === WalletStatus.Unlocked &&
        authenticatingStatus === AuthenticatingStatus.Unauthenticated ? (
        <FadeContainer key="input">
          <Stack row itemSpace="xs" padding="no" shrink>
            <InputField
              type="text"
              name="chatwallettename"
              value={screenName ?? ""}
              onChange={onChange}
              onKeyDown={onKeyDown}
              size={16}
              autoFocus
              autoComplete="off"
              placeholder="Pick a username"
              borderColor={error ? "NeonPurple" : "GrapePurple"}
            />
            <Button icon={<ArrowIcon />} onClick={onLoginClick}></Button>
          </Stack>
        </FadeContainer>
      ) : (
        <AuthStatus authData={authData} authenticatingStatus={authenticatingStatus} screenName={screenName} />
      )}
    </AnimatePresence>
  );
};

const FadeContainer: React.FC = props => (
  <MotionBox
    textColor="LightPurple"
    basis={45}
    variants={{
      hide: { opacity: 0, transition: { duration: 0.2 } },
      show: { opacity: 1, transition: { delay: 0.5, duration: 0.5 } },
    }}
    initial="hide"
    animate="show"
    exit="hide"
  >
    {props.children}
  </MotionBox>
);

const MotionBox = motion(Box);

export default UserForm;
