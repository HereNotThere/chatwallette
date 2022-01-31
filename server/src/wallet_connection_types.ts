import { ERC20Result, NFTResult } from "../../protocol/tokens";

import { AuthRequestData } from "../../protocol/auth";
import { EventMessage } from "./sse/sse-plugin";

export interface WalletData {
  allNFT?: NFTResult[];
  allERC20?: ERC20Result[];
  walletENS: string | null;
}

export interface UserAuthData {
  message: string;
  signature: string;
  authRequestData: AuthRequestData;
}

export interface Connection {
  send: (message: EventMessage) => Promise<boolean>;
  close: () => void;
}
