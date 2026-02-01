import type { RateLimitStatus } from "src/shared/interceptors/rate-limit-interceptor/types";

export type RateUpdateDto = {
	userId: string;
	remainingRequestsCount: number;
	totalRequestsAllowed: number;
	resetTimeTimestamp: number;
	rateLimitStatus: RateLimitStatus;
	lastRequestTimestamp: number;
};

