import { of } from "rxjs";
import type { CallHandler } from "@nestjs/common";
import { RateLimitInterceptor } from "../rate-limit.interceptor";
import { RedisService } from "../../../redis/redis.service";
import { HttpStatus } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
	COUNT_HEADER,
	MISSING_USER_ID_HEADER_MESSAGE,
	RATE_LIMIT_MESSAGE_PREFIX,
	TOO_MANY_REQUESTS_ERROR,
	USER_ID_HEADER,
} from "../constants";
import {
	TEST_USER_ID,
	TEST_CURRENT_REQUESTS_UNDER_LIMIT,
	TEST_REMAINING_REQUESTS_UNDER_LIMIT,
	TEST_RESET_TIME,
	TEST_CURRENT_REQUESTS_OVER_LIMIT,
	TEST_REMAINING_REQUESTS_ZERO,
} from "./constants";
import { createExecutionContext } from "./utilites";
import { MockedRedisService } from "./types";


describe("RateLimitInterceptor", () => {
	let interceptor: RateLimitInterceptor;
	let redisService: MockedRedisService;
	let next: CallHandler;

	const setupTest = (
		headers: Record<string, string | undefined> = {
			[USER_ID_HEADER]: TEST_USER_ID,
		},
	) => {
		const headerSpy = jest.fn();
		const context = createExecutionContext({ headers, headerSpy });
		return { headerSpy, context };
	};

	beforeEach(async () => {
		redisService = {
			incrementUserRequestCounter: jest.fn(),
		};

		const moduleRef = await Test.createTestingModule({
			providers: [
				RateLimitInterceptor,
				{
					provide: RedisService,
					useValue: redisService,
				},
			],
		}).compile();

		interceptor = moduleRef.get(RateLimitInterceptor);
		next = {
			handle: jest.fn(() => of({})),
		};
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it(`allows request under limit and sets ${COUNT_HEADER} header`, async () => {
		const { context, headerSpy } = setupTest();

		redisService.incrementUserRequestCounter.mockResolvedValue({
			currentRequestsCount: TEST_CURRENT_REQUESTS_UNDER_LIMIT,
			remainingRequestsCount: TEST_REMAINING_REQUESTS_UNDER_LIMIT,
			resetTime: TEST_RESET_TIME,
		});

		await interceptor.intercept(context, next);

		expect(headerSpy).toHaveBeenCalledWith(
			COUNT_HEADER,
			TEST_REMAINING_REQUESTS_UNDER_LIMIT,
		);
		expect(redisService.incrementUserRequestCounter).toHaveBeenCalledWith(
			TEST_USER_ID,
			expect.any(Number),
		);
		expect(next.handle).toHaveBeenCalledTimes(1);
	});

	it(`fails fast when ${USER_ID_HEADER} is missing and does not call Redis`, async () => {
		const { context } = setupTest({});

		await expect(interceptor.intercept(context, next)).rejects.toThrow(
			MISSING_USER_ID_HEADER_MESSAGE,
		);

		expect(redisService.incrementUserRequestCounter).not.toHaveBeenCalled();
	});

	it("throws 429 with try-again info when rate limit exceeded", async () => {
		const { context } = setupTest();

		redisService.incrementUserRequestCounter.mockResolvedValue({
			currentRequestsCount: TEST_CURRENT_REQUESTS_OVER_LIMIT,
			remainingRequestsCount: TEST_REMAINING_REQUESTS_ZERO,
			resetTime: TEST_RESET_TIME,
		});

		await expect(interceptor.intercept(context, next)).rejects.toMatchObject({
			status: HttpStatus.TOO_MANY_REQUESTS,
			response: expect.objectContaining({
				statusCode: HttpStatus.TOO_MANY_REQUESTS,
				error: TOO_MANY_REQUESTS_ERROR,
				message: expect.stringContaining(RATE_LIMIT_MESSAGE_PREFIX),
				tryAgainAt: TEST_RESET_TIME,
			}),
		});
	});

	it(`sets ${COUNT_HEADER} header before 429 check`, async () => {
		const { context, headerSpy } = setupTest();

		redisService.incrementUserRequestCounter.mockResolvedValue({
			currentRequestsCount: TEST_CURRENT_REQUESTS_OVER_LIMIT,
			remainingRequestsCount: TEST_REMAINING_REQUESTS_ZERO,
			resetTime: TEST_RESET_TIME,
		});

		await expect(interceptor.intercept(context, next)).rejects.toMatchObject({
			status: HttpStatus.TOO_MANY_REQUESTS,
		});

		expect(headerSpy).toHaveBeenCalledWith(
			COUNT_HEADER,
			TEST_REMAINING_REQUESTS_ZERO,
		);
	});
});
