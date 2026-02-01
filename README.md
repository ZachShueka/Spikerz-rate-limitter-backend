<p align="center"><a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a></p><p align="center">A high-performance <b>Rate Limiting & Monitoring System</b> built with <a href="http://nodejs.org" target="_blank">Node.js</a>, <a href="https://redis.io" target="_blank">Redis</a>, and <a href="https://socket.io" target="_blank">WebSockets</a>.</p><p align="center"><img src="https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white" alt="NestJS Version" /><img src="https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white" alt="Redis Requirement" /><img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" /><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License" /></p>

### Description
This project implements a robust rate-limiting architecture designed for scalability and real-time observability.
Using atomic Lua scripts in Redis, it manages user quotas while providing an administrative dashboard with live updates via WebSockets.

### Redis Schema & Namespaces
```text
+--------------------------------+------------+-----------------------------------------------------------+
| Namespace                      | Redis Type | Description                                               |
+--------------------------------+------------+-----------------------------------------------------------+
| rate-limit:registry:<userId>   | Hash       | Stores user metadata and admin status (e.g., isSuspended) |
| rate-limit:window:<userId>     | Hash       | Tracks active window (request count & reset time)         |
| rate-limit:history:<userId>    | List       | A rolling journal of x most recent request interactions   |
+--------------------------------+------------+-----------------------------------------------------------+
```

### Prerequisites
##### .env file with REDIS_HOST,
REDIS_PORT,
REDIS_PASSWORD,
REDIS_DB

##### Running redis instance
##### npm install

### Running the app
#### development
$ npm run start

#### watch mode
$ npm run start:dev

#### Test Suite
The system includes a unit test for the rate limit interceptor, to run : 
$ npm run test

#### Swagger Documentation
Access the interactive documentation at /api.

#### Manual Test
curl -i -H "x-user-id: user123" http://localhost:3000/

#### Interceptor Workflow
##### Extraction:
Retrieve userId from headers.
##### Increment:
Atomic check and increment via Redis Lua.
##### Broadcasting:
Send real-time status to the EventsGateway.
##### Action:
###### 200 OK: Request allowed.
###### 401 Unauthorized: No 'x-user-id' header provided.
###### 403 Forbidden: User manually suspended.
###### 429 Too Many Requests: Quota exhausted.