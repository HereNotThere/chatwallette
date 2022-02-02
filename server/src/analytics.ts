import fetch from "node-fetch";

const TRACKING_ID = process.env.ANALYTICS_ID;

export interface AnalyticsEvent {
  clientId: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
}

export async function sendAnalytics(event: AnalyticsEvent): Promise<void> {
  if (TRACKING_ID) {
    const params = new URLSearchParams();
    // Required.
    params.append("tid", TRACKING_ID);
    params.append("cid", event.clientId);
    params.append("ec", event.category);
    params.append("ea", event.action);
    // Optional.
    event.label && params.append("el", event.label);
    event.value && params.append("ev", event.value.toString());
    try {
      await fetch(`https://www.google-analytics.com/collect`, {
        method: "POST",
        body: params,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error(`Cannot send analytics. Error: ${error.stack}`);
    }
  }
}
