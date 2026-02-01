/**
 * Rate Limit Constants could be environment variables but for simplicity we are using constants
 * - RATE_LIMIT_WINDOW_DURATION_MS: The duration of the rate-limit window in milliseconds
 * - GLOBAL_REQUEST_LIMIT_DEFAULT: The default request limit for a user
 * - RATE_LIMIT_REQUEST_HISTORY_MAX_ENTRIES: The maximum number of entries in the request history
 */
export const RATE_LIMIT_WINDOW_DURATION_MS = 60 * 60 * 1000; // 1 hour

export const GLOBAL_REQUEST_LIMIT_DEFAULT = 10;

export const RATE_LIMIT_REQUEST_HISTORY_MAX_ENTRIES = 20;
