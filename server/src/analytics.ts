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

export async function sendAnalytics(event: AnalyticsEvent, logInstance?: FastifyLoggerInstance): Promise<void> {
  const promise = new Promise<void>(resolve => {
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
          logError(error.message, logInstance);
          // Ignore any exceptions
          resolve();
        });

        req.write(params.toString());
        req.end();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        logError(`Cannot send analytics. Error: ${error.stack}`, logInstance);
        // Ignore any exceptions
        resolve();
      }
    } else {
      // No op
      // To-do: remove this print line after confirming that
      // analytics is working in production.
      logInfo(`Analytics not sent. No tracking ID`, logInstance);
      resolve();
    }
  });

  return promise;
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

function logError(message: string, logInstance?: FastifyLoggerInstance): void {
  if (logInstance) {
    logInstance.error(message);
  } else {
    console.error(message);
  }
}

function logInfo(message: string, logInstance?: FastifyLoggerInstance): void {
  if (logInstance) {
    logInstance.info(message);
  } else {
    console.info(message);
  }
}
