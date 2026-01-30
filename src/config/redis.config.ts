import { registerAs } from "@nestjs/config";

export interface RedisConfigObject {
	host: string;
	port: number;
	password?: string;
	db: number;
	keyPrefix?: string;
}

export default registerAs(
	"redis",
	(): RedisConfigObject => ({
		host: process.env.REDIS_HOST ?? "localhost",
		port: Number.parseInt(process.env.REDIS_PORT ?? "6379", 10),
		password: process.env.REDIS_PASSWORD,
		db: Number.parseInt(process.env.REDIS_DB ?? "0", 10),
		keyPrefix: process.env.REDIS_KEY_PREFIX,
	}),
);
