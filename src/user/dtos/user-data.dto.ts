import type { RateUpdateDto } from "src/events/dtos/rate-update.dto";
import type { UserRegistryData, UserWindowData } from "../types";

export type UserDataDto = {
	userId: string;
	registryData: UserRegistryData;
	windowData: UserWindowData;
	requestsHistory: RateUpdateDto[];
};
