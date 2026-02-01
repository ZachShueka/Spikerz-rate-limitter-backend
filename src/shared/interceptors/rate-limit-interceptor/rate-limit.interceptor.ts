/** biome-ignore-all lint/style/useImportType: <needed at runtime for Nest DI metadata> */
import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
	UnauthorizedException,
	ForbiddenException,
	HttpException,
	HttpStatus,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { EventsGateway } from "src/events/events.gateway";
import { RateLimiterService } from "src/rate-limiter/rate-limiter.service";
import { getRateLimitStatus } from "src/shared/utilites";
import {
	USER_ID_HEADER,
	MISSING_USER_ID_HEADER_MESSAGE,
	COUNT_HEADER,
	TOO_MANY_REQUESTS_ERROR,
	RATE_LIMIT_MESSAGE_PREFIX,
} from "./constants";
import { RateLimitAction } from "./types";

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
	constructor(
		private readonly rateLimiterRepository: RateLimiterService,
		private readonly eventsGateway: EventsGateway,
	) {}

	async intercept(
		context: ExecutionContext,
		next: CallHandler,
	): Promise<Observable<unknown>> {
		const http = context.switchToHttp();
		const request = http.getRequest();
		const response = http.getResponse();

		const userId = request.headers[USER_ID_HEADER];

		if (!userId) {
			throw new UnauthorizedException(MISSING_USER_ID_HEADER_MESSAGE);
		}

		const {
			remainingRequestsCount,
			resetTimeTimestamp,
			actionCode,
			lastRequestTimestamp,
			totalRequestsAllowed,
		} = await this.rateLimiterRepository.incrementUserRequestCounter(userId);

		const rateLimitStatus = getRateLimitStatus(
			remainingRequestsCount,
			totalRequestsAllowed,
			actionCode,
		);

		this.eventsGateway.broadcastRateUpdate({
			userId,
			remainingRequestsCount,
			totalRequestsAllowed,
			resetTimeTimestamp,
			rateLimitStatus,
			lastRequestTimestamp,
		});

		switch (actionCode) {
			case RateLimitAction.MANUAL_SUSPENSION: {
				throw new ForbiddenException(
					"Your access has been suspended by an administrator.",
				);
			}

			case RateLimitAction.JUST_REACHED: {
				this.eventsGateway.broadcastLimitExceeded({ userId });

				response.header(COUNT_HEADER, remainingRequestsCount);
				break;
			}

			case RateLimitAction.ALREADY_BLOCKED: {
				const tryAgainDate = new Date(resetTimeTimestamp).toLocaleString();

				throw new HttpException(
					{
						statusCode: HttpStatus.TOO_MANY_REQUESTS,
						error: TOO_MANY_REQUESTS_ERROR,
						message: `${RATE_LIMIT_MESSAGE_PREFIX} ${tryAgainDate}`,
						tryAgainAt: resetTimeTimestamp,
					},
					HttpStatus.TOO_MANY_REQUESTS,
				);
			}

			case RateLimitAction.ALLOWED: {
				response.header(COUNT_HEADER, remainingRequestsCount);
				break;
			}
		}

		return next.handle();
	}
}
