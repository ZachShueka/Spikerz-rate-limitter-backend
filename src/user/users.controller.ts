import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
// biome-ignore lint/style/useImportType: decorators require value imports
import { ApiTags } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { AdjustLimitDto } from "./dtos/adjust-limit.dto";
import { ToggleSuspendDto } from "./dtos/toggle-suspend.dto";
import { AddExtraRequestDto } from "./dtos/add-extra-request.dto";
import { UserBaseDataDto } from "./dtos/user-base-data.dto";
import { UserFullDataDto } from "./dtos/user-full-data.dto";
import {
	getAllUsersApiDecorators,
	getUserApiDecorators,
	resetUserRequestLimitApiDecorators,
	setSuspendApiDecorators,
	updateAllUsersRequestLimitApiDecorators,
	addRequestsToUserWindowApiDecorators,
} from "./swagger-api-decorators";

@ApiTags("users")
@Controller("users")
export class UsersController {
	constructor(private readonly userService: UsersService) {}

	@Get()
	@getAllUsersApiDecorators()
	getAllUsers(): Promise<UserBaseDataDto[]> {
		return this.userService.getAllUsersData();
	}

	@Get(":id")
	@getUserApiDecorators()
	getUser(@Param("id") userId: string): Promise<UserFullDataDto> {
		return this.userService.getUserData(userId);
	}

	@Post(":id/reset")
	@resetUserRequestLimitApiDecorators()
	async resetUserRequestLimit(@Param("id") userId: string): Promise<void> {
		this.userService.resetUserRequestLimit(userId);
	}

	@Patch("adjust-limit-all")
	@updateAllUsersRequestLimitApiDecorators()
	async updateAllUsersRequestLimit(
		@Body() body: AdjustLimitDto,
	): Promise<void> {
		this.userService.updateAllUsersRequestLimit(body.newLimit);
	}

	@Patch(":id/suspend")
	@setSuspendApiDecorators()
	async setSuspend(
		@Param("id") userId: string,
		@Body() body: ToggleSuspendDto,
	): Promise<void> {
		await this.userService.setSuspensionFlag(userId, body.isSuspended);
	}

	@Patch(":id/add-extra")
	@addRequestsToUserWindowApiDecorators()
	addRequestsToUserWindow(
		@Param("id") userId: string,
		@Body() body: AddExtraRequestDto,
	): Promise<void> {
		return this.userService.addRequestsToUserWindow(userId, body.amount);
	}
}
