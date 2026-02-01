export type RateLimitStatus = "OK" | "Warning" | "Exceeded";

export enum RateLimitAction {
	ALLOWED = 0,
	JUST_REACHED = 1,
	ALREADY_BLOCKED = 2,
	MANUAL_SUSPENSION = 3,
}
