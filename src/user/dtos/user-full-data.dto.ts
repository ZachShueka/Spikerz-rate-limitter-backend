import type { RateUpdateDto } from "src/events/dtos/rate-update.dto";
import { ApiProperty } from "@nestjs/swagger";

/** Swagger schema for user registry data. */
class UserRegistryDataSchema {
	@ApiProperty({ description: "Whether the user is manually suspended" })
	isSuspended: boolean;

	@ApiProperty({ description: "Base request limit for the user" })
	baseRequestLimit: number;

	@ApiProperty({ description: "Timestamp of the last request (ms)" })
	lastRequestTimestamp: number;
}

/** Swagger schema for current window consumption. */
class UserWindowDataSchema {
	@ApiProperty({ description: "Current request limit for the window" })
	currentRequestLimit: number;

	@ApiProperty({ description: "Number of requests used in the window" })
	requestCount: number;

	@ApiProperty({ description: "Window duration in milliseconds" })
	windowDurationMs: number;
}

export class UserFullDataDto {
	@ApiProperty({ description: "User identifier" })
	userId: string;

	@ApiProperty({ type: UserRegistryDataSchema })
	registryData: UserRegistryDataSchema;

	@ApiProperty({ type: UserWindowDataSchema })
	windowData: UserWindowDataSchema;

	@ApiProperty({
		type: [Array<RateUpdateDto>],
		description: "Recent request history",
	})
	requestsHistory: RateUpdateDto[];
}
