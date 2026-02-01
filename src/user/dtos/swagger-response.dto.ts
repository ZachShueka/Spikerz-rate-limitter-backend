import { ApiProperty } from "@nestjs/swagger";

/** Swagger schema for user registry data (rate-limit settings). */
export class UserRegistryDataSchema {
	@ApiProperty({ description: "Whether the user is manually suspended" })
	isSuspended: boolean;

	@ApiProperty({ description: "Base request limit for the user" })
	baseRequestLimit: number;

	@ApiProperty({ description: "Timestamp of the last request (ms)" })
	lastRequestTimestamp: number;
}

/** Swagger schema for current window consumption. */
export class UserWindowDataSchema {
	@ApiProperty({ description: "Current request limit for the window" })
	currentRequestLimit: number;

	@ApiProperty({ description: "Number of requests used in the window" })
	requestCount: number;

	@ApiProperty({ description: "Window duration in milliseconds" })
	windowDurationMs: number;
}

/** Swagger schema for a single rate update (request history entry). */
export class RateUpdateSchema {
	@ApiProperty()
	userId: string;

	@ApiProperty()
	remainingRequestsCount: number;

	@ApiProperty()
	totalRequestsAllowed: number;

	@ApiProperty()
	resetTimeTimestamp: number;

	@ApiProperty({ enum: ["OK", "Warning", "Exceeded"] })
	rateLimitStatus: string;

	@ApiProperty()
	lastRequestTimestamp: number;
}

/** Swagger schema for full user rate-limit data (GET :id). */
export class UserDataResponseSchema {
	@ApiProperty({ description: "User identifier" })
	userId: string;

	@ApiProperty({ type: UserRegistryDataSchema })
	registryData: UserRegistryDataSchema;

	@ApiProperty({ type: UserWindowDataSchema })
	windowData: UserWindowDataSchema;

	@ApiProperty({
		type: [RateUpdateSchema],
		description: "Recent request history",
	})
	requestsHistory: RateUpdateSchema[];
}

/** Response schema for reset endpoint. */
export class ResetResponseSchema {
	@ApiProperty()
	userId: string;

	@ApiProperty({ example: true })
	reset: boolean;
}

/** Response schema for adjust-limit-all endpoint. */
export class AdjustLimitResponseSchema {
	@ApiProperty({ example: true })
	updated: boolean;
}

/** Response schema for suspend endpoint. */
export class SuspendResponseSchema {
	@ApiProperty()
	userId: string;

	@ApiProperty()
	suspended: boolean;
}
