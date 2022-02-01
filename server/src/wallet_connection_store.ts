import { Connection, UserAuthData, WalletData } from "./wallet_connection_types";

import { ClientConnectionSignal } from "./client_connection_signal";
import { EventEmitter } from "events";
import { EventMessage } from "./sse/sse-plugin";
import { FastifyLoggerInstance } from "fastify";
import IORedis from "ioredis";
import { MatchCriteria } from "../../protocol/signaling_types";
import { NFTResult } from "../../protocol/tokens";

const REDISHOST = process.env.REDISHOST ?? "localhost";
const REDISPORT = process.env.REDISPORT ?? "6379";

type WalletToConnection = { [walletAddress: string]: Connection | undefined };
type WalletToUserAuthData = { [walletAddress: string]: UserAuthData | undefined };
type WalletToWalletData = { [walletAddress: string]: WalletData | undefined };

interface WalletConnectionEvents {
  onchanged: (log: FastifyLoggerInstance, walletAddress: string) => void;
}

export interface WalletConnectionStore {
  on<U extends keyof WalletConnectionEvents>(event: U, listener: WalletConnectionEvents[U]): this;
  emit<U extends keyof WalletConnectionEvents>(event: U, ...args: Parameters<WalletConnectionEvents[U]>): boolean;
  addAuthenticatedUser(log: FastifyLoggerInstance, walletAddress: string, userAuthData: UserAuthData): Promise<void>;
  addConnection(log: FastifyLoggerInstance, walletAddress: string, connection: Connection): Promise<void>;
  deleteConnection(log: FastifyLoggerInstance, walletAddress: string): Promise<void>;
  enqueueToWaitingList(log: FastifyLoggerInstance, walletAddress: string): Promise<void>;
  findMatchingPair(log: FastifyLoggerInstance, walletAddress: string): Promise<string[]>;
  getAuthenticatedUser(log: FastifyLoggerInstance, walletAddress: string): Promise<UserAuthData | undefined>;
  getMatchedTokens(log: FastifyLoggerInstance, walletAddress1: string, walletAddress2: string): Promise<string[]>;
  getWaitingList(): Promise<string>; // Debug.
  getWaitingListLength(): Promise<number>;
  getWalletData(log: FastifyLoggerInstance, walletAddress: string): Promise<WalletData | undefined>;
  hasConnection(walletAddress: string): Promise<boolean>;
  removeAuthenticatedUser(log: FastifyLoggerInstance, walletAddress: string): Promise<void>;
  sendToWallet(log: FastifyLoggerInstance, walletAddress: string, message: EventMessage): Promise<void>;
  removeFromWaitingList(log: FastifyLoggerInstance, walletAddress: string): Promise<void>;
  updateExcludedTokens(excludedTokens: string[]): Promise<void>;
  updateMatchCriteria(log: FastifyLoggerInstance, walletAddress: string, matchCriteria: MatchCriteria): Promise<void>;
  updateWalletData(log: FastifyLoggerInstance, walletAddress: string, wallet: WalletData): Promise<void>;
}

class WalletConnectionStoreInMemory extends EventEmitter implements WalletConnectionStore {
  private waitingList: string[] = [];
  private isInQueue: Set<string> = new Set();
  private walletToConnection: WalletToConnection = {} as const;
  private walletToUserAuthData: WalletToUserAuthData = {} as const;
  private walletToWalletData: WalletToWalletData = {} as const;

  public async addAuthenticatedUser(log: FastifyLoggerInstance, walletAddress: string, userAuthData: UserAuthData) {
    this.walletToUserAuthData[walletAddress] = userAuthData;
  }

  public async getAuthenticatedUser(log: FastifyLoggerInstance, walletAddress: string) {
    return this.walletToUserAuthData[walletAddress];
  }

  public async removeAuthenticatedUser(log: FastifyLoggerInstance, walletAddress: string) {
    delete this.walletToUserAuthData[walletAddress];
  }

  public async addConnection(log: FastifyLoggerInstance, walletAddress: string, connection: Connection): Promise<void> {
    this.walletToConnection[walletAddress] = connection;
    this.emit("onchanged", log, walletAddress);
  }

  public async hasConnection(walletAddress: string): Promise<boolean> {
    return walletAddress in this.walletToConnection;
  }

