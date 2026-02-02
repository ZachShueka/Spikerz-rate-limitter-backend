import {
	Inject,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import {
	GLOBAL_REQUEST_LIMIT_DEFAULT,
	RATE_LIMIT_REQUEST_HISTORY_MAX_ENTRIES,
} from "../rate-limiter/constants";
import type { RedisWithRateLimit } from "../rate-limiter/types";
import { getRateLimitStatus } from "src/shared/utilites";
import type { RateUpdateDto } from "src/events/dtos/rate-update.dto";
import { RateLimitAction } from "src/shared/interceptors/rate-limit-interceptor/types";
import type { UserFullDataDto } from "./dtos/user-full-data.dto";
import type { UserRegistryData, UserWindowData } from "./types";
import {
	REDIS_CLIENT_INJECT_TOKEN,
	RATE_LIMIT_REGISTRY_BUCKET_PREFIX,
	RedisSchema,
} from "src/redis/constants";
import { UserBaseDataDto } from "./dtos/user-base-data.dto";

@Injectable()
export class UsersRepository {
	constructor(
		@Inject(REDIS_CLIENT_INJECT_TOKEN)
		private readonly _redisClient: RedisWithRateLimit,
	) {}

	/**
	 * Fetches all users and their real-time rate limit metrics.
	 */
	async findAllUsers(): Promise<UserBaseDataDto[]> {
		try {
			const registryKeys = await this._getAllRegistryKeys();
			if (registryKeys.length === 0) return [];

			const allUsers: UserBaseDataDto[] = await Promise.all(
				registryKeys.map(async (registryKey): Promise<UserBaseDataDto> => {
					const userId = registryKey.split(":")[1];
					const windowKey = RedisSchema.getWindowKey(userId);

					const [registryDataRaw, windowDataRaw, pttlResult] =
						await Promise.all([
							this._redisClient.hgetall(registryKey),
							this._redisClient.hgetall(windowKey),
							this._redisClient.pttl(windowKey),
						]);

					const registryData = this._parseRegistryData(registryDataRaw);

					const windowData = this._parseWindowData(
						windowDataRaw,
						pttlResult,
						registryData.baseRequestLimit,
					);

					const remainingRequestsCount =
						windowData.currentRequestLimit - windowData.requestCount;

					const actionCode: RateLimitAction = registryData.isSuspended
						? RateLimitAction.MANUAL_SUSPENSION
						: remainingRequestsCount <= 0
							? RateLimitAction.ALREADY_BLOCKED
							: RateLimitAction.ALLOWED;

					const resetTimeTimestamp =
						windowData.windowDurationMs > 0
							? Date.now() + windowData.windowDurationMs
							: 0;

					const rateLimitStatus = getRateLimitStatus(
						remainingRequestsCount,
						windowData.currentRequestLimit,
						actionCode,
					);

					return {
						userId,
						remainingRequestsCount,
						totalRequestsAllowed: windowData.currentRequestLimit,
						resetTimeTimestamp,
						rateLimitStatus,
						lastRequestTimestamp: registryData.lastRequestTimestamp,
						isSuspended: registryData.isSuspended,
					};
				}),
			);

			return allUsers;
		} catch (error) {
			throw new ServiceUnavailableException(
				"Failed to retrieve user rate limit data",
			);
		}
	}

	/**
	 * Retrieves full state for a specific user.
	 * Combines registry data, window data, and request history list.
	 */
	async findOne(userId: string): Promise<UserFullDataDto> {
		const registryKey = RedisSchema.getRegistryKey(userId);
		const windowKey = RedisSchema.getWindowKey(userId);
		const historyKey = RedisSchema.getHistoryKey(userId);

		try {
			const [
				registryDataRaw,
				windowDataRaw,
				requestsHistoryDataRaw,
				windowDurationMs,
			] = await Promise.all([
				this._redisClient.hgetall(registryKey),
				this._redisClient.hgetall(windowKey),
				this._redisClient.lrange(
					historyKey,
					0,
					RATE_LIMIT_REQUEST_HISTORY_MAX_ENTRIES - 1,
				),
				this._redisClient.pttl(windowKey),
			]);

			if (!registryDataRaw || Object.keys(registryDataRaw).length === 0) {
				throw new NotFoundException(
					`User ${userId} not found in the rate-limit registry`,
				);
			}
			const registryData = this._parseRegistryData(registryDataRaw);
			const windowData = this._parseWindowData(
				windowDataRaw,
				windowDurationMs,
				registryData.baseRequestLimit,
			);
			const requestsHistory = this._parseRequestsHistory(
				userId,
				requestsHistoryDataRaw,
			);

			return {
				userId,
				registryData,
				windowData,
				requestsHistory,
			};
		} catch (error) {
			if (error instanceof NotFoundException) throw error;
			throw new ServiceUnavailableException(
				`Failed to retrieve data for user ${userId}`,
			);
		}
	}

	/**
	 * Updates Registry fields for a specific user.
	 * Throws NotFoundException if the user doesn't exist.
	 */
	async updateUserRegistry(
		userId: string,
		data: Partial<Omit<UserRegistryData, "lastRequestTimestamp">>,
	): Promise<void> {
		const key = RedisSchema.getRegistryKey(userId);
		const redisData: Record<string, string | number> = {};

		if (data.isSuspended !== undefined)
			redisData.is_suspended = data.isSuspended ? 1 : 0;
		if (data.baseRequestLimit !== undefined)
			redisData.base_request_limit = data.baseRequestLimit;

		if (Object.keys(redisData).length === 0) return;

		try {
			const userExists = await this._redisClient.exists(key);

			if (!userExists) {
				throw new NotFoundException(`User ${userId} not found in registry.`);
			}

			await this._redisClient.hset(key, redisData);
		} catch (error) {
			if (error instanceof NotFoundException) throw error;

			throw new ServiceUnavailableException(
				`Failed to update registry data for user ${userId}`,
			);
		}
	}

	/**
	 * Updates Window current_request_limit field for a specific user to be current_request_limit + requestCountToAdd.
	 * If window does not exist, it will be created with the users base request limit + requestCountToAdd.
	 */
	async addRequestsToUserWindow(
		userId: string,
		requestCountToAdd: number,
	): Promise<void> {
		const registryKey = RedisSchema.getRegistryKey(userId);
		const windowKey = RedisSchema.getWindowKey(userId);

		try {
			const baseLimitStr = await this._redisClient.hget(
				registryKey,
				"base_request_limit",
			);

			if (!baseLimitStr) {
				throw new NotFoundException(`User ${userId} not found in registry.`);
			}

			const baseLimit = Number(baseLimitStr);

			const currentLimit = await this._redisClient.hincrby(
				windowKey,
				"current_request_limit",
				requestCountToAdd,
			);

			/**
			 * If the result equals the amount we added, it means the field didn't
			 * exist before (or was 0). We need to add the base limit and init the count.
			 */
			if (currentLimit === requestCountToAdd) {
				await this._redisClient
					.multi()
					.hset(
						windowKey,
						"current_request_limit",
						baseLimit + requestCountToAdd,
					)
					.hset(windowKey, "request_count", 0)
					// If your windows have a TTL, add it here:
					// .expire(windowKey, 3600)
					.exec();
			}
		} catch (error) {
			if (error instanceof NotFoundException) throw error;
			throw new ServiceUnavailableException(
				`Failed to adjust window for user ${userId}`,
			);
		}
	}

	/**
	 * Updates the user's limit in the registry.
	 * If a window is currently active, it updates that too.
	 * If no window exists, we do nothing; the next request will
	 * automatically pick up the new limit from the registry.
	 */
	async updateUserLimits(userId: string, newLimit: number): Promise<void> {
		const registryKey = RedisSchema.getRegistryKey(userId);
		const windowKey = RedisSchema.getWindowKey(userId);

		try {
			const userExists = await this._redisClient.exists(registryKey);
			if (!userExists) {
				throw new NotFoundException(`User ${userId} not found in registry.`);
			}

			const windowExists = await this._redisClient.exists(windowKey);

			if (windowExists) {
				await this._redisClient
					.multi()
					.hset(registryKey, "base_request_limit", newLimit)
					.hset(windowKey, "current_request_limit", newLimit)
					.exec();
			} else {
				await this._redisClient.hset(
					registryKey,
					"base_request_limit",
					newLimit,
				);
			}
		} catch (error) {
			if (error instanceof NotFoundException) throw error;
			throw new ServiceUnavailableException(`Reset failed for user ${userId}`);
		}
	}

	/**
	 * Update the request limit for all users.
	 * Only updates active windows to avoid creating zombie data.
	 */
	async updateAllUsersRequestLimit(newLimit: number): Promise<void> {
		try {
			const allRegistryKeys = await this._getAllRegistryKeys();
			if (allRegistryKeys.length === 0) return;

			const windowKeys = allRegistryKeys.map((regKey) => {
				const userId = regKey.split(":")[1];
				return RedisSchema.getWindowKey(userId);
			});

			const checkWindowExistsPipeline = this._redisClient.pipeline();

			windowKeys.forEach((key) => {
				checkWindowExistsPipeline.exists(key);
			});

			const pipelineResults = await checkWindowExistsPipeline.exec();

			if (!pipelineResults) {
				throw new Error("Pipeline execution failed to return results");
			}

			/** * Transform [Error | null, result][] into Array<1 | 0>
			 * We cast the result because 'exists' returns 1 or 0
			 */
			const windowExistenceResults: number[] = pipelineResults.map(
				([err, res]) => {
					if (err) return 0;
					return res as 1 | 0;
				},
			);

			const updatePipeline = this._redisClient.pipeline();

			allRegistryKeys.forEach((registryKey, index) => {
				const windowKey = windowKeys[index];
				const windowExists = windowExistenceResults[index] === 1;

				updatePipeline.hset(registryKey, "base_request_limit", newLimit);

				if (windowExists) {
					updatePipeline.hset(windowKey, "current_request_limit", newLimit);
				}
			});

			await updatePipeline.exec();
		} catch (error) {
			throw new ServiceUnavailableException(
				"Bulk limit update failed due to database error",
			);
		}
	}

	/**
	 * Safely scans all registry keys using a cursor.
	 * This avoids the performance pitfall of the KEYS command.
	 */
	private async _getAllRegistryKeys(): Promise<string[]> {
		const pattern = `${RATE_LIMIT_REGISTRY_BUCKET_PREFIX}:*`;
		let cursor = "0";
		const allKeys: string[] = [];

		try {
			do {
				/**
				 * SCAN returns a tuple: [nextCursor, arrayOfKeys]
				 * COUNT 100 tells Redis to return ~100 keys per batch,
				 * keeping each hop small and the event loop free.
				 */
				const [nextCursor, keys] = await this._redisClient.scan(
					cursor,
					"MATCH",
					pattern,
					"COUNT",
					100,
				);

				cursor = nextCursor;

				if (keys.length > 0) {
					allKeys.push(...keys);
				}
			} while (cursor !== "0"); // "0" when the scan is complete

			return allKeys;
		} catch (error) {
			throw new ServiceUnavailableException("Redis scan operation failed.");
		}
	}

	private _parseRegistryData(
		registryDataRaw: Record<string, string>,
	): UserRegistryData {
		return {
			isSuspended: Number(registryDataRaw.is_suspended || "0") === 1,
			baseRequestLimit: Number(
				registryDataRaw.base_request_limit || GLOBAL_REQUEST_LIMIT_DEFAULT,
			),
			lastRequestTimestamp: Number(
				registryDataRaw.last_request_timestamp || "0",
			),
		};
	}

	private _parseWindowData(
		windowDataRaw: Record<string, string>,
		windowDurationMs: number,
		baseRequestLimit: number,
	): UserWindowData {
		return {
			currentRequestLimit: Number(
				windowDataRaw.current_request_limit || baseRequestLimit.toString(),
			),
			requestCount: Number(windowDataRaw.request_count || "0"),
			windowDurationMs: windowDurationMs > 0 ? windowDurationMs : 0,
		};
	}

	private _parseRequestsHistory(
		userId: string,
		requestsHistoryDataRaw: string[],
	): RateUpdateDto[] {
		return requestsHistoryDataRaw.map((entry) => {
			const [count, remainingRequestsCount, winMs, action, ts, limit] =
				entry.split(":");

			const remaining = Number(remainingRequestsCount || 0);
			const total = Number(limit || 0);
			const actionCode = Number(action || 0);

			return {
				userId,
				currentRequestsCount: Number(count || 0),
				remainingRequestsCount: remaining,
				windowDurationMs: Number(winMs || 0),
				actionCode,
				lastRequestTimestamp: Number(ts || 0),
				totalRequestsAllowed: total,
				resetTimeTimestamp: Number(ts || 0) + Number(winMs || 0),
				rateLimitStatus: getRateLimitStatus(remaining, total, actionCode),
			};
		});
	}
}
