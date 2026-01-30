import { Inject, Injectable } from "@nestjs/common";
import { RATE_LIMIT_BUCKET_PREFIX, RATE_LIMIT_WINDOW_DURATION_MS, REDIS_CLIENT_INJECT_TOKEN } from "./constants";
import type { incrementUserRequestCounterResult } from "./dtos/increment-and-check-result.dto";
import type { RedisWithRateLimit } from "./types";

@Injectable()
export class RedisService {
	constructor(
		@Inject(REDIS_CLIENT_INJECT_TOKEN) private readonly redis: RedisWithRateLimit,
	) {}

	/**
	 * Atomically increments the request count for `userId` unless the limit is reached.
	 *
	 * @param userId - Identifier for the rate-limit bucket
	 * @param requestLimit - Maximum number of requests allowed in the window
	 * @returns currentCount, remainingLimit (max(0, limit - currentCount)), resetTime (ms timestamp)
	 */
	async incrementUserRequestCounter(
		userId: string,
		requestLimit: number,
	): Promise<incrementUserRequestCounterResult> {
		const rateLimitKey = `${RATE_LIMIT_BUCKET_PREFIX}:${userId}`;

		const [ requestsCount, millisecondsUntilReset ] = await this.redis.rateLimitIncr(
			rateLimitKey,
			requestLimit.toString(),
			RATE_LIMIT_WINDOW_DURATION_MS.toString(),
		);

		const requestsCountNumber = Number(requestsCount);
		const millisecondsUntilResetNumber = Number(millisecondsUntilReset);
		const remainingRequestsCount = Math.max(0, requestLimit - requestsCountNumber)

		const resetTime = Date.now() + millisecondsUntilResetNumber;

		return {
			currentRequestsCount: requestsCountNumber,
			remainingRequestsCount,
			resetTime,
		};
	}
}
