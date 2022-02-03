import { Connection, UserAuthData, WalletData } from "./wallet_connection_types";
import {
  EnterPoolRequest,
  JoinChatEvent,
  LeavePoolRequest,
  MatchCriteria,
  OtherParticipantTokensEvent,
  SignalingEventType,
  SignalingRequest,
  SignalingRequestType,
  UpdateMatchCriteria,
  WebRTCNegotiationRequest,
} from "../../protocol/signaling_types";

import { EventMessage } from "./sse/sse-plugin";
import { FastifyLoggerInstance } from "fastify";
import { WalletConnectionStore } from "./wallet_connection_store";
import { randomUUID } from "crypto";
import { sendAnalytics } from "./analytics";

export class WebRTCSignalingServer {
  private connectionStore: WalletConnectionStore;

  constructor(newConnectionStore: WalletConnectionStore) {
    this.connectionStore = newConnectionStore;
    newConnectionStore.on("onchanged", async (log: FastifyLoggerInstance, walletAddress: string) => {
      log.info(`onchanged start for wallet ${walletAddress}`);
      await this.selectTwoPeers(log, walletAddress);
      log.info(`onchanged end for wallet ${walletAddress}`);
    });
  }

  public async applyConfigurations(): Promise<void> {
    // Exclude these tokens for matching.
    await this.connectionStore.updateExcludedTokens([
      "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85", // ENS token
    ]);
  }

  public async handleRequest(
    log: FastifyLoggerInstance,
    walletAddress: string,
    request: SignalingRequest,
  ): Promise<void> {
    const { type } = request;
    switch (type) {
      case SignalingRequestType.WebRTCNegotiation: {
        return await this.forwardWebRTCNegotiation(log, request);
      }
      case SignalingRequestType.EnterPool: {
        return await this.enterPool(log, walletAddress, request);
      }
      case SignalingRequestType.LeavePool: {
        return await this.leavePool(log, walletAddress, request);
      }
      case SignalingRequestType.UpdateMatchCriteria: {
        return await this.updateMatchCriteria(log, walletAddress, request);
      }
      default: {
        log.warn(`Unhandled data`, request);
      }
    }
  }

  private async enterPool(log: FastifyLoggerInstance, walletAddress: string, request: EnterPoolRequest): Promise<void> {
    log.info(`entering pool for wallet ${walletAddress}`);
    const matchCriteria: MatchCriteria = {
      matchTokens: request.matchTokens,
      excludeList: request.excludeList,
    };
    await this.connectionStore.updateMatchCriteria(log, walletAddress, matchCriteria);
    await this.connectionStore.enqueueToWaitingList(log, walletAddress);

    const waitingList = await this.connectionStore.getWaitingList();
    log.info(`enterPool ${JSON.stringify({ walletAddress, waitingList, request })}`);
  }

  private async leavePool(log: FastifyLoggerInstance, walletAddress: string, request: LeavePoolRequest): Promise<void> {
    await this.connectionStore.removeFromWaitingList(log, walletAddress);
    const waitingList = await this.connectionStore.getWaitingList();
    log.info(`leavePool ${JSON.stringify({ walletAddress, waitingList, request })}`);
  }

  public async addAuthenticatedUser(
    log: FastifyLoggerInstance,
    walletAddress: string,
    userAuthData: UserAuthData,
  ): Promise<void> {
    await this.connectionStore.addAuthenticatedUser(log, walletAddress, userAuthData);
    log.info(`addAuthenticatedUser walletAddress: ${walletAddress}}`);
  }

  public async removeAuthenticatedUser(log: FastifyLoggerInstance, walletAddress: string) {
    log.info(`removeAuthenticatedUser connection walletAddress: ${walletAddress}`);
    await this.connectionStore.removeAuthenticatedUser(log, walletAddress);
  }

  public async addUserConnection(
    log: FastifyLoggerInstance,
    walletAddress: string,
    connection: Connection,
  ): Promise<void> {
    await this.connectionStore.addConnection(log, walletAddress, connection);
    log.info(`addUserConnection walletAddress: ${walletAddress}}`);
    await sendAnalytics(
      {
        clientId: walletAddress,
        category: "Login",
        action: "Connected",
      },
      log,
    );
  }

  public async removeUserConnection(log: FastifyLoggerInstance, walletAddress: string) {
    log.info(`removeUserConnection connection walletAddress: ${walletAddress}`);
    await this.connectionStore.removeFromWaitingList(log, walletAddress);
    await this.connectionStore.deleteConnection(log, walletAddress);
    await sendAnalytics(
      {
        clientId: walletAddress,
        category: "Login",
        action: "Disconnected",
      },
      log,
    );
    return true;
  }

  public async updateWallet(
    log: FastifyLoggerInstance,
    walletAddress: string,
    wallet: WalletData,
    chainId: string,
  ): Promise<void> {
    log.info(`updating tokens for ${walletAddress}, chainId: ${chainId}`);
    await this.connectionStore.updateWalletData(log, walletAddress, wallet);
  }

