export const RATE_LIMIT_COMMAND_NAME = "rateLimitIncr";

export const RATE_LIMIT_COMMAND_NUMBER_OF_KEYS = 3;

export const RATE_LIMIT_WINDOW_BUCKET_PREFIX = "rate-limit-window";

export const RATE_LIMIT_REGISTRY_BUCKET_PREFIX = "rate-limit-registry";

export const RATE_LIMIT_REQUEST_HISTORY_BUCKET_PREFIX =
	"rate-limit-request-history";

export const REDIS_CLIENT_INJECT_TOKEN = "REDIS_CLIENT";

/**
 * REDIS SCHEMA DEFINITION
 * * 1. Registry (Hash): rate-limit-registry:{userId}
 * - is_suspended: 0 | 1
 * - base_request_limit: number
 * - last_request_timestamp: unix_ms
 * * 2. Window (Hash): rate-limit-window:{userId}
 * - request_count: number
 * - current_request_limit: number
 * * 3. Request History (List): rate-limit-request-history:{userId}
 * - request_count:remaining_requests_count:current_window_duration_ms:action_code:last_request_timestamp:current_request_limit
 */

export const RedisSchema = {
	getRegistryKey: (userId: string) =>
		`${RATE_LIMIT_REGISTRY_BUCKET_PREFIX}:${userId}`,
	getWindowKey: (userId: string) => `${RATE_LIMIT_WINDOW_BUCKET_PREFIX}:${userId}`,
	getHistoryKey: (userId: string) =>
		`${RATE_LIMIT_REQUEST_HISTORY_BUCKET_PREFIX}:${userId}`,
} as const;
