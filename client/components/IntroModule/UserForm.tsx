import { useState, useCallback, ChangeEvent, useEffect } from "react";
import { useWeb3Context, WalletStatus } from "../../hooks/use_web3";
import { AuthenticatingStatus, useWeb3Auth } from "../../hooks/use_web3_auth";
import { useStore } from "../../store/store";
import { logger } from "../../utils/logger";
import { Box } from "../Box";
import { Button } from "../Button";
import { ArrowIcon } from "../Icons";
import { InputField } from "../InputField/InputField";
import { Spinner } from "../Spinner/Spinner";
import { Stack } from "../Stack";
import { Paragraph, SpanText } from "../Text/Text";

export const UserForm = () => {
  const { providerInstalled, walletStatus, requestAccounts } = useWeb3Context();

  const { authenticatingStatus, handleLoginClick } = useWeb3Auth();
  const { authData } = useStore();

  const [error, setError] = useState(false);
  const { screenName, setScreenName } = useStore();

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setScreenName(e.target.value);
    },
    [setScreenName],
  );

  const onLoginClick = useCallback(() => screenName && handleLoginClick(screenName), [handleLoginClick, screenName]);
  const onConnectClick = useCallback(() => requestAccounts(), [requestAccounts]);

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

  const AuthStatus = useCallback(() => {
    if (walletStatus === WalletStatus.Unknown || walletStatus === WalletStatus.Error) {
      return (
        <>
          <Stack itemSpace="xs" shrink>
            <Button icon={<ArrowIcon />} border={false} onClick={onConnectClick}>
              Connect Wallet
            </Button>
          </Stack>
        </>
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
        <>
          Fetching wallet data <Spinner mode="connecting" />
        </>
      );
    } else {
      logger.info(`AuthStatus changed ${JSON.stringify(authenticatingStatus)}`);
      switch (authenticatingStatus) {
        case AuthenticatingStatus.SigningMessage: {
          return (
            <>
              Signing in as {screenName} <Spinner mode="connecting" />
            </>
          );
        }
        default:
          return <></>;
      }
    }
  }, [authData, authenticatingStatus, onConnectClick, screenName, walletStatus]);

  return (
    <>
      {!providerInstalled ? (
        <Box>
          <SpanText centerText>A Wallet provider is required to use Chat Wallette</SpanText>
        </Box>
      ) : (
        <Stack row itemSpace="xs" shrink padding>
          {authData !== null &&
          walletStatus === WalletStatus.Unlocked &&
          authenticatingStatus === AuthenticatingStatus.Unauthenticated ? (
            <>
              <InputField
                value={screenName ?? ""}
                onChange={onChange}
                onKeyDown={onKeyDown}
                size={16}
                autoFocus
                placeholder="Select a name"
                borderColor={error ? "NeonPurple" : "GrapePurple"}
              />
              <Button icon={<ArrowIcon />} border={false} onClick={onLoginClick}></Button>
            </>
          ) : (
            <Box padding="xs">
              <Paragraph textColor="NeonPurple">
                <AuthStatus />
              </Paragraph>
            </Box>
          )}
        </Stack>
      )}
    </>
  );
};

export default UserForm;
