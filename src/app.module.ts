import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import redisConfig from "./config/redis.config";
import { RateLimitInterceptor } from "./interceptors/rate-limit-interceptor/rate-limit.interceptor";
import { RedisModule } from "./redis/redis.module";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			load: [redisConfig],
		}),
		RedisModule.forRootAsync(redisConfig.asProvider()),
	],
	controllers: [AppController],
	providers: [
		AppService,
		{
			provide: APP_INTERCEPTOR,
			useClass: RateLimitInterceptor,
		},
	],
})
export class AppModule {}
