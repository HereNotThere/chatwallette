import fetch from "node-fetch";

const TRACKING_ID = process.env.ANALYTICS_ID;

export interface TrackerEvent {
  clientId: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
}

export async function sendEvent(event: TrackerEvent): Promise<void> {
  if (TRACKING_ID) {
    await fetch(`https://www.google-analytics.com/collect`);
  }
}
