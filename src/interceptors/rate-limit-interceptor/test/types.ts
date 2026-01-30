import { RedisService } from "../../../redis/redis.service";

export type MockedRedisService = Record<
	keyof Pick<RedisService, "incrementUserRequestCounter">,
	jest.Mock
>;
