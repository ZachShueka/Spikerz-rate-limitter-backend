import type { ExecutionContext, CallHandler } from "@nestjs/common";
import { ForbiddenException, HttpStatus } from "@nestjs/common";
import { of } from "rxjs";
import { Test, type TestingModule } from "@nestjs/testing";
import { RateLimitInterceptor } from "../rate-limit.interceptor";
import { RateLimiterService } from "../../../../rate-limiter/rate-limiter.service";
import { EventsGateway } from "../../../../events/events.gateway";
import {
	USER_ID_HEADER,
	COUNT_HEADER,
	WARNING_THRESHOLD_RATIO,
} from "../constants";
import { RateLimitAction } from "../types";
import type { IncRequestCounterResult } from "../../../../rate-limiter/dtos/inc-request-counter-result.dto";
import type { RateUpdateDto } from "../../../../events/dtos/rate-update.dto";
import {
	TEST_USER_ID,
	TEST_RESET_TIME,
	TEST_CURRENT_LIMIT,
	TEST_REMAINING_REQUESTS_UNDER_LIMIT,
	TEST_REQUESTS_UNDER_LIMIT,
} from "./constants";

function createExecutionContext(userId?: string): ExecutionContext {
	const header = jest.fn();

	const request = {
		headers: userId ? { [USER_ID_HEADER.toLowerCase()]: userId } : {},
	};

	const response = { header };

	const getRequest = jest.fn().mockReturnValue(request);
	const getResponse = jest.fn().mockReturnValue(response);
	const http = { getRequest, getResponse };
	const switchToHttp = jest.fn().mockReturnValue(http);
	return { switchToHttp } as unknown as ExecutionContext;
}

function createCallHandler(handleReturn = of(undefined)): CallHandler {
	return { handle: jest.fn().mockReturnValue(handleReturn) } as CallHandler;
}

