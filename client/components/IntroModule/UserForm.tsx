import { ChangeEvent, useCallback, useEffect, useState } from "react";
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
      <Button icon={<ArrowIcon />} border={false} onClick={onConnectClick} horizontalPadding="lg">
        Connect Wallet
      </Button>
    );
  } else if (walletStatus === WalletStatus.RequestUnlocked) {
    return <>Connecting wallet</>;
  } else if (walletStatus === WalletStatus.StillRequestUnlocked) {
    return <>Connecting wallet - please unlock your wallet provider</>;
  } else if (
    walletStatus === WalletStatus.Unlocked &&
    authData === null &&
    authenticatingStatus === AuthenticatingStatus.Authenticated
  ) {
    return (
      <NoWrap>
        Fetching wallet data <Spinner mode="connecting" />
      </NoWrap>
    );
  } else {
    switch (authenticatingStatus) {
      case AuthenticatingStatus.SigningMessage: {
        return (
          <NoWrap>
            Signing in as {screenName} <Spinner mode="connecting" />
          </NoWrap>
        );
      }
      default:
        return (
          <NoWrap>
            Fetching wallet data <Spinner mode="connecting" />
          </NoWrap>
        );
    }
  }
};

const NoWrap = styled.div`
  white-space: nowrap;
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
    <>
      {!providerInstalled ? (
        <Box textColor="LightPurple">
          <SpanText centerText>A Wallet provider is required to use Chat Wallette</SpanText>
        </Box>
      ) : (
        <Stack row itemSpace="xs" padding="xs" shrink>
          {authData !== null &&
          walletStatus === WalletStatus.Unlocked &&
          authenticatingStatus === AuthenticatingStatus.Unauthenticated ? (
            <Stack row itemSpace="xs" shrink>
              <InputField
                type="text"
                value={screenName ?? ""}
                onChange={onChange}
                onKeyDown={onKeyDown}
                size={16}
                autoFocus
                placeholder="Pick a username"
                borderColor={error ? "NeonPurple" : "GrapePurple"}
              />
              <Button icon={<ArrowIcon />} border={false} onClick={onLoginClick}></Button>
            </Stack>
          ) : (
            <Box grow textColor="LightPurple">
              <AuthStatus authData={authData} authenticatingStatus={authenticatingStatus} screenName={screenName} />
            </Box>
          )}
        </Stack>
      )}
    </>
  );
};

export default UserForm;
