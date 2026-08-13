const configuredTurnUrls = (import.meta.env.VITE_TURN_URLS ?? "")
  .split(",")
  .map((value: string) => value.trim())
  .filter(Boolean);

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  ...(configuredTurnUrls.length > 0 && import.meta.env.VITE_TURN_USERNAME && import.meta.env.VITE_TURN_CREDENTIAL
    ? [{
        urls: configuredTurnUrls,
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_CREDENTIAL,
      }]
    : []),
];

export const hasTurnConfiguration = configuredTurnUrls.length > 0 && Boolean(import.meta.env.VITE_TURN_USERNAME && import.meta.env.VITE_TURN_CREDENTIAL);
