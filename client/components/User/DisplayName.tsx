import React, { useCallback, useState } from "react";
import { SpanText } from "../Text/Text";

export const abbrevWalletAddress = (walletAddress?: string | null) => {
  return walletAddress ? walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4) : "";
};

export const DisplayName = (props: {
  screenName?: string | null;
  walletAddress?: string | null;
  walletENS?: string | null;
}) => {
  const { screenName, walletAddress, walletENS } = props;
  const [displayNameIndex, setDisplayNameIndex] = useState(0);
  const abbrevWallet = abbrevWalletAddress(walletAddress);
  const displayNames = [walletENS, screenName, abbrevWallet].filter(x => x);

  const onClick = useCallback(() => {
    setDisplayNameIndex((displayNameIndex + 1) % displayNames.length);
  }, [displayNameIndex, displayNames.length, setDisplayNameIndex]);

  return (
    <SpanText onClick={onClick} bold>
      {displayNames[displayNameIndex % displayNames.length]}
    </SpanText>
  );
};
