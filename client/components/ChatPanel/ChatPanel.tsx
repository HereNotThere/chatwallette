import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ERC20Result, NFTResult } from "../../../protocol/tokens";
import { ChatSession } from "../../hooks/use_chat_session";
import { useStore } from "../../store/store";
import { Button } from "../Button";
import { InputField } from "../InputField/InputField";
import { Panel } from "../Panel";
import { Stack } from "../Stack";
import Tokens from "../Tokens/Tokens";
import { Paragraph, SpanText } from "../Text/Text";
import { Box } from "../Box";
import { DisplayName } from "../User/DisplayName";

type Props = {
  participants: string[];
  otherUsername?: string;
  otherWalletENS?: string;
  otherWalletAddress?: string;
  onClose: () => void;
  chatSession: ChatSession;
  otherERC20: ERC20Result[];
  otherNFT: NFTResult[];
  matchedNFT: NFTResult[];
  chainId?: string;
};

const ChatPanelTitle = (props: { walletENS?: string; screenName?: string; walletAddress?: string }) => {
  const user: { walletENS: string | null; screenName: string | null; walletAddress: string | null } = useStore();
  return (
    <SpanText>
      <DisplayName {...user} />
      {" / "}
      <DisplayName {...props} />
    </SpanText>
  );
};

export const ChatPanel = (props: Props) => {
  const [inputValue, setInputValue] = useState("");
  const { screenName, walletAddress } = useStore();
  const { chainId, otherWalletENS, otherUsername, otherWalletAddress, chatSession, matchedNFT } = props;
  const { messages } = chatSession;
  const otherUser = { walletENS: otherWalletENS, screenName: otherUsername, walletAddress: otherWalletAddress };

  const onInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const onClickSubmit = useCallback(() => {
    if (inputValue) {
      const message = inputValue;
      const timestamp = Date.now();
      setInputValue("");
      chatSession.sendChatMessage({ timestamp, screenName: screenName ?? "Unknown", message });
    }
  }, [inputValue, screenName, chatSession]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        onClickSubmit();
      }
    },
    [onClickSubmit],
  );

  const otherWallet = props.participants.find(user => user !== walletAddress);
  const placeholder = useMemo(
    () => (!messages?.some(m => m.screenName === "you") ? "Type something" : undefined),
    [messages],
  );

  const [abbrevTokens, setAbbrevTokens] = useState<string[]>();

  // Pick up to 3 random tokens from the list of token names and symbols
  const randomTokens = useMemo(() => {
    const tokenNames = matchedNFT.map(nft => nft.name).filter(name => name);
    return tokenNames.slice(0, 3).map(function (this: string[]) {
      return this.splice(Math.floor(Math.random() * this.length), 1)[0];
    }, tokenNames.slice());
  }, [matchedNFT]);

  const otherTokensLength = matchedNFT.length - randomTokens.length;

  const openseaUrl = useMemo(() => {
    return chainId === "0x4" ? "https://testnets.opensea.io/" : "https://opensea.io/";
  }, [chainId]);

  useEffect(() => {
    if (!abbrevTokens && randomTokens.length) {
      setAbbrevTokens(randomTokens);
    }
  }, [abbrevTokens, randomTokens]);

  const otherDisplayName = otherWalletENS
    ? otherWalletENS
    : otherUsername
    ? otherUsername
    : otherWallet?.slice(0, 5) + "..." + otherWallet?.slice(-5);

  return (
    <Panel padding="xs" onClose={props.onClose} panelTitle={<ChatPanelTitle {...otherUser} />}>
      <Stack background="panel2" padding="sm" border>
        <Box grow textColor="LightPurple">
          <Paragraph>
            <SpanText textColor="LightPurple">You are now talking with </SpanText>
            <SpanText textColor="LightPurple" bold>
              {otherDisplayName}
            </SpanText>
          </Paragraph>
          {abbrevTokens && (
            <Paragraph textColor="LightPurple">
              {otherDisplayName} also holds {abbrevTokens.join(", ")}
              {otherTokensLength > 0 ? ` and ${otherTokensLength} other things` : ""}
            </Paragraph>
          )}
          <Paragraph>
            <a target="_blank" href={openseaUrl + otherWallet} rel="noopener noreferrer">
              <SpanText bold textColor="Turqoise">
                Click here
              </SpanText>
            </a>

            <SpanText>{" to see all their holdings"}</SpanText>
          </Paragraph>

          {matchedNFT.length > 0 && (
            <>
              <Paragraph></Paragraph>
              <Tokens key={"nft"} nft={matchedNFT} limit={4} />
              <Paragraph></Paragraph>
            </>
          )}

          {messages?.map(m => (
            <Paragraph textColor="White" key={`${m.timestamp}${m.screenName}`}>
              <strong>{m.screenName}:</strong> {m.message}
            </Paragraph>
          ))}
        </Box>
        <Stack row shrink itemSpace="xs">
          <InputField
            padding="sm"
            border
            grow
            value={inputValue}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
          />
          <Button onClick={onClickSubmit} horizontalPadding="md">
            Send
          </Button>
        </Stack>
      </Stack>
    </Panel>
  );
};
