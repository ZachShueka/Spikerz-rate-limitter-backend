export const RATE_LIMIT_SCRIPT = `
local user_rate_limit_key = KEYS[1]
local max_allowed_requests = tonumber(ARGV[1])
local window_duration_ms = tonumber(ARGV[2])

local current_count = tonumber(redis.call('GET', user_rate_limit_key) or "0")
local ms_until_reset = redis.call('PTTL', user_rate_limit_key)

if current_count <= max_allowed_requests then
    current_count = redis.call('INCR', user_rate_limit_key)
end

local is_first_request = (current_count == 1)
local is_key_missing_expiration = (ms_until_reset == -1)

local should_create_new_window = is_first_request or is_key_missing_expiration

if should_create_new_window then
    redis.call('PEXPIRE', user_rate_limit_key, window_duration_ms)
    ms_until_reset = window_duration_ms
end

return { current_count, ms_until_reset }
`;

export const RATE_LIMIT_COMMAND_NAME = "rateLimitIncr";

export const RATE_LIMIT_COMMAND_NUMBER_OF_KEYS = 1;

export const RATE_LIMIT_WINDOW_DURATION_MS = 60 * 60 * 1000; // 1 hour

export const RATE_LIMIT_BUCKET_PREFIX = "rate-limit";

export const REDIS_CLIENT_INJECT_TOKEN = "REDIS_CLIENT";
