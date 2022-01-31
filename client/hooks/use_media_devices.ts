import { useState, useEffect } from "react";
import stringify from "fast-json-stable-stringify";

export function useMediaDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    // If this hook is unmounted before the async enumerateDevices finishes, ignore the results
    let shutdown = false;
    // If an async enumerateDevices is running, don't start another one
    let enumerating = false;
    // If a device change event comes in while an async enumerateDevices is running, queue it to run again
    let requested = false;

    const enumerateDevices = async () => {
      if (!enumerating) {
        try {
          enumerating = true;
          requested = true;
          while (requested) {
            requested = false;
            const newDevices = await navigator.mediaDevices.enumerateDevices();
            if (!shutdown) {
              // optimize to only change devices when devices really change
              setDevices(devices => (stringify(devices) === stringify(newDevices) ? devices : newDevices));
            }
          }
        } finally {
          enumerating = false;
        }
      } else {
        requested = true;
      }
    };
    navigator.mediaDevices.addEventListener("devicechange", enumerateDevices);
    void enumerateDevices();
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", enumerateDevices);
      shutdown = true;
    };
  }, []);

  return { devices };
}
