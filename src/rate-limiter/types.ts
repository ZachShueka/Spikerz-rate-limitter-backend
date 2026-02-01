import type Redis from "ioredis";

export type RedisWithRateLimit = Redis & {
    /**
     * Custom Lua command for atomic rate limiting.
     * * @param windowKey - The volatile window key (KEYS[1])
     * @param registryKey - The persistent registry key (KEYS[2])
     * @param requestHistoryKey - The request history key (KEYS[3])
     * @param globalLimit - The default request limit (ARGV[1])
     * @param windowDurationMs - The window duration in milliseconds (ARGV[2])
     * @param currentTimestampMs - The current epoch time (ARGV[3])
     * @param maxHistoryEntries - The maximum number of history entries to keep (ARGV[4])
     * * @returns Promise containing:
     * [0] current_request_count
     * [1] remaining_quota
     * [2] current_window_duration_ms (TTL)
     * [3] action_code (0-3)
     * [4] last_request_timestamp
     * [5] current_request_limit
     */
    rateLimitIncr(
        windowKey: string,
        registryKey: string,
        requestHistoryKey: string,
        globalLimit: string,
        windowDurationMs: string,
        currentTimestampMs: string,
        maxHistoryEntries: string,
    ): Promise<[number, number, number, number, string, number]>;
};
