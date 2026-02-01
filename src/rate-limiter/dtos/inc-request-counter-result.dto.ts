export type IncRequestCounterResult = {
	currentRequestsCount: number;
	remainingRequestsCount: number;
	resetTimeTimestamp: number;
	actionCode: number;
	lastRequestTimestamp: number;
	totalRequestsAllowed: number;
};
