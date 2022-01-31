import { ERC20Result } from "../../../protocol/tokens";
import { Token } from "./Token";

type ERC20TokenProps = {
  token: ERC20Result;
};

export const ERC20Token = (props: ERC20TokenProps) => {
  const { symbol } = props.token;
  return <Token tokenType={"ERC20"} symbol={symbol} />;
};
