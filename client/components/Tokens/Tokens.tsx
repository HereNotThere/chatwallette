/* pages/tokens.js */
import React from "react";
import { Grid } from "../Grid/Grid";
import { NFTToken } from "./NFTToken";
import { ERC20Result, NFTResult } from "../../../protocol/tokens";
import { ERC20Token } from "./ERC20Token";

function TokensComponent(props: { erc20?: ERC20Result[]; nft?: NFTResult[]; limit?: number }) {
  const { erc20, nft, limit } = props;

  return (
    <>
      <Grid itemSize={"80px"} itemSpace={"xs"} scrollable={!limit}>
        {erc20
          ?.map((token, n) =>
            limit && n >= limit ? undefined : <ERC20Token token={token} key={token.token_address} />,
          )
          .filter(token => token)}
        {nft
          ?.map((nft, n) =>
            limit && n >= limit ? undefined : <NFTToken token={nft} key={`${nft.token_address}-${nft.token_id}`} />,
          )
          .filter(nft => nft)}
      </Grid>
    </>
  );
}

const Tokens = React.memo(TokensComponent);
export default Tokens;
