import React, { useEffect, useMemo, useRef, useState } from "react";
import { Base64 } from "js-base64";
import { NFTResult } from "../../../protocol/tokens";
import { getTokenBaseUrl } from "../../utils/tokenRequest";
import { Token } from "./Token";
import { Box } from "../Box";
import { logger } from "../../utils/logger";

type NFTTokenProps = {
  token: NFTResult;
};

const fetchToken = async (
  tokenUrl: string,
  signal: AbortSignal,
): Promise<{ image?: string; image_url?: string } | undefined> => {
  try {
    // Attempt to fetch URL normally
    logger.info(`fetchToken directly trying to fetch ${tokenUrl}`);
    const response = await fetch(tokenUrl, { signal });
    if (!response.ok) {
      throw new Error(`Unable to fetch directly ${tokenUrl}`);
    }
    logger.info(`fetchToken directly succeeded to fetch ${tokenUrl}`, response);
    return response.json();
  } catch (err) {
    if (signal.aborted) {
      return;
    }
    try {
      logger.info(`fetchToken directly failed trying to fetch ${tokenUrl}`);
      logger.info(`fetchToken through proxy trying to fetch ${tokenUrl}`);
      const tokenUrlEncoded = Base64.encodeURL(tokenUrl);
      // Use https reverse proxy if an error is encountered
      const response = await fetch(`${getTokenBaseUrl()}?tokenUrlEncoded=${tokenUrlEncoded}`, {
        credentials: "include",
        signal,
      });
      if (!response.ok) {
        throw new Error(`Unable to fetch through proxy ${tokenUrl}`);
      } else {
        logger.info(`fetchToken through proxy succeeded to fetch ${tokenUrl}`);
        return response.json();
      }
    } catch (err) {
      if (signal.aborted) {
        return;
      }
      logger.info(`fetchToken through proxy failed trying to fetch ${tokenUrl} `);
      return;
    }
  }
};

export const NFTToken = (props: NFTTokenProps) => {
  const { symbol, token_address, token_id, token_uri, metadata } = props.token;
  const abortController = useRef<AbortController | undefined>();

  const [fetchUrl, setFetchUrl] = useState<string>();
  useEffect(() => {
    if (fetchUrl) {
      const controller = new AbortController();
      abortController.current = controller;
      void (async () => {
        const response = await fetchToken(fetchUrl, controller.signal);
        if (abortController.current) {
          abortController.current = undefined;
          logger.info(`getImage after fetchToken ${fetchUrl} ${response?.image} ${response?.image_url}`, response);
          setImage(response?.image ?? response?.image_url ?? "");
        }
      })();
      return () => {
        if (abortController.current) {
          abortController.current.abort();
          abortController.current = undefined;
        }
      };
    }
  }, [fetchUrl]);

  const [image, setImage] = useState<string | undefined>(() => {
    if (metadata) {
      try {
        const parsedMetadata = JSON.parse(metadata);
        const metadataImage = parsedMetadata.image ?? parsedMetadata.image_url;
        if (metadataImage) {
          return metadataImage;
        }
      } catch (err: any) {
        logger.info(`getImage failed parsing metadata ${err.message} ${token_address} ${metadata}`);
      }
    }
    // If metadata didn't work, try token_uri
    if (token_uri) {
      try {
        const url = new URL(token_uri);
        if (url.protocol === "http:") {
          logger.info(`getImage http upgrading ${token_uri}`);
          url.protocol = "https:";
        }
        if (url.protocol === "https:") {
          // Fetch this async, will get cancelled if this NFTToken unmounts
          setFetchUrl(url.toString());
        } else if (url.protocol === "data:") {
          const [first, ...rest] = token_uri.split(",");
          let response;

          switch (first) {
            case "data:application/json;base64": {
              const json = Buffer.from(rest.join(","), "base64").toString();
              response = JSON.parse(json);
              break;
            }
            case "data:application/json;utf8":
            case "data:application/json;ascii": {
              response = JSON.parse(rest.join(","));
              break;
            }
            default:
              logger.warn(`unsupported data url format ${first}`);
          }
          /*
            const url = first + "," + encodeURIComponent(rest.join(","));
            const controller = new AbortController();
            abortController.current = controller;
            const response = await fetchToken(url, controller.signal);
            abortController.current = undefined;
            */
          if (response) {
            return response.image ?? response.image_url;
          }
        } else {
          logger.warn(`unsupported protocol ${url.protocol} token_uri ${token_uri}`);
        }
      } catch (err: any) {
        logger.info(`getImage failed ${token_uri} ${err.message}`);
      }
    }
    return undefined;
  });

  const showToken = useMemo(() => Boolean(image?.split(".").pop() !== "mp4"), [image]);

  return showToken && image ? (
    <Box shrink>
      <Token key={`${token_address}-${token_id}`} tokenType={"NFT"} symbol={symbol} image={image} />
    </Box>
  ) : null;
};
