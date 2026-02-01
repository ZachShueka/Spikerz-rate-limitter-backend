import { ApiProperty } from "@nestjs/swagger";

export class ToggleSuspendDto {
	@ApiProperty({
		description: "Whether the user's access is suspended",
		example: true,
	})
	isSuspended: boolean;
}
