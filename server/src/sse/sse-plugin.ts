import { FastifyPluginAsync, FastifyReply } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { SsePluginOptions } from "./types";
import { serializeSSEEvent } from "./sse-event";

export const plugin: FastifyPluginAsync<SsePluginOptions> = async function (instance, options): Promise<void> {
  instance.decorateReply("sse", function (this: FastifyReply) {
    Object.entries(this.getHeaders()).forEach(([key, value]) => {
      if (value) {
        this.raw.setHeader(key, value);
      }
    });
    this.raw.setHeader("Content-Type", "text/event-stream");
    this.raw.setHeader("Cache-Control", "no-cache,no-transform");
    this.raw.setHeader("x-no-compression", 1);
    this.raw.write(serializeSSEEvent({ retry: options.retryDelay || 3000 }));
    const send = (event: EventMessage) =>
      new Promise<boolean>((resolve, reject) => {
        const result = this.raw.write(serializeSSEEvent(event), (error: Error | null | undefined) => {
          if (error) {
            reject(error);
          }
        });
        if (!result) {
          this.request.log.warn(`FastifyPluginAsync socket is full`);
          this.raw.once("drain", () => {
            this.request.log.warn(`FastifyPluginAsync socket drained`);
            resolve(true);
          });
        } else {
          resolve(true);
        }
      });
    const close = () => this.raw.write(serializeSSEEvent({ event: "end", data: "Stream closed" }));

    return { send, close };
  });
};

export const SSEPlugin = fastifyPlugin(plugin, {
  name: "sse",
  fastify: "3.x",
});

export interface EventMessage {
  id?: string;
  event?: string;
  data?: string;
  retry?: number;
}

declare module "fastify" {
  interface FastifyReply {
    sse(): {
      send: (event: EventMessage) => Promise<boolean>;
      close: () => boolean;
    };
  }
}

export default SSEPlugin;
