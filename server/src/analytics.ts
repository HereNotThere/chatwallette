import { FastifyLoggerInstance } from "fastify";
import { URLSearchParams } from "url";
import dotenv from "dotenv";
import findup from "findup-sync";
import https from "https";

export const SERVER_ID = "server";

const endpointConfig = {
  hostname: "www.google-analytics.com",
  port: 443,
  path: "/collect",
  method: "POST",
};

loadEnv();
const ANALYTICS_ID = process.env.ANALYTICS_ID;

export interface AnalyticsEvent {
  clientId: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
}

export async function sendAnalytics(log: FastifyLoggerInstance, event: AnalyticsEvent): Promise<void> {
  const request = new Promise<void>(resolve => {
    if (ANALYTICS_ID) {
      const params = new URLSearchParams();
      // Required.
      params.append("v", "1");
      params.append("t", "event");
      params.append("tid", ANALYTICS_ID);
      params.append("cid", event.clientId);
      params.append("ec", event.category);
      params.append("ea", event.action);
      // Optional.
      event.label && params.append("el", event.label);
      if (event.value !== undefined) {
        params.append("ev", event.value.toString());
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const req = https.request(endpointConfig, res => {
          // Done.
          res.read();
          resolve();
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        req.on("error", (error: any) => {
          log.error(error.message);
          // Ignore any exceptions
          resolve();
        });

        req.write(params.toString());
        req.end();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        log.error(`Cannot send analytics. Error: ${error.stack}`);
        // Ignore any exceptions
        resolve();
      }
    } else {
      // No op
      resolve();
    }
  });

  return request;
}

function loadEnv(): void {
  // Load dev environment variables.
  if (process.env.NODE_ENV !== "production") {
    const envFile = findup(".env");

    if (envFile) {
      dotenv.config({ path: envFile });
    }
  }
}
