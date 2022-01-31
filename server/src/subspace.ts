import { FastifyLoggerInstance } from "fastify";
import http2 from "http2";
import { isError } from "./main";
const { HTTP2_HEADER_STATUS } = http2.constants;

const subspaceAuthHost = "https://subspace.auth0.com";
const subspaceApiHost = "https://api.subspace.com";
const authTokenPath = "/oauth/token";
const globalTurnPath = "/v1/globalturn";

type SubspaceClient = { session: http2.ClientHttp2Session; pendingRequests: ((error?: undefined) => void)[] };
export type v1GlobalTurnServer = {
  username: string;
  credential: string;
  url: string;
  urls: string;
};

export type v1GlobalTurnResponse = {
  ice_servers: v1GlobalTurnServer[];
  ttl: number;
};

export const getSubspaceClient = (subspaceApiKey: {
  clientId: string | undefined;
  clientSecret: string | undefined;
}) => {
  const buffer = Buffer.from(
    JSON.stringify({
      client_id: subspaceApiKey.clientId,
      client_secret: subspaceApiKey.clientSecret,
      audience: "https://api.subspace.com/",
      grant_type: "client_credentials",
    }),
  );

  let subspaceApiHostClient: SubspaceClient | undefined = undefined;
  let headers: http2.OutgoingHttpHeaders | undefined = undefined;

  const getAccessHeaders = async (): Promise<http2.OutgoingHttpHeaders> => {
    return new Promise<http2.OutgoingHttpHeaders>((resolve, reject) => {
      const subspaceAuthHostClient = http2.connect(subspaceAuthHost);
      subspaceAuthHostClient.on("error", error => reject(error));

      const headers: http2.OutgoingHttpHeaders = {
        [http2.constants.HTTP2_HEADER_METHOD]: http2.constants.HTTP2_METHOD_POST,
        [http2.constants.HTTP2_HEADER_PATH]: `${authTokenPath}`,
        "Content-Type": "application/json",
        "Content-Length": buffer.length,
      };
      const req = subspaceAuthHostClient.request(headers);

      req.setEncoding("utf-8");

      req.on("response", headers => {
        const status = Number(headers[HTTP2_HEADER_STATUS]);
        if (status === 200) {
          let data = "";

          req.on("data", chunk => (data += chunk));
          req.on("error", error => reject(error));

          req.on("end", () => {
            const { access_token } = JSON.parse(data);
            const headers: http2.OutgoingHttpHeaders = {
              [http2.constants.HTTP2_HEADER_SCHEME]: "https",
              [http2.constants.HTTP2_HEADER_METHOD]: http2.constants.HTTP2_METHOD_POST,
              [http2.constants.HTTP2_HEADER_PATH]: `${globalTurnPath}`,
              "Content-Type": "application/json",
              Authorization: `Bearer ${access_token}`,
            };
            resolve(headers);
          });
        } else {
          reject(new Error(`Subspace returned error for getting auth token ${JSON.stringify(headers)}`));
        }
      });
      req.write(buffer);

      req.end();
    });
  };

  return async (log: FastifyLoggerInstance): Promise<v1GlobalTurnResponse | undefined> => {
    let retryCount = 0;
    while (retryCount < 10) {
      try {
        if (!headers) {
          headers = await getAccessHeaders();
          log.info(`subspace fetched auth headers`);
        }
        const globalTurnToken = await new Promise<v1GlobalTurnResponse>((resolve, reject) => {
          if (!subspaceApiHostClient) {
            const tempClient: SubspaceClient = {
              session: http2.connect(subspaceApiHost),
              pendingRequests: [],
            };
            tempClient.session.setTimeout(120 * 1000);
            subspaceApiHostClient = tempClient;
            tempClient.session.on("aborted", error => {
              log.info(`subspace subspaceApiHostClient on.aborted ${tempClient.pendingRequests.length}`);
              tempClient.pendingRequests.forEach(reject => reject(error));
              subspaceApiHostClient = undefined;
            });
            tempClient.session.on("timeout", error => {
              log.info(`subspace subspaceApiHostClient on.timeout ${tempClient.pendingRequests.length}`);
              tempClient.pendingRequests.forEach(reject => reject(error));
              subspaceApiHostClient = undefined;
            });
            tempClient.session.on("error", error => {
              log.info(`subspace subspaceApiHostClient on.error ${tempClient.pendingRequests.length} ${error.message}`);
              tempClient.pendingRequests.forEach(reject => reject(error));
              subspaceApiHostClient = undefined;
            });
            tempClient.session.on("close", () => {
              log.info(`subspace subspaceApiHostClient  ${tempClient.pendingRequests.length} on.close`);
              tempClient.pendingRequests.forEach(reject => reject());
              subspaceApiHostClient = undefined;
            });
            tempClient.session.on("goaway", () => {
              log.info(`subspace subspaceApiHostClient  ${tempClient.pendingRequests.length} on.goaway`);
              tempClient.pendingRequests.forEach(reject => reject());
              subspaceApiHostClient = undefined;
            });
          }

          const req = subspaceApiHostClient.session.request(headers);
          req.setEncoding("utf-8");
          const usedClient = subspaceApiHostClient;
          usedClient.pendingRequests.push(reject);
          req.on("response", headers => {
            const status = Number(headers[HTTP2_HEADER_STATUS]);
            if (status === 200) {
              let data = "";

              req.on("data", chunk => (data += chunk));
              req.on("error", error => {
                log.info(
                  `subspace subspaceApiHostClient.request on.error  ${usedClient.pendingRequests.length} ${error.message}`,
                );

                const index = usedClient.pendingRequests.indexOf(reject);
                if (index > -1) {
                  usedClient.pendingRequests.splice(index, 1);
                }
                reject(error);
              });

              req.on("end", () => {
                const resp: v1GlobalTurnResponse = JSON.parse(data);
                const index = usedClient.pendingRequests.indexOf(reject);
                if (index > -1) {
                  usedClient.pendingRequests.splice(index, 1);
                }
                resolve(resp);
                log.info(`subspace subspaceApiHostClient.request on.end  ${usedClient.pendingRequests.length}`);
              });
            } else {
              log.warn(`subspace failed getIceToken  ${usedClient.pendingRequests.length}`);
              const index = usedClient.pendingRequests.indexOf(reject);
              if (index > -1) {
                usedClient.pendingRequests.splice(index, 1);
              }
              reject(
                new Error(
                  `subspace returned error for getting auth token  ${
                    usedClient.pendingRequests.length
                  } ${JSON.stringify(headers)}`,
                ),
              );
            }
          });
          req.end();
        });
        return globalTurnToken;
      } catch (err) {
        if (isError(err)) {
          log.error(
            `subspace handling failure  ${subspaceApiHostClient?.pendingRequests.length} ${retryCount} ${err.message}`,
          );
        }
        retryCount++;
        headers = undefined;
        if (subspaceApiHostClient?.pendingRequests) {
          subspaceApiHostClient.pendingRequests.forEach(reject => reject());
          subspaceApiHostClient.pendingRequests = [];
        }
        subspaceApiHostClient = undefined;
      }
    }
    log.warn(`subspace gave up handling errors`);
  };
};

// small functional test
/*
(async () => {
  testing = false;
  const clientId = process.env.SUBSPACE_CLIENT_ID;
  const clientSecret = process.env.SUBSPACE_CLIENT_SECRET;
  console.log(`env found ${clientId}`);
  if (clientId && clientSecret) {
    try {
      const subspaceClient = getSubspaceClient({ clientId, clientSecret });
      for (let i = 0; i < 10; i++) {
        const token = await subspaceClient();
        console.log(`globalTurnToken ${JSON.stringify(token)}`);
      }
    } catch (err: any) {
      console.trace(`error ${err.message}`);
      process.exit(1);
    }
  }
  //process.exit(0);
})();
*/
