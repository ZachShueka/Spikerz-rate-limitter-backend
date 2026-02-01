import { Controller, Get, UseInterceptors } from "@nestjs/common";
import { AppService } from "./app.service";
import { RateLimitInterceptor } from "./shared/interceptors/rate-limit-interceptor/rate-limit.interceptor";
import { USER_ID_HEADER } from "./shared/interceptors/rate-limit-interceptor/constants";
import { ApiHeader } from "@nestjs/swagger";

@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}
	@Get()
	@ApiHeader({
		name: USER_ID_HEADER,
		description: "The ID of the user",
		required: true,
		example: "user123",
	})
	@UseInterceptors(RateLimitInterceptor)
	getHello(): string {
		return this.appService.getHello();
	}
}
