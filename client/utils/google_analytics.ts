/// <reference types="gtag.js" />

export const GOOGLE_ANALYTICS_ID = "G-LKRG87L4KX";

// log the pageview with their URL
export const pageview = (url: string) => {
  window.gtag("config", GOOGLE_ANALYTICS_ID, {
    page_path: url,
  });
};

// log specific events happening.
export const event = ({
  eventName,
  eventParams,
}: {
  eventName: string;
  eventParams?: Gtag.ControlParams | Gtag.EventParams | Gtag.CustomParams | undefined;
}) => {
  window.gtag("event", eventName, eventParams);
};
