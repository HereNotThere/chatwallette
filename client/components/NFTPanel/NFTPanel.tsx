import React, { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import styled from "styled-components";
import { NFTResult } from "../../../protocol/tokens";
import { Box } from "../Box";
import { Grid } from "../Grid/Grid";
import { Panel } from "../Panel";
import { NFTToken } from "../Tokens/NFTToken";

type Props = {
  onClose: () => void;
  nfts: NFTResult[];
};
export const NFTPanel = (props: Props) => {
  return (
    <Panel padding="xs" onClose={props.onClose} panelTitle={"Your NFTs"} basis={320} shrink grow={0}>
      <NFTGrid itemSize={"20%"} itemSpace="xs">
        {props.nfts.map(nft => (
          <NFTContainer key={`${nft.token_address}-${nft.token_id}`}>
            <NFTToken token={nft} />
          </NFTContainer>
        ))}
      </NFTGrid>
    </Panel>
  );
};

const NFTGrid = styled(Grid)`
  overflow-y: scroll;
  max-width: 480px;
  height: 33vh;
  min-height: 120px;
  max-height: 300px;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const NFTContainer = (props: { children: React.ReactNode }) => {
  const [show, setShow] = useState(false);
  const { ref, inView } = useInView({
    threshold: 0,
  });
  useEffect(() => {
    if (inView) setShow(true);
  }, [inView]);

  return (
    <StyledNFTContainer centerContent ref={ref}>
      {show ? props.children : <></>}
    </StyledNFTContainer>
  );
};

const StyledNFTContainer = styled(Box)`
  aspect-ratio: 1;
`;
