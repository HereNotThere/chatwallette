import { install } from "source-map-support";
install();
import process from "process";
import fs from "fs";
import path from "path";

import http2 from "http2";
const {
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_STATUS,
  HTTP2_HEADER_CONTENT_LENGTH,
  HTTP2_HEADER_CONTENT_TYPE,
} = http2.constants;

import { https } from "follow-redirects";

import { URL } from "url";

import Fastify, { FastifyLoggerInstance, FastifyReply } from "fastify";

import keccak256 from "keccak256";
import findup from "findup-sync";
import dotenv from "dotenv";

import { staticServe } from "fastify-auto-push-v3";
import fastifyCookie from "fastify-cookie";
import fastifyCors from "fastify-cors";
import { Static, Type } from "@sinclair/typebox";
import { SSEPlugin } from "./sse/sse-plugin";
import { WebRTCSignalingServer } from "./web_rtc_signaling_server";
import { signalingEvents, signalingRequest } from "../../protocol/web_rtc_signaling_common";
import { authCookieName, AuthRequestWalletData } from "../../protocol/auth";

import crypto from "crypto";

import { bufferToHex, ecrecover, fromRpcSig, pubToAddress, hashPersonalMessage } from "ethereumjs-util";
import stringify from "fast-json-stable-stringify";

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import * as gcpMetadata from "gcp-metadata";
import { isSignalingRequest, SignalingEventType } from "../../protocol/signaling_types";
import { getConnectionStore } from "./wallet_connection_store";
import { Connection } from "./wallet_connection_types";
import { getSubspaceClient } from "./subspace";
import { getMoralisClient, MoralisClient } from "./moralis";

if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const envFile = findup(".env");

  if (envFile) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const envConfig = dotenv.config({ path: envFile });
    if (!envConfig.error) {
      console.log(`loaded environment from dotenv ${envFile}`);
    } else {
      console.error(`error loading .env file ${envFile} ${envConfig.error}`);
    }
  } else {
    console.warn(`no .env file found`);
  }
}

export function isError(err: unknown): err is Error {
  return typeof err === "object" && err instanceof Error;
}

const WalletNotProvided = {
  data: JSON.stringify({ type: SignalingEventType.WalletNotProvided }),
};

/**
 * Get the MORALIS_API_KEY assumes this process is running with Secret Manager Accessor rights to
 * /secrets/MORALIS_API_KEY
 * @returns MORALIS_API_KEY value or undefined if there's no access
 */
async function getMoralisApiKey() {
  const apiKey = await getSecretByName("MORALIS_API_KEY");
  if (!apiKey) {
    const key = process.env.MORALIS_API_KEY;
    console.warn(`MORALIS_API_KEY not set, using process.env.MORALIS_API_KEY: ${key}`);
    return key;
  }
  return apiKey;
}

/**
 * Get the AUTH_COOKIE_SECRET assumes this process is running with Secret Manager Accessor rights to
 * /secrets/AUTH_COOKIE_SECRET
 * @returns AUTH_COOKIE_SECRET or "DUMMY_SECRET" if there's no access
 */
async function getAuthCookieSecret() {
  const cookieSecret = await getSecretByName("AUTH_COOKIE_SECRET");
  if (!cookieSecret) {
    console.warn(`AUTH_COOKIE_SECRET not set, using 'DUMMY_SECRET' to sign cookies`);
    return "DUMMY_SECRET";
  } else {
    return cookieSecret;
  }
}

/**
 * Get the SUBSPACE_API_KEY assumes this process is running with Secret Manager Accessor rights to
 * /secrets/SUBSPACE_API_KEY
 * @returns SUBSPACE_API_KEY value or undefined if there's no access
 */
async function getSubspaceApiKey() {
  const clientId = await getSecretByName("SUBSPACE_CLIENT_ID");
  const clientSecret = await getSecretByName("SUBSPACE_CLIENT_SECRET");
  if (!(clientId && clientSecret)) {
    const clientId = process.env.SUBSPACE_CLIENT_ID;
    const clientSecret = process.env.SUBSPACE_CLIENT_SECRET;
    console.warn(
      `SUBSPACE_API_KEY not set, using process.env.SUBSPACE_CLIENT_ID and : SUBSPACE_CLIENT_SECRET ${{
        clientId,
        clientSecret,
      }}`,
    );
    return { clientId, clientSecret };
  }
  return { clientId, clientSecret };
}

