import { signalingEvents, signalingRequest } from "../../protocol/web_rtc_signaling_common";
import { useCallback, useEffect, useRef, useState } from "react";
import { isSignalingEvent, SignalingEvent, SignalingRequest } from "../../protocol/signaling_types";
import { useStore } from "../store/store";
import { useWhyDidYouUpdate } from "./use_why_did_you_update";
import { logger } from "../utils/logger";

export type Signaling = ReturnType<typeof useSignaling>;
export type EventListner = (event: SignalingEvent) => Promise<void>;

/**
 * In production the client and the signalling service are hosted at the same locaiton. In developmnent
 * they run as seperate services to allow for Next.JS and ts-node-dev to do the right thing for HMR.
 *
 * This function detemrines which environment the client is running in and generates the appropriate
 * API url host and port to use.
 *
 * @returns
 */
function getSignalingHost(): string {
  const hostname = window.location.hostname;
  const port = window.location.port;
  const protocol = "https";
  // If running against localhost dev-ssl proxied nextJs server
  if (port === "3000" || port === "3001") {
    return `${protocol}://${hostname}:3001`;
  } else {
    return `${protocol}://${hostname}`;
  }
}

export function getSignalingEventsUrl(): string {
  return getSignalingHost() + signalingEvents;
}

export function getSignalingRequestUrl(): string {
  return getSignalingHost() + signalingRequest;
}

export const enum EventSourceState {
  Connecting = "Connecting",
  Connected = "Connected",
  Reconnecting = "Reconnecting",
  Disconnecting = "Disconnecting",
  Disconnected = "Disconnected",
}

async function sendRequestViaFetch(data: SignalingRequest, abortSignal: AbortSignal) {
  try {
    const response = await fetch(getSignalingRequestUrl(), {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      redirect: "follow",
      referrerPolicy: "no-referrer",
      signal: abortSignal,
      body: JSON.stringify(data), // body data type must match "Content-Type" header
    });
    return response;
  } catch (err: any) {
    if (!abortSignal.aborted) {
      logger.info(`sendRequestViaFetch type: ${data.type} status: ${err.message}`);
    }
  }
}

const MAX_RETRY_TIME = 3000;
export const useSignaling = () => {
  const eventsSource = useRef<EventSource | undefined>();
  const abortController = useRef<AbortController | undefined>();
  const retryTimer = useRef<NodeJS.Timeout | undefined>();
  const { setIsAuthenticated } = useStore();
  // This ref is an indirection between the compoments that want to subscribe to the event source and the
  // EventSource, so if we need to reset or recreate the EventSource the listners are restored.
  const eventListeners = useRef<EventListner[]>([]);
  const [eventSourceState, setEventSourceState] = useState(EventSourceState.Disconnected);

  const eventQueue = useRef<SignalingEvent[]>([]);

  // Cancel and retry timers and abort any in-progress requests on unmount
  useEffect(() => {
    () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = undefined;
      }
      if (abortController.current) {
        abortController.current.abort();
        abortController.current = undefined;
      }
      if (eventsSource.current) {
        eventsSource.current.close();
        eventsSource.current = undefined;
      }
    };
  }, []);

  const closeEventSource = useCallback(() => {
    setEventSourceState(EventSourceState.Disconnecting);
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = undefined;
    }
    if (eventsSource.current && abortController.current) {
      abortController.current.abort();
      abortController.current = undefined;
      eventsSource.current.close();
      eventsSource.current = undefined;
    }
    logger.info("useSignalingEvent: EventSource closed");
    setEventSourceState(EventSourceState.Disconnected);
  }, []);

  const createEventSource = useCallback(() => {
    const newEventSource = new EventSource(getSignalingEventsUrl(), { withCredentials: true });
    const newAbortController = new AbortController();

    newEventSource.onopen = (event: Event) => {
      logger.info(`useSignalingEvent: EventSource onopen, readyState:`, event);
      setEventSourceState(EventSourceState.Connected);
    };
    newEventSource.onerror = (ev: Event) => {
      if (ev instanceof ErrorEvent) {
        logger.info(`ErrorEvent ${ev.message}`);
      }
      logger.info(`useSignalingEvent: readyState: ${newEventSource.readyState}`, newEventSource, ev);
      setEventSourceState(EventSourceState.Reconnecting);
      eventsSource.current = undefined;
      abortController.current = undefined;
      newAbortController.abort();
      newEventSource.close();
      // reconnect after random timeout < max_retry_time
      const timeout = Math.round(MAX_RETRY_TIME * Math.random());
      const restartEventSource = () => {
        retryTimer.current = undefined;
        const { newAbortController, newEventSource } = createEventSource();
        eventsSource.current = newEventSource;
        abortController.current = newAbortController;
      };

      retryTimer.current = setTimeout(() => restartEventSource(), timeout);
    };
    // Deliver each event in order, once the prior event has completed delivery
    newEventSource.onmessage = async message => {
      const eventData = JSON.parse(message.data);
      if (isSignalingEvent(eventData)) {
        eventQueue.current.push(eventData);
        if (eventQueue.current.length === 1) {
          while (eventQueue.current.length > 0) {
            // Don't remove the first event util it has been delivered
            const firstEvent = eventQueue.current[0];
            try {
              // Clone in case a listener is added or removed during delivery
              const tempEventListeners = [...eventListeners.current];
              await Promise.all(tempEventListeners.map(async listener => await listener(firstEvent)));
            } catch (err) {
              logger.info(`eventSource onmessage errored, dropping ${firstEvent.type}`, err, eventQueue.current.length);
            }
            eventQueue.current.splice(0, 1);
          }
        }
      } else {
        logger.warn(`eventSource message dropped, unkown event type`, message);
      }
    };

    return { newAbortController, newEventSource };
  }, []);

  const openEventSource = useCallback(() => {
    setEventSourceState(EventSourceState.Connecting);
    logger.info(`openEventSource: eventsSource.current: ${JSON.stringify(eventsSource.current)}`);
    const { newAbortController, newEventSource } = createEventSource();
    eventsSource.current = newEventSource;
    abortController.current = newAbortController;
  }, [createEventSource]);

  useEffect(() => {
    openEventSource();
    return () => {
      closeEventSource();
    };
  }, [closeEventSource, openEventSource]);

  const addEventListener = useCallback((listener: EventListner) => {
    eventListeners.current.push(listener);
  }, []);
  const removeEventListener = useCallback((listener: EventListner) => {
    const index = eventListeners.current.indexOf(listener);
    if (index > -1) {
      eventListeners.current.splice(index, 1);
    }
  }, []);

  const sendRequest = useCallback(
    async (data: SignalingRequest): Promise<boolean> => {
      try {
        if (abortController.current) {
          const response = await sendRequestViaFetch(data, abortController.current.signal);
          if (response?.status === 200) {
            return true;
          } else if (response?.status === 401) {
            setIsAuthenticated(false);
            /*
          } else if (response?.status === 412) {
            // While processing this send request the service let us know the eventSource is no longer connected
            closeEventSource();
            openEventSource();
            // The abortController should will have changed with the eventSource close/open cycle
            if (abortController.current) {
              const response = await sendRequestViaFetch(data, abortController.current.signal);
              if (response?.status === 200) {
                return true;
              }
            }
          */
          }
        }
        return false;
      } catch (err) {
        logger.error(`Failed to send data: ${data}`, err);
        return false;
      }
    },
    [setIsAuthenticated],
  );

  useWhyDidYouUpdate("useSignaling sendRequest", {
    setIsAuthenticated,
  });

  return { addEventListener, removeEventListener, sendRequest, eventSourceState };
};
