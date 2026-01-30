import { Test } from "@nestjs/testing";
import {
	RATE_LIMIT_BUCKET_PREFIX,
	RATE_LIMIT_COMMAND_NAME,
	RATE_LIMIT_WINDOW_DURATION_MS,
	REDIS_CLIENT_INJECT_TOKEN,
} from "./constants";
import type { incrementUserRequestCounterResult } from "./dtos/increment-and-check-result.dto";
import { RedisService } from "./redis.service";
import type { RedisWithRateLimit } from "./types";

jest.mock("ioredis", () => ({
	__esModule: true,
	default: jest.fn(),
}));

type RedisMock = Pick<RedisWithRateLimit, "rateLimitIncr"> & {
	rateLimitIncr: jest.Mock<Promise<[string, string]>, [string, string, string]>;
	get: jest.Mock;
	set: jest.Mock;
	incr: jest.Mock;
	del: jest.Mock;
	expire: jest.Mock;
};

describe("RedisService", () => {
	let service: RedisService;
	let redisMock: RedisMock;

	const userId = "user_123";
	const requestLimit = 100;
	const currentWindowPttlMs = RATE_LIMIT_WINDOW_DURATION_MS;
	const newUserRequestCount = "1";
	const newUserRequestCountNumber = Number(newUserRequestCount);	
	const frozenTimeIso = "2024-01-01T00:00:00.000Z";
	const redisErrorMessage = "Redis down";
	const now = new Date(frozenTimeIso);


	beforeEach(async () => {
		redisMock = {
			rateLimitIncr: jest.fn(),
			get: jest.fn(),
			set: jest.fn(),
			incr: jest.fn(),
			del: jest.fn(),
			expire: jest.fn(),
		};

		const moduleRef = await Test.createTestingModule({
			providers: [
				RedisService,
				{
					provide: REDIS_CLIENT_INJECT_TOKEN,
					useValue: redisMock,
				},
			],
		}).compile();

		service = moduleRef.get(RedisService);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.clearAllMocks();
	});

	it("returns correct values for a new user", async () => {
		jest.useFakeTimers().setSystemTime(now);

		redisMock.rateLimitIncr.mockResolvedValue([
			newUserRequestCount,
			currentWindowPttlMs.toString(),
		]);

		const result: incrementUserRequestCounterResult =
			await service.incrementUserRequestCounter(userId, requestLimit);

		expect(result.currentRequestsCount).toBe(newUserRequestCountNumber);
		expect(result.remainingRequestsCount).toBe(requestLimit - 1);
		expect(result.resetTime).toBe(now.getTime() + currentWindowPttlMs);
	});

	it("returns remainingRequestsCount=0 when at the limit", async () => {
		redisMock.rateLimitIncr.mockResolvedValue([
			requestLimit.toString(),
			currentWindowPttlMs.toString(),
		]);

		const result = await service.incrementUserRequestCounter(
			userId,
			requestLimit,
		);

		expect(result.remainingRequestsCount).toBe(0);
	});

	it("returns remainingRequestsCount=0 when over the limit", async () => {
		const overLimitCount = requestLimit + 1;
		redisMock.rateLimitIncr.mockResolvedValue([
			overLimitCount.toString(),
			currentWindowPttlMs.toString(),
		]);

		const result = await service.incrementUserRequestCounter(
			userId,
			requestLimit,
		);

		expect(result.currentRequestsCount).toBe(overLimitCount);
		expect(result.remainingRequestsCount).toBe(0);
	});

	it("calculates resetTime using Date.now() and PTTL (ms)", async () => {
		jest.useFakeTimers().setSystemTime(now);

		redisMock.rateLimitIncr.mockResolvedValue([
			newUserRequestCount,
			currentWindowPttlMs.toString(),
		]);

		const result = await service.incrementUserRequestCounter(
			userId,
			requestLimit,
		);

		expect(result.resetTime).toBe(now.getTime() + currentWindowPttlMs);
	});

	it("propagates redis errors", async () => {
		redisMock.rateLimitIncr.mockRejectedValue(new Error(redisErrorMessage));

		await expect(
			service.incrementUserRequestCounter(userId, requestLimit),
		).rejects.toThrow(redisErrorMessage);
	});

	it("uses the correct key prefix and arguments", async () => {
		redisMock.rateLimitIncr.mockResolvedValue([
			newUserRequestCount,
			currentWindowPttlMs.toString(),
		]);

		await service.incrementUserRequestCounter(userId, requestLimit);

		expect(redisMock.rateLimitIncr).toHaveBeenCalledWith(
			`${RATE_LIMIT_BUCKET_PREFIX}:${userId}`,
			requestLimit.toString(),
			RATE_LIMIT_WINDOW_DURATION_MS.toString(),
		);
	});

	it("should be the only redis interaction to guarantee system-wide atomicity", async () => {
		redisMock.rateLimitIncr.mockResolvedValue([
			newUserRequestCount,
			currentWindowPttlMs.toString(),
		]);

		await service.incrementUserRequestCounter(userId, requestLimit);

		expect(redisMock.rateLimitIncr).toHaveBeenCalledTimes(1);

		const allMockedMethods: string[] = Object.keys(redisMock);

		for (const method of allMockedMethods) {
			if (method !== RATE_LIMIT_COMMAND_NAME) {
				expect(redisMock[method as keyof RedisMock]).not.toHaveBeenCalled();
			}
		}
	});
});
