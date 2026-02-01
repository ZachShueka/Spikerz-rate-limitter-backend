export const RATE_LIMIT_INCR_SCRIPT = `
-- ==========================================
-- ACTION CONSTANTS
-- ==========================================
local ALLOWED_ACTION = 0
local JUST_REACHED_ACTION = 1
local ALREADY_BLOCKED_ACTION = 2
local MANUAL_SUSPENSION_ACTION = 3

-- ==========================================
-- HELPERS
-- ==========================================


local function recordLastRequest(registry_key, timestamp, default_limit)
    -- HSETNX ensures the user has a base limit if they are new
    redis.call('HSETNX', registry_key, 'base_request_limit', default_limit)

    redis.call('HSET', registry_key, 'last_request_timestamp', timestamp)
end

local function logHistory(requests_history_key, payload_table, max_history_entries)
    -- Serialize the return array into a simple CSV-like string for the log
    -- Format: request_count:remaining_requests_count:current_window_duration_ms:action_code:last_request_timestamp:current_request_limit
    local log_entry = table.concat(payload_table, ":")
    redis.call('LPUSH', requests_history_key, log_entry)
    redis.call('LTRIM', requests_history_key, 0, max_history_entries-1) -- Capped at max_history_entries entries
end

-- Parse HGETALL flat list into a Lua Table (Object)
local function parseHash(raw_data)
    local result = {}
    if raw_data then
        -- Redis HGETALL returns: {key1, val1, key2, val2...}
        for i = 1, #raw_data, 2 do 
            result[raw_data[i]] = raw_data[i + 1] 
        end
    end
    return result
end

-- ==========================================
-- MAIN LOGIC
-- ==========================================

local window_key = KEYS[1]
local registry_key = KEYS[2]
local requests_history_key = KEYS[3]

local global_request_limit = tonumber(ARGV[1])
local initial_window_duration_ms = tonumber(ARGV[2])
local current_timestamp_ms = ARGV[3]
local max_history_entries = tonumber(ARGV[4])

recordLastRequest(registry_key, current_timestamp_ms, global_request_limit)

local result_payload = nil

-- Fetch user's registry state
local registry_raw = redis.call('HGETALL', registry_key)
local registry_data = parseHash(registry_raw)

local current_base_request_limit = tonumber(registry_data['base_request_limit'] or global_request_limit)
local is_user_suspended = (tonumber(registry_data['is_suspended'] or "0") == 1)

-- Fetch user's window state
local window_data_raw = redis.call('HGETALL', window_key)
local window_data = parseHash(window_data_raw)

local request_count_before_inc = tonumber(window_data['request_count'] or "0")
local current_request_limit = tonumber(window_data['current_request_limit'] or current_base_request_limit)

-- Handle TTL precisely with Self-Healing logic
local pttl_result = redis.call('PTTL', window_key)
local current_window_duration_ms = pttl_result

local is_key_missing_expiration = (pttl_result == -1)
local is_key_disappeared = (pttl_result == -2)

if is_key_missing_expiration then
    -- SELF-HEALING: Re-apply TTL if it was manually removed
    redis.call('PEXPIRE', window_key, initial_window_duration_ms)
    current_window_duration_ms = initial_window_duration_ms

elseif is_key_disappeared then
    -- Key is either brand new or expired; reset duration to 0 for the guard return
    current_window_duration_ms = 0
end

local is_already_at_limit = (request_count_before_inc >= current_request_limit)

-- ==========================================
-- GUARDS: Blocked or Suspended
-- ==========================================
if is_user_suspended or is_already_at_limit then
    local final_blocked_action = ALREADY_BLOCKED_ACTION
    
    if is_user_suspended then
        final_blocked_action = MANUAL_SUSPENSION_ACTION
    end

    result_payload = { 
        request_count_before_inc, 
        0, 
        current_window_duration_ms, 
        final_blocked_action, 
        current_timestamp_ms, 
        current_request_limit 
    }

    logHistory(requests_history_key, result_payload, max_history_entries)
    return result_payload
end

-- ==========================================
-- EXECUTION: Successful Increment
-- ==========================================
local new_request_count = redis.call('HINCRBY', window_key, 'request_count', 1)
local is_first_request_in_window = (new_request_count == 1)

if is_first_request_in_window then
    -- Lock the current request limit into the window for this cycle
    redis.call('HSET', window_key, 'current_request_limit', current_request_limit)

    -- Start the rolling window timer
    redis.call('PEXPIRE', window_key, initial_window_duration_ms)

    current_window_duration_ms = initial_window_duration_ms
end

-- Action Resolution
local final_action = ALLOWED_ACTION

if new_request_count == current_request_limit then
    final_action = JUST_REACHED_ACTION
end

result_payload = { 
    new_request_count, 
    current_request_limit - new_request_count, 
    current_window_duration_ms, 
    final_action, 
    current_timestamp_ms, 
    current_request_limit 
}

logHistory(requests_history_key, result_payload, max_history_entries)
return result_payload
`;
