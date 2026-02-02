import { Injectable } from "@nestjs/common";
import { GLOBAL_REQUEST_LIMIT_DEFAULT } from "../rate-limiter/constants";
import { UsersRepository } from "./users.repository";
import type { UserFullDataDto } from "./dtos/user-full-data.dto";
import { UserBaseDataDto } from "./dtos/user-base-data.dto";

@Injectable()
export class UsersService {
	constructor(private readonly _usersRepository: UsersRepository) {}

	async getAllUsersData(): Promise<UserBaseDataDto[]> {
		return this._usersRepository.findAllUsers();
	}

	async getUserData(userId: string): Promise<UserFullDataDto> {
		return this._usersRepository.findOne(userId);
	}

	/**
	 * Reset the user's request limit to the default limit.
	 */
	async resetUserRequestLimit(userId: string) {
		this._usersRepository.updateUserLimits(
			userId,
			GLOBAL_REQUEST_LIMIT_DEFAULT,
		);
	}

	async updateAllUsersRequestLimit(newLimit: number): Promise<void> {
		this._usersRepository.updateAllUsersRequestLimit(newLimit);
	}

	async setSuspensionFlag(userId: string, isSuspended: boolean): Promise<void> {
		this._usersRepository.updateUserRegistry(userId, { isSuspended });
	}

	/**
	 * Adds {requestAmountToAdd} requests to the user's window.
	 */
	async addRequestsToUserWindow(
		userId: string,
		requestAmountToAdd: number,
	): Promise<void> {
		this._usersRepository.addRequestsToUserWindow(userId, requestAmountToAdd);
	}
}