  public async deleteConnection(log: FastifyLoggerInstance, walletAddress: string): Promise<void> {
    delete this.walletToConnection[walletAddress];
  }

  public async sendToWallet(log: FastifyLoggerInstance, walletAddress: string, message: EventMessage): Promise<void> {
    const connection = this.walletToConnection[walletAddress];
    if (connection) {
      await connection.send(message);
    }
  }

  public async enqueueToWaitingList(log: FastifyLoggerInstance, walletAddress: string): Promise<void> {
    if (!this.isInQueue.has(walletAddress)) {
      this.waitingList.push(walletAddress);
      this.isInQueue.add(walletAddress);
    }
    this.emit("onchanged", log, walletAddress);
  }

  public async updateWalletData(log: FastifyLoggerInstance, walletAddress: string, wallet: WalletData): Promise<void> {
    this.walletToWalletData[walletAddress] = wallet;
    this.emit("onchanged", log, walletAddress);
  }

  public async updateMatchCriteria(
    log: FastifyLoggerInstance,
    walletAddress: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    matchCriteria: MatchCriteria,
  ): Promise<void> {
    // Not implemented.
    this.emit("onchanged", log, walletAddress);
  }

  public async getWalletData(log: FastifyLoggerInstance, walletAddress: string): Promise<WalletData | undefined> {
    return this.walletToWalletData[walletAddress];
  }

