import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
// biome-ignore lint/style/useImportType: decorators require value imports
import {
	ApiTags,
	ApiOperation,
	ApiParam,
	ApiBody,
	ApiOkResponse,
	ApiNotFoundResponse,
	ApiBadRequestResponse,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { AdjustLimitDto } from "./dtos/adjust-limit.dto";
import { ToggleSuspendDto } from "./dtos/toggle-suspend.dto";
import { AddExtraRequestDto } from "./dtos/add-extra-request.dto";
import {
	UserDataResponseSchema,
	RateUpdateSchema,
	ResetResponseSchema,
	AdjustLimitResponseSchema,
	SuspendResponseSchema,
} from "./dtos/swagger-response.dto";

@ApiTags("users")
@Controller("users")
export class UsersController {
	constructor(private readonly userService: UsersService) {}

	@Get()
	@ApiOperation({
		summary: "List all users",
		description: "Returns rate-limit summary for every user in the registry.",
	})
	@ApiOkResponse({
		description: "List of user rate-limit summaries",
		type: [RateUpdateSchema],
	})
	getAllUsers() {
		return this.userService.getAllUsersData();
	}

	@Get(":id")
	@ApiOperation({
		summary: "Get user by ID",
		description:
			"Returns full rate-limit state for a user (registry, window, request history).",
	})
	@ApiParam({ name: "id", description: "User identifier", example: "user123" })
	@ApiOkResponse({
		description: "User rate-limit data",
		type: UserDataResponseSchema,
	})
	@ApiNotFoundResponse({
		description: "User not found in the rate-limit registry",
	})
	getUser(@Param("id") userId: string) {
		return this.userService.getUserData(userId);
	}

	@Post(":id/reset")
	@ApiOperation({
		summary: "Reset user request limit",
		description: "Resets the user's rate-limit window to the default limit.",
	})
	@ApiParam({ name: "id", description: "User identifier", example: "user123" })
	@ApiOkResponse({
		description: "Reset confirmed",
		type: ResetResponseSchema,
	})
	async resetUserRequestLimit(@Param("id") userId: string) {
		await this.userService.resetUserRequestLimit(userId);
		return { userId, reset: true };
	}

	@Patch("adjust-limit-all")
	@ApiOperation({
		summary: "Adjust limit for all users",
		description:
			"Updates the base request limit for every user in the registry.",
	})
	@ApiBody({ type: AdjustLimitDto })
	@ApiOkResponse({
		description: "Limit updated for all users",
		type: AdjustLimitResponseSchema,
	})
	@ApiBadRequestResponse({
		description: "Invalid body (e.g. missing or invalid newLimit)",
	})
	async updateAllUsersRequestLimit(@Body() body: AdjustLimitDto) {
		await this.userService.updateAllUsersRequestLimit(body.newLimit);
		return { updated: true };
	}

	@Patch(":id/suspend")
	@ApiOperation({
		summary: "Suspend or unsuspend user",
		description:
			"Sets the manual suspension flag for the user (403 when suspended).",
	})
	@ApiParam({ name: "id", description: "User identifier", example: "user123" })
	@ApiBody({ type: ToggleSuspendDto })
	@ApiOkResponse({
		description: "Suspension state updated",
		type: SuspendResponseSchema,
	})
	async setSuspend(
		@Param("id") userId: string,
		@Body() body: ToggleSuspendDto,
	) {
		await this.userService.setSuspensionFlag(userId, body.isSuspended);
		return { userId, suspended: body.isSuspended };
	}

	@Patch(":id/add-extra")
	@ApiOperation({
		summary: "Add extra requests to user window",
		description: "Adds a number of requests to the user's current window.",
	})
	@ApiParam({ name: "id", description: "User identifier", example: "user123" })
	@ApiBody({ type: AddExtraRequestDto })
	@ApiOkResponse({
		description: "Extra requests added (service returns void; 200 on success)",
	})
	addRequestsToUserWindow(
		@Param("id") userId: string,
		@Body() body: AddExtraRequestDto,
	) {
		return this.userService.addRequestsToUserWindow(userId, body.amount);
	}
}
