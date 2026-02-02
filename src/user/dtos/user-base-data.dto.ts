import { ApiProperty } from "@nestjs/swagger";

export class UserBaseDataDto {
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

	@ApiProperty({ example: true })
	isSuspended: boolean;
}