  private async updateMatchCriteria(
    log: FastifyLoggerInstance,
    walletAddress: string,
    request: UpdateMatchCriteria,
  ): Promise<void> {
    await this.connectionStore.updateMatchCriteria(log, walletAddress, request.matchCriteria);
    log.info(`updateMatchCriteria ${JSON.stringify({ walletAddress, request })}`);
  }

  public async sendToWallet(log: FastifyLoggerInstance, walletAddress: string, message: EventMessage): Promise<void> {
    await this.connectionStore.sendToWallet(log, walletAddress, message);
  }

  private async forwardWebRTCNegotiation(log: FastifyLoggerInstance, request: WebRTCNegotiationRequest): Promise<void> {
    await this.connectionStore.sendToWallet(log, request.walletAddress, {
      data: JSON.stringify(request),
    });
  }

  public async selectTwoPeers(log: FastifyLoggerInstance, walletAddress: string): Promise<void> {
    const queueLength = await this.connectionStore.getWaitingListLength();
    log.info(`selectTwoPeers queueLength = ${queueLength}`);
    if (queueLength >= 2) {
      const pair = await this.connectionStore.findMatchingPair(log, walletAddress);

      // If no pair is found, skip.
      if (pair.length < 2) {
        log.info(`Not enough peers. Skip selection.`);
        return;
      }

      const matchedTokens = await this.connectionStore.getMatchedTokens(log, pair[0], pair[1]);
      log.info(`selected peers ${JSON.stringify(pair)}, matchedTokens: ${matchedTokens}`);
      const callerWalletAddress = pair[0];
      const calleeWalletAddress = pair[1];
      const callerWalletData = await this.connectionStore.getWalletData(log, callerWalletAddress);
      const calleeWalletData = await this.connectionStore.getWalletData(log, calleeWalletAddress);
      const callerAuthData = await this.connectionStore.getAuthenticatedUser(log, callerWalletAddress);
      const calleeAuthData = await this.connectionStore.getAuthenticatedUser(log, calleeWalletAddress);

      if (callerAuthData && calleeAuthData && callerWalletData && calleeWalletData) {
        log.info(
          `attempting chat for ${callerWalletAddress}: ${callerAuthData}, ${calleeWalletAddress}: ${calleeAuthData}`,
        );

        const chatId = randomUUID();
        const joinChatEvent: JoinChatEvent = {
          type: SignalingEventType.JoinChatEvent,
          chatId,
          participants: [callerWalletAddress, calleeWalletAddress],
          authRequest: [{ ...callerAuthData }, { ...calleeAuthData }],
        };
        const calleeCallersData: OtherParticipantTokensEvent = {
          type: SignalingEventType.OtherParticipantTokensEvent,
          walletAddress: callerAuthData.authRequestData.walletAddress,
          walletENS: callerWalletData.walletENS ?? "",
          allNFT: callerWalletData.allNFT ?? [],
          allERC20: callerWalletData.allERC20 ?? [],
          matchedNFTs: matchedTokens ?? [],
        };

        const callerCalleesData: OtherParticipantTokensEvent = {
          type: SignalingEventType.OtherParticipantTokensEvent,
          walletAddress: calleeAuthData.authRequestData.walletAddress,
          walletENS: calleeWalletData.walletENS ?? "",
          allNFT: calleeWalletData.allNFT ?? [],
          allERC20: calleeWalletData.allERC20 ?? [],
          matchedNFTs: matchedTokens ?? [],
        };

        await Promise.all([
          await this.connectionStore.sendToWallet(log, callerWalletAddress, { data: JSON.stringify(joinChatEvent) }),
          await this.connectionStore.sendToWallet(log, calleeWalletAddress, { data: JSON.stringify(joinChatEvent) }),

          await this.connectionStore.sendToWallet(log, callerWalletAddress, {
            data: JSON.stringify(callerCalleesData),
          }),
          await this.connectionStore.sendToWallet(log, calleeWalletAddress, {
            data: JSON.stringify(calleeCallersData),
          }),
        ]);

        log.info(
          `sent JoinChatEvent to: callerConnection: ${pair[0]}, calleeConnection: ${pair[1]}, event: ${JSON.stringify(
            joinChatEvent,
          )}`,
        );
      } else {
        log.warn(
          `One of the wallets on the waitlist is missing a connection: ${callerWalletAddress}: ${callerAuthData} ${callerWalletData} or ${calleeWalletAddress}: ${calleeAuthData} ${calleeWalletData}`,
        );
        if (callerAuthData) {
          log.info(`Returning ${callerWalletAddress}: ${callerAuthData} to the waitlist`);
          await this.connectionStore.enqueueToWaitingList(log, callerWalletAddress);
        }
        if (calleeAuthData) {
          log.info(`Returning ${calleeWalletAddress}: ${calleeAuthData} to the waitlist`);
          await this.connectionStore.enqueueToWaitingList(log, calleeWalletAddress);
        }
      }
    }
  }
}
