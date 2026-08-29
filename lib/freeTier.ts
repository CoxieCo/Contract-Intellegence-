// Shared between every wall the free anonymous tier can hit — the 1-free-scan
// gate in /api/analyze and the capped-questions wall in /api/ask. A single
// source so the frontend can key off one machine-readable code regardless of
// which wall it hit, rather than string-matching each route's human-readable
// message.
export const SIGNUP_REQUIRED_CODE = "SIGNUP_REQUIRED";