// Couldn't fugure out how to import typs from got
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllWalletAssets(
  log: FastifyLoggerInstance,
  moralisClient: MoralisClient,
  walletAddress: string,
  chainId: string,
) {
  /*
  curl -X 'GET' \
  'https://deep-index.moralis.io/api/v2/nft/0xCb9135b71E2b84302DF3c17eE2a02e5dbD01a129?chain=eth&format=hex' \
  -H 'accept: application/json' \
  -H 'X-API-Key: IZjEOgJjABGsqv3EFfpxf3uk3pWCcoKief2bZco2ugMtmNOzxxCasmUY7vELNU6f'
  */
  try {
    const [allNFT, allERC20, walletENS] = await Promise.all([
      moralisClient.getNFT(log, walletAddress, chainId),
      moralisClient.getEC20(log, walletAddress, chainId),
      moralisClient.getENS(log, walletAddress, chainId),
    ]);

    return { allNFT, allERC20, walletENS };
  } catch (err) {
    if (isError(err)) {
      log.info(`fetchAllWalletAssets failed ${err.message} ${walletAddress} ${chainId} `);
    }
    return { allNFT: [], allERC20: [], walletENS: null };
  }
}

/**
 * Get the latest secret stored at keyName. Assumes this process is running with Secret Manager Accessor
 * rights to /secrets/${keyName}
 * @param keyName
 * @returns secret
 */
async function getSecretByName(keyName: string) {
  try {
    const project = "projects/792563773988";
    const secretName = `${project}/secrets/${keyName}`;
    const secretClient = new SecretManagerServiceClient();

    const [authCookieSecretVersion] = await secretClient.accessSecretVersion({
      name: secretName + "/versions/latest",
    });

    const secret = authCookieSecretVersion?.payload?.data?.toString().trim();

    if (!secret) {
      console.warn(`${keyName} not set`);
    } else {
      console.log(`${keyName} fetched from secret manager`);
    }
    return secret ?? undefined;
  } catch (err) {
    if (isError(err)) {
      console.warn(`${keyName} API failed ${err.message}`);
    } else {
      console.warn(`${keyName} API failed, err not Error ${JSON.stringify(err)}`);
    }
    return undefined;
  }
}

const walletToAuthRequestWalletData: {
  [walletAddress: string]: AuthRequestWalletData | undefined;
} = {} as const;

process.on("uncaughtException", (err, origin) => {
  fs.writeSync(
    process.stderr.fd,
    `Caught exception: ${JSON.stringify({ name: err.name, message: err.message, stack: err.stack })}\n` +
      `Exception origin: ${origin}`,
  );
});

process.on("exit", code => {
  console.log(`process exiting ${code}`);
});

