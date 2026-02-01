export type UserRegistryData = {
	isSuspended: boolean;
	baseRequestLimit: number;
	lastRequestTimestamp: number;
};

export type UserWindowData = {
	currentRequestLimit: number;
	requestCount: number;
	windowDurationMs: number;
};
