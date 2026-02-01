import {
	Inject,
	Injectable,
	InternalServerErrorException,
	ServiceUnavailableException,
} from "@nestjs/common";
import {
	GLOBAL_REQUEST_LIMIT_DEFAULT,
	RATE_LIMIT_REQUEST_HISTORY_MAX_ENTRIES,
	RATE_LIMIT_WINDOW_DURATION_MS,
} from "./constants";
import type { IncRequestCounterResult } from "./dtos/inc-request-counter-result.dto";
import type { RedisWithRateLimit } from "./types";
import { RateLimitAction } from "src/shared/interceptors/rate-limit-interceptor/types";
import {
	REDIS_CLIENT_INJECT_TOKEN,
	RATE_LIMIT_WINDOW_BUCKET_PREFIX,
	RATE_LIMIT_REGISTRY_BUCKET_PREFIX,
	RATE_LIMIT_REQUEST_HISTORY_BUCKET_PREFIX,
	RedisSchema,
} from "src/redis/constants";

@Injectable()
export class RateLimiterService {
	constructor(
		@Inject(REDIS_CLIENT_INJECT_TOKEN)
		private readonly redisClient: RedisWithRateLimit,
	) {}

	/**
	 * Atomically manages the rate-limit state for a user using a Registry-First approach.
	 * This method coordinates between a persistent registry (long-term data)
	 * and a volatile window (current consumption).
	 *
	 * @param userId - Unique identifier for the user
	 * @param globalRequestLimit - Default limit if no specific override exists in the registry
	 * @param windowDurationMs - The duration of the rate-limit window in milliseconds
	 * @returns {Promise<IncRequestCounterResult>} Object containing current count, remaining requests count,
	 * reset timestamp, action code, last request timestamp, and the effective limit used.
	 */
	async incrementUserRequestCounter(
		userId: string,
	): Promise<IncRequestCounterResult> {
		const windowKey = RedisSchema.getWindowKey(userId);
		const registryKey = RedisSchema.getRegistryKey(userId);
		const requestsHistoryKey = RedisSchema.getHistoryKey(userId);

		try {
			const [
				currentRequestsCount,
				remainingRequestsCount,
				millisecondsUntilReset,
				actionCode,
				lastRequestTimestamp,
				totalRequestsAllowed,
			] = await this.redisClient.rateLimitIncr(
				windowKey, // KEYS[1]
				registryKey, // KEYS[2]
				requestsHistoryKey, // KEYS[3]
				GLOBAL_REQUEST_LIMIT_DEFAULT.toString(), // ARGV[1]
				RATE_LIMIT_WINDOW_DURATION_MS.toString(), // ARGV[2]
				Date.now().toString(), // ARGV[3]
				RATE_LIMIT_REQUEST_HISTORY_MAX_ENTRIES.toString(), // ARGV[4]
			);

			const actionNumber = Number(actionCode);
			const actionKey: string | undefined = RateLimitAction[actionNumber];

			if (actionKey === undefined) {
				throw new InternalServerErrorException(
					`Unexpected Rate Limit Action Code received from Redis: ${actionNumber}`,
				);
			}

			return {
				currentRequestsCount: Number(currentRequestsCount),
				remainingRequestsCount: Number(remainingRequestsCount),
				resetTimeTimestamp: Date.now() + Number(millisecondsUntilReset),
				actionCode: actionNumber,
				lastRequestTimestamp: Number(lastRequestTimestamp),
				totalRequestsAllowed: Number(totalRequestsAllowed),
			};
		} catch (error) {
			if (error instanceof InternalServerErrorException) throw error;
			throw new ServiceUnavailableException(`Redis is unavailable: ${error}`);
		}
	}
}