  public async getMatchedTokens(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    log: FastifyLoggerInstance,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    walletAddress1: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    walletAddress2: string,
  ): Promise<string[]> {
    // not implemented
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async findMatchingPair(log: FastifyLoggerInstance, walletAddress: string): Promise<string[]> {
    const listLength = this.waitingList.length;
    let matchingPair: string[] = [];
    this.waitingList.some((currentItem, index) => {
      for (let i = index + 1; i < listLength; i++) {
        const nextItem = this.waitingList[i];
        if (currentItem === nextItem) {
          matchingPair = [currentItem, nextItem];
          break;
        }
      }
      return Boolean(matchingPair);
    });
    if (matchingPair.length === 2) {
      await Promise.all(matchingPair.map(async address => await this.removeFromWaitingList(log, address)));
      return matchingPair;
    } else {
      return [];
    }
  }

  public async getWaitingList(): Promise<string> {
    return this.waitingList.toString();
  }

  public async getWaitingListLength(): Promise<number> {
    return this.waitingList.length;
  }

  public async removeFromWaitingList(log: FastifyLoggerInstance, walletAddress: string): Promise<void> {
    const index = this.waitingList.indexOf(walletAddress);
    if (index > -1) {
      this.waitingList.splice(index, 1);
    }
    this.isInQueue.delete(walletAddress);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async updateExcludedTokens(excludedTokens: string[]): Promise<void> {
    // Not implemented
  }
}

export class WalletConnectionStoreRedis extends EventEmitter implements WalletConnectionStore {
  private redisClient: IORedis.Redis;
  private clientConnectionSignal = new ClientConnectionSignal();

  constructor() {
    super();
    const redisConfig: IORedis.RedisOptions = {
      port: parseInt(REDISPORT, 10),
      host: REDISHOST,
    };
    const redisClient = new IORedis(redisConfig);

    this.redisClient = redisClient;

    this.redisClient.defineCommand("enqueueToWaitingList", {
      numberOfKeys: 2,
      lua: `
        local waitingListKey = KEYS[1]
        local waitingListIsWaitingKey = KEYS[2]
        local walletAddress = ARGV[1]

        local isEnqueued = "false"

        -- Avoid adding duplicates.
        local isMember = redis.call("sismember", waitingListIsWaitingKey, walletAddress)
        if isMember == 0 then
          redis.call("sadd", waitingListIsWaitingKey, walletAddress)
          -- Add to the end of the queue
          redis.call("rpush", waitingListKey, walletAddress)
          isEnqueued = "true"
        end

        return {
          isEnqueued
        }
      `,
    });

    this.redisClient.defineCommand("findMatchingPair", {
      numberOfKeys: 3,
      lua: `
        local waitingListKey = KEYS[1]
        local waitingListIsWaitingKey = KEYS[2]
        local waitingListMatchRandomKey = KEYS[3]
        local walletAddress = ARGV[1]

        local removeFromQueue
        removeFromQueue = function (candidate)
          if candidate ~= false then
            -- delete any duplicates 
            redis.call("lrem", waitingListKey, 0, candidate)
            -- clear uniqueness flag
            redis.call("srem", waitingListIsWaitingKey, candidate)
          end
        end

        local getExcludeList
        getExcludeList = function (walletAddress)
          local matchCriteriaKey = "matchCriteria:"..walletAddress
          local excludeList = redis.call("hget", matchCriteriaKey, "excludeList")
          return excludeList
        end

        local isInExcludeList
        isInExcludeList = function (excludeList, checkAddress)
          -- @arg excludeList is the exclusion list
          -- @arg checkAddress is the address to check for exclusion.
          if excludeList ~= false then
            local i, j = string.find(excludeList, checkAddress)
            if i ~= nil and j ~= nil then
              return true
            else
              return false
            end
          end

          -- if the code reaches here, there is no exclude list.
          return false
        end
        
        local matchOnTokens
        matchOnTokens = function (pair1)
          -- Match based on tokens

          local pair1ExcludeList = getExcludeList(pair1)

          local candidates = redis.call("lrange", waitingListKey, 0, -1)
          for key,pair2 in pairs(candidates) do
            local pair2ExcludeList = getExcludeList(pair2)
            -- skip over yourself
            if pair2 ~= pair1 and
              isInExcludeList(pair1ExcludeList, pair2) == false and
              isInExcludeList(pair2ExcludeList, pair1) == false
            then
              -- find common tokens
              local t1 = "tokens:"..pair1
              local t2 = "tokens:"..pair2
              local tokens = redis.call("sinter", t1, t2)
              if table.getn(tokens) > 0 then
                local result = {}
                -- Found a match. Remove the pair from the waiting list.
                removeFromQueue(pair1)
                removeFromQueue(pair2)
                table.insert(result, pair1)
                table.insert(result, pair2)
                table.insert(result, "tokens")
                return result
              end
            end
          end
        
          -- If the code reaches here, we did not find a matching pair.
          return {}
        end
        
        local matchRandom
        matchRandom = function (pair1)
          -- Random match if the user said so

          local pair1ExcludeList = getExcludeList(pair1)

          local candidates = redis.call("smembers", waitingListMatchRandomKey)
          for key,pair2 in pairs(candidates) do
            local pair2ExcludeList = getExcludeList(pair2)

            -- skip over yourself
            if pair2 ~= pair1 and
              isInExcludeList(pair1ExcludeList, pair2) == false and
              isInExcludeList(pair2ExcludeList, pair1) == false
            then
              local result = {}
              -- Found a match. Remove the pair from the waiting list.
              removeFromQueue(pair1)
              removeFromQueue(pair2)
              -- clear random flags for both pairs
              redis.call("srem", waitingListMatchRandomKey, pair1, pair2)
              table.insert(result, pair1)
              table.insert(result, pair2)
              table.insert(result, "random")
              return result
            end  
          end
          
          -- If the code reaches here, we did not find a matching pair.
          return {}
        end

        -- main
        local isWaiting = redis.call("sismember", waitingListIsWaitingKey, walletAddress)

        if isWaiting == 1 then
          local isRandom = redis.call("sismember", waitingListMatchRandomKey, walletAddress)
          
          if isRandom == 1 then
            return matchRandom(walletAddress)
          else
            return matchOnTokens(walletAddress)
          end
        end
        
        return {}
      `,
    });

    void (async () => {
      await redisClient.info();
      console.log(`WalletConnectionStoreRedis redis connection is opened`);
    })();
  }

  public async addAuthenticatedUser(log: FastifyLoggerInstance, walletAddress: string, userAuthData: UserAuthData) {
    const userAuthKey = StoreKeys.getUserAuthKey(walletAddress);
    await this.redisClient.set(userAuthKey, JSON.stringify(userAuthData));
  }

  public async getAuthenticatedUser(log: FastifyLoggerInstance, walletAddress: string) {
    const userAuthKey = StoreKeys.getUserAuthKey(walletAddress);
    const value = await this.redisClient.get(userAuthKey);
    if (value) {
      return JSON.parse(value);
    }
  }

  public async removeAuthenticatedUser(log: FastifyLoggerInstance, walletAddress: string) {
    const userAuthKey = StoreKeys.getUserAuthKey(walletAddress);
    const userWalletKey = StoreKeys.getWalletKey(walletAddress);
    const userTokensKey = StoreKeys.getTokensKey(walletAddress);
    const matchCriteriaKey = StoreKeys.getMatchCriteriaKey(walletAddress);

    await this.redisClient.multi().del(userAuthKey).del(userWalletKey).del(userTokensKey).del(matchCriteriaKey).exec();
  }

  public async sendToWallet(log: FastifyLoggerInstance, walletAddress: string, message: EventMessage): Promise<void> {
    return await this.clientConnectionSignal.sendMessage(walletAddress, message);
  }

  public async addConnection(log: FastifyLoggerInstance, walletAddress: string, connection: Connection): Promise<void> {
    await this.clientConnectionSignal.subscribe(walletAddress, connection.send);
    // Subscribe for this walletAddress
    log.info(`set connection for wallet ${walletAddress}`);
    this.emit("onchanged", log, walletAddress);
  }

  public async hasConnection(walletAddress: string): Promise<boolean> {
    return await this.clientConnectionSignal.hasSubscription(walletAddress);
  }

  public async deleteConnection(log: FastifyLoggerInstance, walletAddress: string): Promise<void> {
    await this.clientConnectionSignal.unsubscribe(walletAddress);
  }

  public async updateWalletData(
    log: FastifyLoggerInstance,
    walletAddress: string,
    walletData: WalletData,
  ): Promise<void> {
    // Store the serialized version of the wallet.
    const walletKey = StoreKeys.getWalletKey(walletAddress);
    const tokensKey = StoreKeys.getTokensKey(walletAddress);

    // Start a transaction.
    const multi = this.redisClient.multi();

    if (multi) {
      multi.set(walletKey, JSON.stringify(walletData));

      // Delete any old tokens data
      multi.del(tokensKey);

      // Set the updated tokens.
      walletData.allNFT?.forEach((nft: NFTResult) => {
        multi.sadd(tokensKey, nft.token_address);
      });

      // Execute the transaction.
      try {
        await multi.exec();
        this.emit("onchanged", log, walletAddress);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        log.error(`Failed to update tokens. Error: ${e.stack}`);
      }
    }
  }

  public async getWalletData(log: FastifyLoggerInstance, walletAddress: string): Promise<WalletData | undefined> {
    const walletKey = StoreKeys.getWalletKey(walletAddress);
    const value = await this.redisClient.get(walletKey);
    if (value) {
      return JSON.parse(value);
    }
  }

  public async getMatchedTokens(
    log: FastifyLoggerInstance,
    walletAddress1: string,
    walletAddress2: string,
  ): Promise<string[]> {
    const t1Key = StoreKeys.getTokensKey(walletAddress1);
    const t2Key = StoreKeys.getTokensKey(walletAddress2);
    const matchedTokens = await this.redisClient.sinter(t1Key, t2Key);
    return matchedTokens;
  }

  public async updateMatchCriteria(
    log: FastifyLoggerInstance,
    walletAddress: string,
    matchCriteria: MatchCriteria,
  ): Promise<void> {
    // Store the serialized version of the wallet.
    const matchCriteriaKey = StoreKeys.getMatchCriteriaKey(walletAddress);

    try {
      const excluseList = JSON.stringify(matchCriteria.excludeList).toLowerCase();
      const multi = this.redisClient.multi();
      if (multi) {
        multi.hset(matchCriteriaKey, "matchTokens", matchCriteria.matchTokens.toString(), "excludeList", excluseList);
        if (matchCriteria.matchTokens) {
          multi.srem(StoreKeys.waitingListMatchRandomKey, walletAddress);
        } else {
          multi.sadd(StoreKeys.waitingListMatchRandomKey, walletAddress);
        }

        await multi.exec();
      }
      log.info(`updated match criteria for wallet ${walletAddress}}, matchCriteria: ${JSON.stringify(matchCriteria)}`);
      this.emit("onchanged", log, walletAddress);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      log.error(
        `Failed to update match critria for wallet ${walletAddress}, matchCriteria: ${JSON.stringify(
          matchCriteria,
        )}. Error: ${e.stack}`,
      );
    }
  }

  public enqueueToWaitingList(log: FastifyLoggerInstance, walletAddress: string): Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lua = this.redisClient as any;
        if (lua?.enqueueToWaitingList) {
          lua.enqueueToWaitingList(
            StoreKeys.waitingListKey,
            StoreKeys.waitingListIsWaitingKey,
            walletAddress,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (err: any, result: any) => {
              log.info(`enqueued ${walletAddress} ${result}`);

              if (err) {
                reject(err);
              } else {
                resolve();
                this.emit("onchanged", log, walletAddress);
              }
            },
          );
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        log.error(`Cannot enqueue ${walletAddress} to waiting list. Error: ${e.stack}`);
        reject(e);
      }
    });

