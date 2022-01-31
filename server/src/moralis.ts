import http2 from "http2";
const { HTTP2_HEADER_METHOD, HTTP2_HEADER_PATH, HTTP2_HEADER_STATUS } = http2.constants;

import { FastifyLoggerInstance } from "fastify";
import { ERC20Result, NftCollection, NFTResult } from "../../protocol/tokens";
import { isError } from "./main";

// List of chains Moralis supports
export const chainList = new Set(
  "eth, 0x1, ropsten, 0x3, rinkeby, 0x4, goerli, 0x5, kovan, 0x2a, polygon, 0x89, mumbai, 0x13881, bsc, 0x38, bsc testnet, 0x61, avalanche, 0xa86a, avalanche testnet, 0xa869, fantom, 0xfa"
    .split(",")
    .map(chainId => chainId.trim()),
);

export type MoralisClient = ReturnType<typeof getMoralisClient>;
export function getMoralisClient(host: string, moralisApiKey: string) {
  let client: http2.ClientHttp2Session | undefined = undefined;
  const getClient = (log: FastifyLoggerInstance) => {
    if (client) {
      return client;
    } else {
      client = http2.connect(host);
      client.on("goaway", () => {
        log.info(`MoralisClient received GOAWAY, closing client`);
        closeClient();
      });
      client.on("error", error => {
        log.info(`MoralisClient received error ${error.message}, closing client`);
        closeClient();
      });
      client.on("close", () => {
        log.info(`MoralisClient received close, closing client`);
        closeClient();
      });
      return client;
    }
  };
  const closeClient = () => {
    try {
      client?.close();
    } finally {
      client = undefined;
    }
  };

  const getNFT = async (log: FastifyLoggerInstance, walletAddress: string, chainId: string): Promise<NFTResult[]> => {
    if (!chainList.has(chainId)) {
      log.warn(`MoralisClient getNFT, unsupported chainId ${chainId}`);
      return [];
    } else {
      const session = getClient(log);
      const constReqHeaders: http2.OutgoingHttpHeaders = {
        [HTTP2_HEADER_METHOD]: "GET",
        accept: "application/json",
        "X-API-Key": moralisApiKey,
      } as const;
      try {
        let resultLength = 0;
        let offset = 0;
        let finalResult: NFTResult[] = [];
        do {
          const pageResult = await getNft(walletAddress, chainId, constReqHeaders, session, log, offset);

          // Unclear what the is_valid flag on NFT results means, but it prevents inclusion of what appear to be improperly formated NFT
          // so using it as a filter, but then it also resulted in falsely excluding valid NFT
          // finalResult = finalResult.concat(pageResult.result.filter(nft => nft.is_valid > 0));
          finalResult = finalResult.concat(pageResult.result);
          resultLength = pageResult.result.length;
          log.info(
            `MoralisClient getNFT fetch page ${pageResult.page} ${pageResult.page_size}  ${pageResult.result.length} ${finalResult.length} ${pageResult.total}`,
          );
          offset += pageResult.result.length;
        } while (resultLength > 0);

        log.info(`MoralisClient getNFT returning ${finalResult.length}  tokens`);
        return finalResult;
      } catch (err) {
        if (isError(err)) {
          log.warn(`MoralisClient Error for getNFT ${err.message}}`);
        }
        closeClient();
        return [];
      }
    }
  };
  const getEC20 = (log: FastifyLoggerInstance, walletAddress: string, chainId: string) => {
    return new Promise<ERC20Result[]>((resolve, reject) => {
      if (!chainList.has(chainId)) {
        log.warn(`MoralisClient getEC20, unsupported chainId ${chainId}`);
        resolve([]);
      } else {
        const path = `/api/v2/${walletAddress}/erc20?chain=${chainId}`;
        try {
          const reqHeaders: http2.OutgoingHttpHeaders = {
            [HTTP2_HEADER_METHOD]: "GET",
            accept: "application/json",
            "X-API-Key": moralisApiKey,
            [HTTP2_HEADER_PATH]: path,
          };
          const req = getClient(log).request(reqHeaders);

          req.setEncoding("utf-8");

          req.on("response", resHeaders => {
            const status = Number(resHeaders[HTTP2_HEADER_STATUS]);
            if (status === 200) {
              let data = "";

              req.on("data", chunk => (data += chunk));
              req.on("error", error => {
                log.warn(`MoralisClient received error on request ${error}`);
                closeClient();
                reject();
              });

              req.once("end", () => {
                const allERC20s: ERC20Result[] = JSON.parse(data) as ERC20Result[];
                log.info(`MoralisClient getEC20 returning ${allERC20s.length} tokens`);
                resolve(allERC20s);
              });
            } else {
              log.warn(
                `MoralisClient Moralis returned error for getEC20 reqHeaders: ${JSON.stringify(
                  reqHeaders,
                )} resHeaders: ${JSON.stringify(resHeaders)}`,
              );
              closeClient();
              reject(`MoralisClient Moralis returned error for getEC20 ${status}`);
            }
          });

          req.end();
        } catch (err) {
          if (isError(err)) {
            log.warn(`MoralisClient Error for getEC20 ${err.message}}`);
          }
          closeClient();
          reject(err);
        }
      }
    });
  };
  const getENS = (log: FastifyLoggerInstance, walletAddress: string, chainId: string) => {
    return new Promise<string | null>((resolve, reject) => {
      if (!(chainId === "eth" || chainId === "0x1")) {
        log.warn(`MoralisClient getENS, unsupported chainId ${chainId}`);
        resolve(null);
      } else {
        const path = `/api/v2/resolve/${walletAddress}/reverse?chain=${chainId}`;
        try {
          const reqHeaders: http2.OutgoingHttpHeaders = {
            [HTTP2_HEADER_METHOD]: "GET",
            accept: "application/json",
            "X-API-Key": moralisApiKey,
            [HTTP2_HEADER_PATH]: path,
          };
          const req = getClient(log).request(reqHeaders);

          req.setEncoding("utf-8");

          req.on("response", resHeaders => {
            const status = Number(resHeaders[HTTP2_HEADER_STATUS]);
            if (status === 200) {
              let data = "";

              req.on("data", chunk => (data += chunk));
              req.on("error", error => {
                log.warn(`MoralisClient received error on request ${error}`);
                closeClient();
                reject();
              });

              req.once("end", () => {
                const { name }: { name: string | null } = JSON.parse(data);
                log.info(`MoralisClient getENS returning ${name}`);
                resolve(name);
              });
            } else if (status === 404) {
              // resolve returns 404 when user isn't found
              log.info(`MoralisClient getENS returning null due to 404`);
              resolve(null);
            } else {
              log.warn(
                `MoralisClient Moralis returned error for getENS reqHeaders: ${JSON.stringify(
                  reqHeaders,
                )} resHeaders: ${JSON.stringify(resHeaders)}`,
              );
              closeClient();
              reject(new Error(`Moralis returned ${status}`));
            }
          });

          req.end();
        } catch (err) {
          if (isError(err)) {
            log.warn(`MoralisClient Error for getENS ${err.message}}`);
          }
          closeClient();
          reject(err);
        }
      }
    });
  };

  return { getNFT, getEC20, getENS };

  async function getNft(
    walletAddress: string,
    chainId: string,
    constReqHeaders: http2.OutgoingHttpHeaders,
    session: http2.ClientHttp2Session,
    log: FastifyLoggerInstance,
    offset: number,
  ) {
    return await new Promise<NftCollection>((resolve, reject) => {
      const path = `/api/v2/${walletAddress}/nft?chain=${chainId}&offset=${offset}&format=decimal`;
      const reqHeaders: http2.OutgoingHttpHeaders = { ...constReqHeaders, [HTTP2_HEADER_PATH]: path };
      const req = session.request(reqHeaders);
      req.setEncoding("utf-8");
      req.on("error", error => {
        log.warn(`MoralisClient received error on request ${error}`);
        reject(error);
      });
      req.on("response", resHeaders => {
        const status = Number(resHeaders[HTTP2_HEADER_STATUS]);
        if (status === 200) {
          let data = "";
          req.on("data", chunk => (data += chunk));
          req.once("end", () => {
            const allNfts: NftCollection = JSON.parse(data) as NftCollection;
            resolve(allNfts);
          });
        } else {
          log.warn(
            `MoralisClient returned error for getNFT reqHeaders: ${JSON.stringify(
              reqHeaders,
            )} resHeaders: ${JSON.stringify(resHeaders)}`,
          );
          reject(`MoralisClient returned error ${status}`);
        }
      });
      req.end();
    });
  }
}
