import type { DynamicModule } from "@nestjs/common";
import type { FactoryProvider } from "@nestjs/common/interfaces";
import { Module } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import Redis from "ioredis";
import redisConfig from "../config/redis.config";
import {
	RATE_LIMIT_COMMAND_NAME,
	RATE_LIMIT_COMMAND_NUMBER_OF_KEYS,
	RATE_LIMIT_SCRIPT,
	REDIS_CLIENT_INJECT_TOKEN,
} from "./constants";
import { RedisService } from "./redis.service";

type RedisModuleOptions = ConfigType<typeof redisConfig>;

type RedisModuleAsyncOptions = {
	imports?: DynamicModule["imports"];
	useFactory: (
		...args: unknown[]
	) => RedisModuleOptions | Promise<RedisModuleOptions>;
	inject?: FactoryProvider["inject"];
}

@Module({
	providers: [RedisService],
	exports: [RedisService],
})
export class RedisModule {
	static forRootAsync(options: RedisModuleAsyncOptions): DynamicModule {
		const { useFactory, inject, imports } = options;

		const factory = async (...args: unknown[]): Promise<Redis> => {
			const config = await Promise.resolve(
				useFactory(...args),
			);
			
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
			providers: [redisClientProvider, RedisService],
			exports: [RedisService],
		};
	}

	private static createClient(config: RedisModuleOptions): Redis {
		const client = new Redis(config);

		client.defineCommand(RATE_LIMIT_COMMAND_NAME, {
			lua: RATE_LIMIT_SCRIPT,
			numberOfKeys: RATE_LIMIT_COMMAND_NUMBER_OF_KEYS,
		});

		return client;
	}
}