async function getGcpMetadata() {
  try {
    console.log(`checking if gcpMetadata isAvailable ${JSON.stringify(gcpMetadata)}`);
    const gcpMetadataIsAvailable = await gcpMetadata.isAvailable();

    if (gcpMetadataIsAvailable) {
      // grab all top level metadata from the service
      const instanceMetadata = await gcpMetadata.instance();
      console.log(`instanceMetadata ${JSON.stringify(instanceMetadata)}`);
      const instanceId = await gcpMetadata.instance("id");
      const region = await gcpMetadata.instance("region");
      const serviceAccounts = await gcpMetadata.instance("service-accounts");
      const zone = await gcpMetadata.instance("zone");
      const numericProjectId = await gcpMetadata.project("numeric-project-id");
      const projectId = await gcpMetadata.project("project-id");

      const result = { instanceId, region, serviceAccounts, zone, projectId, numericProjectId };
      console.log(`gcpMetadata ${JSON.stringify(result)}`);
      return result;
    }
  } catch (err) {
    if (isError(err)) {
      console.log(`getGcpMetadata error ${err.message}`);
    }
  }
  return false;
}
const start = async () => {
  // For development, Next.JS serves the client from port 3000, so this server will run on 3001.
  // In production this server serves the static Next.JS code as well as the other API.
  const port = (process.env.PORT && parseInt(process.env.PORT, 10)) ?? 3001;

  const walletConnectionStore = await getConnectionStore();
  const signalingServer = new WebRTCSignalingServer(walletConnectionStore);

  const [moralisApiKey, subspaceApiKey, gcpMetadata] = await Promise.all([
    getMoralisApiKey(),
    getSubspaceApiKey(),
    getGcpMetadata(),
  ]);

  const subspaceClient =
    subspaceApiKey.clientId && subspaceApiKey.clientSecret ? getSubspaceClient(subspaceApiKey) : undefined;
  const moralisClient: MoralisClient | undefined = moralisApiKey
    ? getMoralisClient("https://deep-index.moralis.io", moralisApiKey)
    : undefined;

  /**
   * If localhost certs were made using `mkcert localhost`, then use them in the development
   * environment so the client running in the Browser can talk to the server.
   *
   * In production HTTPS is terminated at the edge and our server
   * runs without HTTPS.
   */
  const localCerts =
    fs.existsSync(path.join(process.cwd(), "..", "localhost-key.pem")) &&
    fs.existsSync(path.join(process.cwd(), "..", "localhost.pem"));
  const httpsCerts = localCerts
    ? {
        key: fs.readFileSync(path.join(process.cwd(), "..", "localhost-key.pem")),
        cert: fs.readFileSync(path.join(process.cwd(), "..", "localhost.pem")),
      }
    : undefined;

  const fastify = Fastify({
    rewriteUrl: function rewriteUrl(req) {
      switch (req.url) {
        case "/tos":
          return "/tos.html";
        case "/chat":
          return "/chat.html";
        default:
          return req.url;
      }
    },
    http2: true,
    logger: {
      serializers: {
        res(reply) {
          // The default
          return {
            statusCode: reply.statusCode,
          };
        },
        req(request) {
          return {
            method: request.method,
            url: request.url,
            path: request.routerPath,
            parameters: request.params,
            ...{ gcpInstanceId: gcpMetadata ? gcpMetadata.instanceId : undefined },
          };
        },
      },
    },
    ...{ https: localCerts ? httpsCerts : undefined },
  });

  if (localCerts) {
    await fastify.register(fastifyCors, { origin: "https://localhost:3000", credentials: true });
  }

  if (fs.existsSync(path.join(process.cwd(), "out"))) {
    // serve static next.js files
    await fastify.register(staticServe, {
      root: path.join(process.cwd(), "out"),
    });
  }

  const CorsRequest = Type.Object({
    tokenUrlEncoded: Type.String(),
  });
  type CorsRequestType = Static<typeof CorsRequest>;

  const proxyRequestV1 = (
    log: FastifyLoggerInstance,
    url: URL,
    reply: FastifyReply<
      http2.Http2Server,
      http2.Http2ServerRequest,
      http2.Http2ServerResponse,
      {
        Querystring: CorsRequestType;
      },
      unknown
    >,
  ) =>
    new Promise<void>((resolve, reject) => {
      https
        .get(url, res => {
          const status = res.statusCode ?? 500;
          const resHeaders = res.headers;
          res.on("error", error => {
            log.error(`v1 req.error Unable to fetch ${url.href} message: ${error.message}`);
            reject(error);
          });
          const contentLength = resHeaders[HTTP2_HEADER_CONTENT_LENGTH];
          const contentType = resHeaders[HTTP2_HEADER_CONTENT_TYPE];
          if (status >= 200 && status <= 299) {
            reply.raw.writeHead(200, {
              ...{ "access-control-allow-credentials": localCerts ? "true" : undefined },
              ...{ "access-control-allow-origin": localCerts ? "https://localhost:3000" : undefined },
              "Cache-Control": "max-age=31536000",
              "Content-Length": contentLength,
              "Content-Type": contentType,
            });

            res.on("data", chunk => {
              try {
                reply.raw.write(chunk);
              } catch (error) {
                if (isError(error)) {
                  log.error(`v1 req on data ${error.message}`);
                }
              }
            });
            res.on("error", error => {
              log.error(`v1 on error ${error.message}`);
              reject(error);
            });
            res.on("end", () => {
              resolve();
            });
          } else {
            log.error(`v1 Unable to fetch ${url.href} status: ${status}`);
            reject(new Error(`Http Error: status ${status}`));
          }
        })
        .on("error", error => {
          log.error(`v1 client.error Unable to fetch ${url.href} message: ${error.message}`);
          reject(error);
        });
    });

  const proxyRequestV2 = (
    log: FastifyLoggerInstance,
    url: URL,
    reply: FastifyReply<
      http2.Http2Server,
      http2.Http2ServerRequest,
      http2.Http2ServerResponse,
      {
        Querystring: CorsRequestType;
      },
      unknown
    >,
  ) =>
    new Promise<void>((resolve, reject) => {
      try {
        const client = http2.connect(url.origin);
        client.on("error", error => {
          log.error(`v2 client.error Unable to fetch ${url.href} message: ${error.message}`);
          reject(error);
        });
        const reqHeaders: http2.OutgoingHttpHeaders = {
          [HTTP2_HEADER_METHOD]: "GET",
          accept: "*/*",
          [HTTP2_HEADER_PATH]: url.pathname + url.search,
        };
        const req = client.request(reqHeaders);

        req.setEncoding("utf-8");
        req.on("error", error => {
          log.error(`v2 req.error Unable to fetch ${url.href} message: ${error.message}`);
          reject(error);
        });
        req.on("response", resHeaders => {
          try {
            const contentLength = resHeaders[HTTP2_HEADER_CONTENT_LENGTH];
            const status = Number(resHeaders[HTTP2_HEADER_STATUS]);
            const contentType = resHeaders[HTTP2_HEADER_CONTENT_TYPE];
            if (status >= 200 && status <= 299) {
              reply.raw.writeHead(200, {
                ...{ "access-control-allow-credentials": localCerts ? "true" : undefined },
                ...{ "access-control-allow-origin": localCerts ? "https://localhost:3000" : undefined },
                "Cache-Control": "max-age=31536000",
                "Content-Length": contentLength,
                "Content-Type": contentType,
              });

              req.on("data", chunk => {
                try {
                  reply.raw.write(chunk);
                } catch (error) {
                  if (isError(error)) {
                    log.error(`v2 req on data ${error.message}`);
                  }
                }
              });

              req.once("end", () => {
                reply.sent = true;
                reply.raw.end();
                resolve();
              });
            } else {
              log.error(`v2 Unable to fetch ${url.href} status: ${status}`);
              reject(new Error(`Http Error: status ${status}`));
            }
          } catch (error) {
            if (isError(error)) {
              log.error(`v2 on respose message: ${error.message}`);
            }
            reject(error);
          }
        });
        req.end();
      } catch (err) {
        if (isError(err)) {
          log.error(`v2 Unable to fetch ${url.href} status: ${err.message}`);
        }
        reject(err);
      }
    });

  fastify.get<{
    Querystring: CorsRequestType;
  }>("/cors", async function (request, reply) {
    const authCookie = hasValidAuthCookie(request);
    if (authCookie) {
      try {
        const tokenUrlEncoded = request.query["tokenUrlEncoded"];
        const tokenUrl = Buffer.from(tokenUrlEncoded, "base64url").toString();
        const url = new URL(tokenUrl);
        try {
          await proxyRequestV2(request.log, url, reply);
        } catch (err) {
          if (isError(err) && err.message === "Protocol error") {
            await proxyRequestV1(request.log, url, reply);
          } else {
            throw err;
          }
        }
        return reply;
      } catch (err) {
        if (isError(err)) {
          request.log.warn(`Failed fetching message: ${err.message}`);
        }
        return reply.status(404).send();
      }
    } else {
      return reply.status(401).send();
    }
  });

  const authCookieSecret = await getAuthCookieSecret();
  await fastify.register(fastifyCookie, {
    secret: authCookieSecret, // for cookies signature
  });

  await fastify.register(SSEPlugin);

  const GetSessionId = Type.Object({
    chainId: Type.String(),
    walletAddress: Type.String(),
    nonce: Type.String(),
  });
  type GetSessionIdType = Static<typeof GetSessionId>;

  fastify.get<{
    Querystring: GetSessionIdType;
  }>(
    "/auth",
    {
      schema: {
        querystring: GetSessionId,
      },
    },
    async function (request, reply) {
      const authCookie = request.cookies[authCookieName];
      request.log.info(`start /auth GET ${authCookieName} ${JSON.stringify(authCookie)}`);
      const sessionId = crypto.randomBytes(16).toString("base64url");
      const { chainId, walletAddress: rawWalletAddress, nonce } = request.query;

      const walletAddress = rawWalletAddress.toLowerCase();
      if (moralisClient) {
        try {
          // HACK - using Snoop's wallet, he has a lot of NFT
          // const snoopWallet = "0xce90a7949bb78892f159f428d0dc23a8e3584d75";

          const walletData = await fetchAllWalletAssets(request.log, moralisClient, walletAddress, chainId);
          await signalingServer.updateWallet(request.log, walletAddress, walletData, chainId);
          const authRequestData = {
            chainId,
            sessionId,
            nonce,
            allNFT: walletData.allNFT,
            allERC20: walletData.allERC20,
            walletENS: walletData.walletENS,
          };
          walletToAuthRequestWalletData[walletAddress] = authRequestData;

          request.log.info(`authRequestData for wallet ${walletAddress} on chainId: ${chainId}`);

          return authRequestData;
        } catch (err) {
          if (isError(err)) {
            request.log.error(`failed fetch tokens ${err.message}`);
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            request.log.error(`failed fetch tokens unknown ${(err as any).message}`);
          }
        }
      } else {
        request.log.warn(`no moralisClient ${moralisApiKey} ${moralisClient}`);
      }

      return reply.status(400).send();
    },
  );

  const PostAuth = Type.Object({
    message: Type.String(),
    signature: Type.String(),
    authRequestData: Type.Object({
      walletAddress: Type.String(),
      chainId: Type.String(),
      nonce: Type.String(),
      sessionId: Type.String(),
      publicKey: Type.String(),
      screenName: Type.String(),
    }),
  });
  type PostAuthType = Static<typeof PostAuth>;

  fastify.post<{ Body: PostAuthType }>(
    "/auth",
    { schema: { body: PostAuth, response: { 200: PostAuth } } },
    async function (request, reply) {
      request.log.info(`start /auth POST`);

      const { authRequestData, message, signature } = request.body;
      const { walletAddress: rawWalletAddress, nonce, sessionId } = authRequestData;

      const walletAddress = rawWalletAddress.toLowerCase();
      const hash = keccak256(stringify(authRequestData)).toString("base64");

      const { v, r, s } = fromRpcSig(signature);

      const pubKey = ecrecover(hashPersonalMessage(Buffer.from(message)), v, r, s);
      const addrBuf = pubToAddress(pubKey);
      const signingWalletAddress = bufferToHex(addrBuf).toLowerCase();
      const hashFromMessage = message.split(`\n`).pop()?.match("Hash:\\s(\\S*)")?.pop();

      if (hash !== hashFromMessage || signingWalletAddress !== walletAddress) {
        request.log.warn(
          `hashes or wallets don't match ${JSON.stringify({
            hash,
            hashFromMessage,
            hashMatch: hash !== hashFromMessage,
            signingWalletAddress,
            walletAddress,
            walletAddressMatch: signingWalletAddress !== walletAddress,
          })}`,
        );
        return reply.status(401).send();
      }

      request.log.info(`start /auth POST hashes and wallets match`);
      // Check to see if this well formed request matches the nonce and sessionId we've issued
      const authRequestWalletData = walletToAuthRequestWalletData[walletAddress];

      if (authRequestData && authRequestWalletData) {
        if (nonce !== authRequestData.nonce || sessionId !== authRequestData.sessionId) {
          request.log.warn(
            `nonce or sessionId don't match ${JSON.stringify({
              nonce,
              sessionId,
              sessionData: authRequestData,
            })}`,
          );
          return reply.status(401).send();
        } else {
          request.log.info(`start /auth POST hashes and wallets and nonce match`);

          // At this point this is a valid auth request
          // Check if another client is connected, sign it out, and make this the new client
          delete walletToAuthRequestWalletData[walletAddress];
          request.log.info(`start /auth POST before addAuthenticatedUser`);
          await signalingServer.addAuthenticatedUser(request.log, walletAddress, {
            message,
            signature,
            authRequestData,
          });
          request.log.info(`start /auth POST after addAuthenticatedUser`);

          const { chainId } = authRequestData;

          request.log.info(`start /auth POST before updateWallet`);
          await signalingServer.updateWallet(request.log, walletAddress, authRequestWalletData, chainId);
          request.log.info(`start /auth POST after updateWallet`);

          request.log.info(`/auth POST ${authCookieName} ${JSON.stringify({ walletAddress, chainId, sessionId })}`);
          // TODO
          // if (authCookie) signout user from other client

          // Now set the new cookie
          // fastify-cookie setCookie is sync, so don't await the result
          void reply.setCookie(authCookieName, JSON.stringify({ walletAddress, chainId, sessionId }), {
            sameSite: "strict",
            secure: true,
            signed: true,
            httpOnly: true,
          });

          request.log.info(`after /auth POST setCookie`);
          return reply.status(200).send();
        }
      }

      // If code reaches here, auth did not succeed.
      request.log.warn(
        `authRequestData or authRequestWalletData is undefined ${JSON.stringify({
          // hide auth data.
          authRequestData: authRequestData ? "[object]" : "undefined",
          authRequestWalletData: authRequestWalletData ? "[object]" : "undefined",
        })}`,
      );
      // Always return a status.
      return reply.status(401).send();
    },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fastify.delete("/auth", async (request: any, reply: any) => {
    const authCookie = hasValidAuthCookie(request);
    if (authCookie) {
      const { walletAddress } = JSON.parse(authCookie);
      await signalingServer.removeAuthenticatedUser(request.log, walletAddress);

      request.log.info(
        `/auth DELETE ${authCookieName} ${JSON.stringify(request.cookies[authCookieName])} ${authCookie}`,
      );
      // fastify-cookie clearCookie is sync, so don't await the result
      void reply.clearCookie(authCookieName);
    }
    return reply.status(200).send();
  });

  fastify.get("/iceservers", async function (request, reply) {
    const authCookie = hasValidAuthCookie(request);
    if (authCookie && subspaceClient) {
      const iceServers = await subspaceClient(request.log);
      return { iceServers };
    } else {
      return reply.status(401).send();
    }
  });

  fastify.get(signalingEvents, async (request, reply): Promise<FastifyReply> => {
    try {
      const authCookie = hasValidAuthCookie(request);
      const { send, close } = reply.sse();

      if (authCookie) {
        const { walletAddress } = JSON.parse(authCookie);

        if (walletAddress) {
          const connection: Connection = {
            send,
            close,
          };

          await signalingServer.addUserConnection(request.log, walletAddress, connection);

          request.raw.on("close", async () => {
            await signalingServer.removeUserConnection(request.log, walletAddress);
            request.log.info(`recevied signalingEvents close`);
          });
        } else {
          await send(WalletNotProvided);
          request.log.error(`No walletAddress found walletAddress: ${walletAddress}`);
        }
      } else {
        request.log.warn(`fastify.get !authCookie.valid && authCookie.value ${JSON.stringify(authCookie)}`);
        await send(WalletNotProvided);
        request.log.error(`No walletAddress found`);
      }
    } finally {
      request.log.info(`signalingEvents done`);
    }
    // This silences a warning in Fastify that doesn't apply to SSE
    reply.sent = true;

    return reply;
  });

  //let testingCounter = 0;
  const SignalingBody = Type.Object({
    type: Type.String(),
  });
  type SignalingBodyType = Static<typeof SignalingBody>;

  fastify.post<{ Body: SignalingBodyType }>(signalingRequest, async function (request, reply) {
    const authCookie = hasValidAuthCookie(request);
    const message = request.body;

    if (authCookie && isSignalingRequest(message)) {
      const { walletAddress } = JSON.parse(authCookie);
      //if (signalingServer.hasConnection(walletAddress)) {
      //request.log.info(`${signalingRequest} walletAddress ${JSON.stringify(walletAddress)} ${JSON.stringify(message)}`);
      await signalingServer.handleRequest(request.log, walletAddress, message);
      return {};
      /*
      } else {
        request.log.warn(`Valid cookie, but missing event listener`, JSON.stringify(authCookie));
        reply.status(412).send();
      }
      */
    } else {
      request.log.warn(`fastify.post !authCookie.valid && authCookie.value ${JSON.stringify(authCookie)}`);
      return reply.status(401).send();
    }
  });

  try {
    await fastify.listen(port, "0.0.0.0");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

function hasValidAuthCookie(request: {
  cookies: { [cookieName: string]: string };
  unsignCookie: (value: string) => {
    valid: boolean;
    renew: boolean;
    value: string | null;
  };
}) {
  const signedAuthCookie = request.cookies[authCookieName];
  if (signedAuthCookie) {
    const authCookie = request.unsignCookie(signedAuthCookie);
    return authCookie.valid && authCookie.value;
  } else {
    return false;
  }
}

// Until typescript supports top level async functions ignore this await
void start();
