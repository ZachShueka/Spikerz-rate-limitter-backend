import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import redisConfig from "./config/redis.config";
import { EventsModule } from "./events/events.module";
import { UsersModule } from "./user/users.module";
import { RateLimitModule } from "./rate-limiter/rate-limiter.module";
import { RedisModule } from "./redis/redis.module";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			load: [redisConfig],
		}),
		RedisModule.forRootAsync(redisConfig.asProvider()),
		EventsModule,
		RateLimitModule,
		UsersModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
