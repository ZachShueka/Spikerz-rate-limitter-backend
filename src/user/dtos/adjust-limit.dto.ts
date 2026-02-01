import { ApiProperty } from "@nestjs/swagger";

export class AdjustLimitDto {
	@ApiProperty({
		description: "New request limit to apply to all users",
		example: 100,
		minimum: 1,
	})
	newLimit: number;
}
