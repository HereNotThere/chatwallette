import { ERC20Result, NFTResult } from "./tokens";

export interface AuthRequest {
  message: string;
  signature: string;
  authRequestData: AuthRequestData;
}

export interface AuthToken {
  walletAddress: string;
  publicKey: string;
  issuedAt: string;
}

export interface AuthRequestWalletData {
  chainId: string;
  nonce: string;
  sessionId: string;
  allNFT: NFTResult[];
  allERC20: ERC20Result[];
  walletENS: string | null;
}

export interface AuthRequestData {
  walletAddress: string;
  chainId: string;
  nonce: string;
  sessionId: string;
  publicKey: string;
  screenName: string;
}

export const authCookieName = "chatWalletteAuth";
