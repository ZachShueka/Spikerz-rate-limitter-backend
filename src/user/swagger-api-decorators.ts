import {
	ApiNotFoundResponse,
	ApiOperation,
	ApiOkResponse,
	ApiParam,
    ApiBody,
} from "@nestjs/swagger";
import { UserBaseDataDto } from "./dtos/user-base-data.dto";
import { applyDecorators } from "@nestjs/common";
import { UserFullDataDto } from "./dtos/user-full-data.dto";
import { AdjustLimitDto } from "./dtos/adjust-limit.dto";
import { ToggleSuspendDto } from "./dtos/toggle-suspend.dto";
import { AddExtraRequestDto } from "./dtos/add-extra-request.dto";

export const getAllUsersApiDecorators = (): MethodDecorator =>
	applyDecorators(
		ApiOperation({
			summary: "List all users",
			description: "Returns rate-limit summary for every user in the registry.",
		}),
		ApiOkResponse({
			description: "List of user rate-limit summaries",
			type: [Array<UserBaseDataDto>],
		}),
	);

export const getUserApiDecorators = (): MethodDecorator =>
	applyDecorators(
		ApiOperation({
			summary: "Get user by ID",
			description:
				"Returns full rate-limit state for a user (registry, window, request history).",
		}),
		ApiParam({
			name: "id",
			description: "User identifier",
			example: "user123",
		}),
		ApiOkResponse({
			description: "User data",
			type: UserFullDataDto,
		}),
		ApiNotFoundResponse({
			description: "User not found in the rate-limit registry",
		}),
	);

export const resetUserRequestLimitApiDecorators = (): MethodDecorator =>
	applyDecorators(
		ApiOperation({
			summary: "Reset user request limit",
			description: "Resets the request limit for a user.",
		}),
		ApiParam({
			name: "id",
			description: "User identifier",
			example: "user123",
		}),
	);

    export const updateAllUsersRequestLimitApiDecorators = (): MethodDecorator =>
	applyDecorators(
		ApiOperation({
			summary: "Update all users request limit",
			description: "Updates the request limit for all users.",
		}),
		ApiBody({ type: AdjustLimitDto }),
		ApiOkResponse({
			description: "All users request limit updated",
		}),
	);

export const setSuspendApiDecorators = (): MethodDecorator =>
	applyDecorators(
		ApiOperation({
			summary: "Set suspend flag",
			description: "Sets the suspend flag for a user.",
		}),
		ApiParam({ name: "id", description: "User identifier", example: "user123" }),
		ApiBody({ type: ToggleSuspendDto }),
		ApiOkResponse({
			description: "Suspend flag set",
		}),
	);

    export const addRequestsToUserWindowApiDecorators = (): MethodDecorator =>
	applyDecorators(
		ApiOperation({
			summary: "Add requests to user window",
			description: "Adds requests to the user's window.",
		}),
		ApiParam({ name: "id", description: "User identifier", example: "user123" }),
		ApiBody({ type: AddExtraRequestDto }),
		ApiOkResponse({
			description: "Requests added to user window",
		}),
	);

    