    return promise;
  }

  public async removeFromWaitingList(log: FastifyLoggerInstance, walletAddress: string): Promise<void> {
    try {
      await this.redisClient
        ?.multi()
        .lrem(StoreKeys.waitingListKey, 0, walletAddress)
        .srem(StoreKeys.waitingListIsWaitingKey, walletAddress)
        .srem(StoreKeys.waitingListMatchRandomKey, walletAddress)
        .exec();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      log.error(`Cannot remove ${walletAddress} from waiting list. Error: ${e.message}, stack: ${e.stack}`);
    }
  }

  public async findMatchingPair(log: FastifyLoggerInstance, walletAddress: string): Promise<string[]> {
    const matchPromise = new Promise<string[]>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lua = this.redisClient as any;
      if (lua?.findMatchingPair) {
        lua.findMatchingPair(
          StoreKeys.waitingListKey,
          StoreKeys.waitingListIsWaitingKey,
          StoreKeys.waitingListMatchRandomKey,
          walletAddress,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (err: any, result: string[]) => {
            if (result) {
              log.info(`findMatchingPair result: ${result}`);
            } else {
              log.info("findMatchingPair nil result");
            }

            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          },
        );
      }
    });
    return matchPromise;
  }

  public async getWaitingList(): Promise<string> {
    const values = await this.redisClient.lrange(StoreKeys.waitingListKey, 0, -1);
    return values?.toString() ?? "";
  }

  public async getWaitingListLength(): Promise<number> {
    return (await this.redisClient.llen(StoreKeys.waitingListKey)) ?? 0;
  }

  public async updateExcludedTokens(excludedTokens: string[]): Promise<void> {
    const excludedTokensKey = StoreKeys.tokensExcludedKey;
    const multi = this.redisClient.multi();
    if (multi) {
      multi.del(excludedTokensKey);

      for (const t of excludedTokens) {
        multi.sadd(excludedTokensKey, t);
      }

      try {
        await multi.exec();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        console.error(`Unable to update excluded tokens list. Error: ${e.stack}`);
      }
    }
  }
}