describe("RateLimitInterceptor", () => {
	let interceptor: RateLimitInterceptor;
	let rateLimiterService: jest.Mocked<RateLimiterService>;
	let eventsGateway: jest.Mocked<EventsGateway>;
	let next: CallHandler;

	const baseResult: IncRequestCounterResult = {
		currentRequestsCount: TEST_REQUESTS_UNDER_LIMIT,
		remainingRequestsCount: TEST_REMAINING_REQUESTS_UNDER_LIMIT,
		resetTimeTimestamp: TEST_RESET_TIME,
		actionCode: RateLimitAction.ALLOWED,
		lastRequestTimestamp: TEST_RESET_TIME,
		totalRequestsAllowed: TEST_CURRENT_LIMIT,
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				RateLimitInterceptor,
				{
					provide: RateLimiterService,
					useValue: { incrementUserRequestCounter: jest.fn() },
				},
				{
					provide: EventsGateway,
					useValue: {
						broadcastRateUpdate: jest.fn(),
						broadcastLimitExceeded: jest.fn(),
					},
				},
			],
		}).compile();

		interceptor = module.get(RateLimitInterceptor);
		rateLimiterService = module.get(RateLimiterService);
		eventsGateway = module.get(EventsGateway);
		next = createCallHandler();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("Standard Allowed Request", () => {
		it("sets COUNT_HEADER, calls next.handle(), and emits broadcastRateUpdate with rateLimitStatus OK", async () => {
			const result = {
				...baseResult,
				remainingRequestsCount: TEST_REMAINING_REQUESTS_UNDER_LIMIT,
				totalRequestsAllowed: TEST_CURRENT_LIMIT,
			};
			rateLimiterService.incrementUserRequestCounter.mockResolvedValue(result);

			const context = createExecutionContext(TEST_USER_ID);
			const response = context.switchToHttp().getResponse();

			await interceptor.intercept(context, next);

			expect(response.header).toHaveBeenCalledWith(
				COUNT_HEADER,
				TEST_REMAINING_REQUESTS_UNDER_LIMIT,
			);
			expect(next.handle).toHaveBeenCalled();
			expect(eventsGateway.broadcastRateUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: TEST_USER_ID,
					rateLimitStatus: "OK",
				} satisfies Pick<RateUpdateDto, "userId" | "rateLimitStatus">),
			);
		});
	});

	describe("Allowed with Warning", () => {
		it("emits rateLimitStatus 'Warning' when user is close to their limit (<= 10% remaining)", async () => {
			const remainingRequestsCount = Math.floor(
				TEST_CURRENT_LIMIT * WARNING_THRESHOLD_RATIO,
			);

			const result: IncRequestCounterResult = {
				...baseResult,
				remainingRequestsCount: remainingRequestsCount,
				totalRequestsAllowed: TEST_CURRENT_LIMIT,
				actionCode: RateLimitAction.ALLOWED,
			};
			rateLimiterService.incrementUserRequestCounter.mockResolvedValue(result);

			const context = createExecutionContext(TEST_USER_ID);
			const response = context.switchToHttp().getResponse();

			await interceptor.intercept(context, next);

			expect(next.handle).toHaveBeenCalled();
			expect(response.header).toHaveBeenCalledWith(
				COUNT_HEADER,
				remainingRequestsCount,
			);

			expect(eventsGateway.broadcastRateUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: TEST_USER_ID,
					rateLimitStatus: "Warning",
				} satisfies Pick<RateUpdateDto, "userId" | "rateLimitStatus">),
			);
		});
	});

	describe("Threshold Reached (Just Reached)", () => {
		it("allows the final request to complete but triggers broadcastLimitExceeded and sends 'Exceeded' status", async () => {
			const result: IncRequestCounterResult = {
				...baseResult,
				remainingRequestsCount: 0,
				actionCode: RateLimitAction.JUST_REACHED,
				totalRequestsAllowed: TEST_CURRENT_LIMIT,
			};
			rateLimiterService.incrementUserRequestCounter.mockResolvedValue(result);

			const context = createExecutionContext(TEST_USER_ID);
			const response = context.switchToHttp().getResponse();

			await interceptor.intercept(context, next);

			// The request itself is NOT blocked yet
			expect(next.handle).toHaveBeenCalled();
			expect(response.header).toHaveBeenCalledWith(COUNT_HEADER, 0);

			//  Dashboard should show "Exceeded"
			expect(eventsGateway.broadcastRateUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: TEST_USER_ID,
					rateLimitStatus: "Exceeded",
					remainingRequestsCount: 0,
				} satisfies Partial<RateUpdateDto>),
			);

			// The specific 'limit_exceeded' event must fire
			expect(eventsGateway.broadcastLimitExceeded).toHaveBeenCalledWith({
				userId: TEST_USER_ID,
			});
		});
	});

	describe("Manual Suspension (403)", () => {
		it("throws ForbiddenException and broadcasts Suspended status", async () => {
			rateLimiterService.incrementUserRequestCounter.mockResolvedValue({
				...baseResult,
				actionCode: RateLimitAction.MANUAL_SUSPENSION,
			});

			const context = createExecutionContext(TEST_USER_ID);

			await expect(interceptor.intercept(context, next)).rejects.toThrow(
				ForbiddenException,
			);

			expect(eventsGateway.broadcastRateUpdate).toHaveBeenCalledWith(
				expect.objectContaining({ rateLimitStatus: "Exceeded" } satisfies Pick<
					RateUpdateDto,
					"rateLimitStatus"
				>),
			);
		});
	});

	describe("Already Blocked (429)", () => {
		it("throws TOO_MANY_REQUESTS and does not set headers", async () => {
			rateLimiterService.incrementUserRequestCounter.mockResolvedValue({
				...baseResult,
				actionCode: RateLimitAction.ALREADY_BLOCKED,
			});

			const context = createExecutionContext(TEST_USER_ID);
			const response = context.switchToHttp().getResponse();

			await expect(interceptor.intercept(context, next)).rejects.toMatchObject({
				status: HttpStatus.TOO_MANY_REQUESTS,
			});

			expect(response.header).not.toHaveBeenCalled();
		});
	});
});
