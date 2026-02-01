import type { DynamicModule } from "@nestjs/common";
import type { FactoryProvider } from "@nestjs/common/interfaces";
import { Global, Module } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import Redis from "ioredis";
import type redisConfig from "../config/redis.config";

import { RATE_LIMIT_INCR_SCRIPT } from "../rate-limiter/rate-limit-script";
import {
	RATE_LIMIT_COMMAND_NAME,
	RATE_LIMIT_COMMAND_NUMBER_OF_KEYS,
	REDIS_CLIENT_INJECT_TOKEN,
} from "./constants";

type RedisModuleOptions = ConfigType<typeof redisConfig>;

type RedisModuleAsyncOptions = {
	imports?: DynamicModule["imports"];
	useFactory: (
		...args: unknown[]
	) => RedisModuleOptions | Promise<RedisModuleOptions>;
	inject?: FactoryProvider["inject"];
};

@Global()
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: <Nestjs requires static methods for module configuration>
export class RedisModule {
	static forRootAsync(options: RedisModuleAsyncOptions): DynamicModule {
		const { useFactory, inject, imports } = options;

		const factory = async (...args: unknown[]): Promise<Redis> => {
			const config = await Promise.resolve(useFactory(...args));

			return RedisModule.createClient(config);
		};

		const redisClientProvider: FactoryProvider = {
			provide: REDIS_CLIENT_INJECT_TOKEN,
			useFactory: factory,
			inject,
		};

		return {
			module: RedisModule,
			imports,
			providers: [redisClientProvider],
			exports: [redisClientProvider],
		};
	}

	private static createClient(config: RedisModuleOptions): Redis {
		const client = new Redis(config);

		client.defineCommand(RATE_LIMIT_COMMAND_NAME, {
			lua: RATE_LIMIT_INCR_SCRIPT,
			numberOfKeys: RATE_LIMIT_COMMAND_NUMBER_OF_KEYS,
		});

		return client;
	}
}
