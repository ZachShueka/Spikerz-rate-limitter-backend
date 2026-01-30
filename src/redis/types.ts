import type Redis from "ioredis";

export type RedisWithRateLimit = Redis & {
	rateLimitIncr(
		key: string,
		limit: string,
		windowSeconds: string,
	): Promise<[string, string]>;
};
