import React, { useEffect, useMemo, useState } from "react";
import { usePrevious } from "../../hooks/use_previous";
import { useStore } from "../../store/store";
import { Box } from "../Box";
import { Stack } from "../Stack";
import { SpanText } from "../Text/Text";
import { NFTToken } from "../Tokens/NFTToken";
import { DisplayName } from "../User/DisplayName";
import { Cursor } from "./Cursor";
import { TerminalLog, useTerminal } from "./hooks/useTerminal";
import { extractText } from "./util/text_parse_utils";
import { logger } from "../../utils/logger";

type Props = {
  terminalLog: (string | JSX.Element)[];
  showLookingForMatch?: boolean;
  matchTokens: boolean;
};

const LookingForMatch = (props: { matchTokens: boolean }) => {
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const { selfNFT } = useStore();

  const nft = useMemo(() => selfNFT[sequenceIndex], [selfNFT, sequenceIndex]);
  useEffect(() => {
    const interval = setInterval(() => {
      setSequenceIndex(i => (i + 1) % selfNFT.length);
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  });
  return (
    <Stack row>
      <SpanText>
        {props.matchTokens ? "Looking for a match based on your NFTs..." : "Looking for a random match..."}
      </SpanText>
      {props.matchTokens && nft ? (
        <SpanText>
          <NFTToken key={nft.token_id} token={nft} />
        </SpanText>
      ) : null}
    </Stack>
  );
};

export const Terminal = (props: Props) => {
  const { terminalLog, showLookingForMatch } = props;
  const cursor = useMemo(() => (showLookingForMatch ? undefined : <Cursor />), [showLookingForMatch]);

  const user: { walletENS: string | null; screenName: string | null; walletAddress: string | null } = useStore();

  const log = useMemo<TerminalLog>(
    () => [
      <>
        <SpanText>Welcome to ChatWallette, </SpanText>
        <DisplayName {...user} />
      </>,
      "Here you can talk to fellow jpeg holders",
    ],
    [user],
  );

  // break up props.logs / local logs to avoid too much merge trouble - to be
  // unified and cleaned up
  const [combinedLogs, setCombinedLogs] = useState<TerminalLog>([]);

  const prevLog = usePrevious(log);
  useEffect(() => {
    const diff = log.length - (prevLog ? prevLog.length : 0);
    if (diff > 0) {
      setCombinedLogs(l => l.concat(log.slice(-diff)));
    }
  }, [log, prevLog]);

  const prevTerminalLog = usePrevious(terminalLog);
  useEffect(() => {
    const diff = terminalLog.length - (prevTerminalLog ? prevTerminalLog.length : 0);
    if (diff > 0) {
      setCombinedLogs(l => l.concat(terminalLog.slice(-diff)));
    }
  }, [prevTerminalLog, terminalLog]);

  // TODO: base maxLines on browser height
  const { terminalElement, typingDone } = useTerminal(combinedLogs, { cursor, maxLines: 20 });

  useEffect(() => {
    logger.info("debug::", combinedLogs.map(l => extractText(l)).join("\r\n"));
  }, [combinedLogs]);

  return (
    <>
      <Box textColor="LightPurple" className="body-text">
        {terminalElement}
        {typingDone && showLookingForMatch && <LookingForMatch matchTokens={props.matchTokens} />}
      </Box>
    </>
  );
};
