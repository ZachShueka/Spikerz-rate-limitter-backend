import { Test } from "@nestjs/testing";
import { HttpStatus, type INestApplication } from "@nestjs/common";
import request from "supertest";
import Redis from "ioredis";
import { AppModule } from "../../src/app.module";
import {
	COUNT_HEADER,
	MISSING_USER_ID_HEADER_MESSAGE,
	RATE_LIMIT_MESSAGE_PREFIX,
	USER_ID_HEADER,
} from "../../src/interceptors/rate-limit-interceptor/constants";
import {
	REDIS_CLIENT_INJECT_TOKEN,
} from "../../src/redis/constants";
import { routePath, successUserId, requestLimit, limitUserId, resetTimeField } from "./constants";
import { testRedisFactory, isFiniteNumber } from "./utilites";


describe("Rate limiting (e2e)", () => {
	let app: INestApplication;
	let redisClient: Redis | undefined;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(REDIS_CLIENT_INJECT_TOKEN)
			.useFactory({
				factory: testRedisFactory,
			}).compile();

		app = moduleRef.createNestApplication();
		await app.init();

		redisClient = app.get<Redis>(REDIS_CLIENT_INJECT_TOKEN, {
			strict: false,
		});
	});

	afterAll(async () => {
		await redisClient?.flushdb();
		await redisClient?.quit();
		await app.close();
	});

	it("allows request under limit and sets x-count header", async () => {
		const response = await request(app.getHttpServer())
			.get(routePath)
			.set(USER_ID_HEADER, successUserId)

		const countHeader = response.headers[COUNT_HEADER];
		
		expect(response.status).toBe(HttpStatus.OK);
		expect(countHeader).toBeDefined();
		expect(isFiniteNumber(countHeader)).toBe(true);
	});

	it(`returns 400 Bad Request when the ${USER_ID_HEADER} header is missing`, async () => {
		const response = await request(app.getHttpServer())
			.get(routePath)

		expect(response.status).toBe(HttpStatus.BAD_REQUEST);
		expect(response.body.message).toBe(MISSING_USER_ID_HEADER_MESSAGE);
	});

	it("returns 429 with tryAgainAt after hitting the limit", async () => {
		const server = app.getHttpServer();

		for (let i = 0; i < requestLimit; i += 1) {
			await request(server).get(routePath).set(USER_ID_HEADER, limitUserId);
		}

		const response = await request(server)
			.get(routePath)
			.set(USER_ID_HEADER, limitUserId)

		expect(response.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
		expect(response.body[resetTimeField]).toBeDefined();
		expect(isFiniteNumber(response.body[resetTimeField])).toBe(true);
		expect(response.body.message).toContain(RATE_LIMIT_MESSAGE_PREFIX);
	});
});
