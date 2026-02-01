import { EventsGateway } from "src/events/events.gateway";
import { RateLimiterService } from "src/rate-limiter/rate-limiter.service";

export type MockedRedisService = Record<
	keyof Pick<RateLimiterService, "incrementUserRequestCounter">,
	jest.Mock
>;

export type MockedEventsGateway = Record<
	keyof Pick<EventsGateway, "broadcastRateUpdate" | "broadcastLimitExceeded">,
	jest.Mock
>;