class StoreKeys {
  static tokensExcludedKey = "tokens:excluded" as const;
  static waitingListKey = "waitingList" as const;
  static waitingListIsWaitingKey = "waitingList:isWaiting" as const;
  static waitingListMatchRandomKey = "waitingList:matchRandom" as const;

  static getWalletKey(walletAddress: string): string {
    return `wallet:${walletAddress}`;
  }

  static getMatchCriteriaKey(walletAddress: string): string {
    return `matchCriteria:${walletAddress}`;
  }

  static getTokensKey(walletAddress: string): string {
    return `tokens:${walletAddress}`;
  }

  static getUserAuthKey(walletAddress: string): string {
    return `userAuth:${walletAddress}`;
  }
}

export async function getConnectionStore(): Promise<WalletConnectionStore> {
  try {
    const redisConfig: IORedis.RedisOptions = {
      port: parseInt(REDISPORT, 10),
      host: REDISHOST,
      retryStrategy: function () {
        return null;
      },
    };
    const testRedisClient = new IORedis(redisConfig);
    const pong = await testRedisClient.ping();
    if (pong === "PONG") {
      console.log(`Using redis wallet connection store.`);
      return new WalletConnectionStoreRedis();
    } else {
      testRedisClient?.disconnect();
      console.log("Defaulting to in-memory wallet connection store.");

      return new WalletConnectionStoreInMemory();
    }
  } catch (err) {
    console.log("Defaulting to in-memory wallet connection store.");

    return new WalletConnectionStoreInMemory();
  }
}
