import { ApiProperty } from "@nestjs/swagger";

export class AddExtraRequestDto {
	@ApiProperty({
		description: "Number of extra requests to add to the user's current window",
		example: 5,
		minimum: 1,
	})
	amount: number;
}
