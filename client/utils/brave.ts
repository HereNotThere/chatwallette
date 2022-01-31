export const isBrave = () => {
  try {
    if (typeof window !== undefined) {
      if (window && (window.navigator as any).brave !== undefined) {
        if ((window.navigator as any).brave.isBrave.name === "isBrave") {
          return true;
        }
      }
    }
  } catch (err) {}
  return false;
};
