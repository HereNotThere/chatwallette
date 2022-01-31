import IORedis from "ioredis";

import { EventMessage } from "./sse/sse-plugin";
//import debugLogger from "debug";
//debugLogger("ClientConnectionSignal");
const debug = console.log;

const redisHost = process.env.REDISHOST ?? "localhost";
const redisPort = parseInt(process.env.REDISPORT ?? "6379", 10);

export class ClientConnectionSignal {
  private publishClient: IORedis.Redis;
  private subscribeClient: IORedis.Redis | undefined;

  constructor() {
    const redisConfig: IORedis.RedisOptions = {
      port: redisPort,
      host: redisHost,
    };

    this.publishClient = new IORedis(redisConfig);
    this.publishClient
      .on("connect", () => {
        debug("connectionClient connect");
      })
      .on("ready", () => {
        debug("connectionClient ready");
      })
      .on("error", e => {
        debug("connectionClient ready", e);
      })
      .on("close", () => {
        debug("connectionClient close");
      })
      .on("reconnecting", () => {
        debug("connectionClient reconnecting");
      })
      .on("end", () => {
        debug("connectionClient end");
      });

    this.subscribeClient = new IORedis(redisConfig);
    this.subscribeClient
      .on("connect", () => {
        debug("subscribeClient connect");
      })
      .on("ready", () => {
        debug("subscribeClient ready");
      })
      .on("error", e => {
        debug("subscribeClient ready", e);
      })
      .on("close", () => {
        debug("subscribeClient close");
      })
      .on("reconnecting", () => {
        debug("subscribeClient reconnecting");
      })
      .on("message", async (channel: string, message: string) => {
        // NB messages can get re-ordered here, FIX
        await this.handleMessage(channel, message);
      })
      .on("end", () => {
        debug("subscribeClient end");
      });
    console.log(`ClientConnectionSignal redis connections opened `);
  }

  private subscriptions: { [walletAddress: string]: ((message: EventMessage) => Promise<boolean>) | undefined } = {};
  public async subscribe(walletAddress: string, send: (message: EventMessage) => Promise<boolean>) {
    if (this.subscribeClient) {
      this.subscriptions[walletAddress] = send;
      await this.subscribeClient.subscribe(walletAddress);
    }
  }

  public async unsubscribe(walletAddress: string) {
    if (this.subscribeClient) {
      await this.subscribeClient.unsubscribe(walletAddress);
      delete this.subscriptions[walletAddress];
    }
  }

  public async hasSubscription(walletAddress: string): Promise<boolean> {
    return walletAddress in this.subscriptions;
  }

  public async handleMessage(walletAddress: string, rawMessage: string) {
    const eventMessage: EventMessage = JSON.parse(rawMessage);
    const send = this.subscriptions[walletAddress];
    if (send) {
      await send(eventMessage);
    }
  }

  public async sendMessage(walletAddress: string, message: EventMessage) {
    if (this.publishClient) {
      await this.publishClient.publish(walletAddress, JSON.stringify(message));
    }
  }
}
