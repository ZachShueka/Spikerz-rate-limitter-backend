import Redis from "ioredis";
import { RATE_LIMIT_COMMAND_NAME, RATE_LIMIT_COMMAND_NUMBER_OF_KEYS, RATE_LIMIT_SCRIPT } from "../../src/redis/constants";
import { testRedisHost, testRedisPort, testRedisDb } from "./constants";

export const testRedisFactory = () => {
	const testClient = new Redis({
		host: testRedisHost,
		port: testRedisPort,
		db: testRedisDb,
	});

	testClient.defineCommand(RATE_LIMIT_COMMAND_NAME, {
		numberOfKeys: RATE_LIMIT_COMMAND_NUMBER_OF_KEYS,
		lua: RATE_LIMIT_SCRIPT,
	});

	return testClient;
}

export const isFiniteNumber = (value: unknown): boolean =>
	Number.isFinite(Number(value));