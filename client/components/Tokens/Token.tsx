import styled from "styled-components";
import { Box } from "../Box";
import { ReactEventHandler, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { delay, ipfsURL, IPFS_GATEWAYS, randomIpfsGateway } from "../../utils/tokenRequest";
import { logger } from "../../utils/logger";

type TokenProps = {
  tokenType: "ERC20" | "NFT";
  symbol?: string | null;
  image?: string;
};

function removePrefix(src: string, prefix: string) {
  const hasPrefix = src.indexOf(prefix) === 0;
  return hasPrefix ? src.substring(prefix.length) : src;
}

export const Token = (props: TokenProps) => {
  const { tokenType, symbol, image } = props;
  const [retry, setRetry] = useState(1);
  const retryTimer = useRef<NodeJS.Timeout>();

  useEffect(
    () => () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = undefined;
      }
    },
    [],
  );

  const src = useMemo((): string | undefined => {
    if (!image || image === "") {
      return;
    }
    // Silence the lint rule, we want to regenerate the src everytime retry increments to get a different randomIpfsGateway
    retry;

    try {
      const url = new URL(image);
      if (url.protocol === "http:" || url.protocol === "https:") {
        if (url.protocol === "http:") {
          url.protocol = "https:";
        }
        if (IPFS_GATEWAYS.includes(url.origin) || url.pathname.toLowerCase().startsWith("/ipfs/")) {
          const newSrc = image.replace(url.origin, randomIpfsGateway());
          return newSrc;
        } else {
          return image;
        }
      } else if (url.protocol === "data:") {
        const [first, ...rest] = image.split(",");
        const newUrl = first + "," + encodeURIComponent(rest.join(","));
        // logger.info(`Token url encoded`, image, newUrl);
        return newUrl;
      } else if (url.protocol === "ipfs:") {
        const newUrl = ipfsURL(removePrefix(removePrefix(url.pathname, "//"), "ipfs/"));
        return newUrl;
      }
    } catch (err: any) {
      logger.info(`Token failed to create URL from image ${image} ${err.message}`);
      return undefined;
    }
  }, [image, retry]);

  // TODO standup our own ipfs gateway to retry reqeusts against so we can avoid rate limits and
  // properly handle 404 and other errors
  const onError: ReactEventHandler<HTMLImageElement> = useCallback(() => {
    setRetry(count => {
      logger.info(`Token onError ${src} ${image} ${count}`);
      if (count < 10) {
        const timeToWait = delay(count);
        retryTimer.current = setTimeout(() => {
          if (retryTimer.current) {
            retryTimer.current = undefined;
            setRetry(count => count + 1);
          }
        }, timeToWait);
      }
      return count;
    });
  }, [src, image]);

  return (
    <Item centerContent border tokenType={tokenType}>
      {tokenType === "ERC20" && <h3 style={{ fontFamily: "Munro" }}>{symbol ?? "???"}</h3>}
      {tokenType === "NFT" && src && image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${src}-${retry}`}
          className="nft-scaled"
          src={src}
          alt={symbol ?? "???"}
          title={symbol ?? "???"}
          onError={onError}
        ></img>
      )}
    </Item>
  );
};

const Item = styled(Box).attrs(({ tokenType }: { tokenType: string }) => {
  return { tokenType };
})<{ tokenType: string }>`
  border-radius: ${({ tokenType }) => (tokenType === "ERC20" ? "100px" : "0")};
  flex-flow: wrap;
  aspect-ratio: 1;
`;
