import createStore from "zustand";
import { configurePersist } from "zustand-persist";
import { AuthRequestWalletData, AuthenticatingStatus } from "../../protocol/auth";
import { ERC20Result, NFTResult } from "../../protocol/tokens";

const noopStore = {
  setItem: (key: string, value: string) => undefined,
  getItem: (key: string) => null,
  removeItem: (key: string) => undefined,
};
export const { persist, purge } = configurePersist({
  storage: typeof window !== "undefined" ? localStorage : noopStore, // use `AsyncStorage` in react native, noopStore in SSR
});

type StateType = {
  isAuthenticated: boolean;
  authData: { nonce: string; sessionId: string } | null;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  chainId: string | null;
  setChainId: (chainId?: string) => void;
  walletAddress: string | null;
  setWalletAddress: (walletAddress?: string) => void;
  screenName: string | null;
  setScreenName: (screenName?: string) => void;
  walletENS: string | null;
  setWalletENS: (walletENS?: string) => void;
  selfNFT: NFTResult[];
  setSelfNFT: (selfNFT: NFTResult[]) => void;
  selfERC20: ERC20Result[];
  setSelfERC20: (selfERC20: ERC20Result[]) => void;
  keypair: string | null;
  setKeypair: (keypair?: string) => void;
  iceServers: RTCIceServer[] | null;
  setIceServers: (iceServers?: RTCIceServer[]) => void;
  setAuthRequestWalletData: (authRequestWalletData?: AuthRequestWalletData) => void;
  authenticatingStatus: AuthenticatingStatus;
  setAuthenticatingStatus: (authenticatingStatus: AuthenticatingStatus) => void;
};

export const useStore = createStore<StateType>(
  persist(
    {
      key: "authState",
    },
    set => ({
      isAuthenticated: false,
      authData: null,
      setIsAuthenticated: (isAuthenticated: boolean) =>
        isAuthenticated
          ? set({ isAuthenticated: true })
          : set({
              isAuthenticated: false,
              authData: null,
              chainId: null,
              walletAddress: null,
              walletENS: null,
              screenName: null,
              selfNFT: [],
              selfERC20: [],
              keypair: null,
              iceServers: null,
              authenticatingStatus: AuthenticatingStatus.Unauthenticated,
            }),
      chainId: null,
      setChainId: (chainId?: string) => set({ chainId: chainId ?? null }),
      walletAddress: null,
      setWalletAddress: (walletAddress?: string) => set({ walletAddress: walletAddress?.toLowerCase() ?? null }),
      screenName: null,
      setScreenName: (screenName?: string) => set({ screenName: screenName ?? null }),
      walletENS: null,
      setWalletENS: (walletENS?: string) => set({ walletENS: walletENS ?? null }),
      selfNFT: [],
      setSelfNFT: (selfNFT: NFTResult[]) => set({ selfNFT }),
      selfERC20: [],
      setSelfERC20: (selfERC20: ERC20Result[]) => set({ selfERC20 }),
      keypair: null,
      setKeypair: (keypair?: string) => set({ keypair: keypair ?? null }),
      iceServers: null,
      setIceServers: (iceServers?: RTCIceServer[]) => set({ iceServers: iceServers ?? null }),
      authRequestWalletData: null,
      setAuthRequestWalletData: (authRequestWalletData?: AuthRequestWalletData) =>
        set({
          selfERC20: authRequestWalletData?.allERC20 ?? [],
          selfNFT: authRequestWalletData?.allNFT ?? [],
          chainId: authRequestWalletData?.chainId ?? null,
          walletENS: authRequestWalletData?.walletENS ?? null,
          authData:
            authRequestWalletData?.nonce && authRequestWalletData?.sessionId
              ? {
                  nonce: authRequestWalletData.nonce,
                  sessionId: authRequestWalletData.sessionId,
                }
              : null,
        }),
      authenticatingStatus: AuthenticatingStatus.Unauthenticated,
      setAuthenticatingStatus: (authenticatingStatus: AuthenticatingStatus) => set({ authenticatingStatus }),
    }),
  ),
);
