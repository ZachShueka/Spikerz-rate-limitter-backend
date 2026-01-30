import type {
	CallHandler,
	ExecutionContext,
	NestInterceptor,
} from "@nestjs/common";
import {
	BadRequestException,
	HttpException,
	HttpStatus,
	Injectable,
} from "@nestjs/common";
import type { Observable } from "rxjs";
// biome-ignore lint/style/useImportType: RedisService is needed at runtime for Nest DI metadata.
import { RedisService } from "../../redis/redis.service";
import {
	COUNT_HEADER,
	MISSING_USER_ID_HEADER_MESSAGE,
	RATE_LIMIT_MESSAGE_PREFIX,
	TOO_MANY_REQUESTS_ERROR,
	USER_ID_HEADER,
} from "./constants";

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
	private readonly LIMIT = 11;//TODO REFACTOR AFTER REQUEST LIMIT CHANGE BY ADMIN IS IMPLEMENTED (e.g. request limit is 100, but admin changes it to 200) + INCREASE BY 1 BUG 

	constructor(private readonly redisService: RedisService) {}

	async intercept(
		context: ExecutionContext,
		next: CallHandler,
	): Promise<Observable<unknown>> {
		const http = context.switchToHttp();
		const request = http.getRequest();
		const response = http.getResponse();

		const userId = request.headers[USER_ID_HEADER];

		if (!userId) {
			throw new BadRequestException(MISSING_USER_ID_HEADER_MESSAGE);
		}

		const result = await this.redisService.incrementUserRequestCounter(
			userId,
			this.LIMIT,
		);

		response.header(COUNT_HEADER, result.remainingRequestsCount);
		console.log(result.currentRequestsCount, this.LIMIT);
		if (result.currentRequestsCount > this.LIMIT) {
			const tryAgainDate = new Date(result.resetTime).toLocaleString();

			throw new HttpException(
				{
					statusCode: HttpStatus.TOO_MANY_REQUESTS,
					error: TOO_MANY_REQUESTS_ERROR,
					message: `${RATE_LIMIT_MESSAGE_PREFIX} ${tryAgainDate}`,
					tryAgainAt: result.resetTime,
				},
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}

		return next.handle();
	}
}
