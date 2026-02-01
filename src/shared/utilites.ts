import { WARNING_THRESHOLD_RATIO } from "./interceptors/rate-limit-interceptor/constants";
import {
	type RateLimitStatus,
	RateLimitAction,
} from "./interceptors/rate-limit-interceptor/types";

export const getRateLimitStatus = (
	remainingRequestsCount: number,
	requestLimit: number,
	actionCode: number,
): RateLimitStatus => {
	const warningThreshold = Math.ceil(requestLimit * WARNING_THRESHOLD_RATIO);

	if (actionCode > RateLimitAction.ALLOWED) {
		return "Exceeded";
	}

	if (remainingRequestsCount <= warningThreshold) {
		return "Warning";
	}

	return "OK";
};
