<p align="center"><a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a></p><p align="center">A high-performance, distributed <b>Rate Limiting & Monitoring System</b> built with <a href="http://nodejs.org" target="_blank">Node.js</a>, <a href="https://redis.io" target="_blank">Redis</a>, and <a href="https://socket.io" target="_blank">WebSockets</a>.</p><p align="center"><img src="https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white" alt="NestJS Version" /><img src="https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white" alt="Redis Requirement" /><img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" /><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License" /></p>🛡️ Description
This project implements a robust distributed rate-limiting architecture designed for scalability and real-time observability. Using atomic Lua scripts in Redis, it manages user quotas across multiple instances while providing an administrative dashboard with live updates via WebSockets.🏗️ Redis Schema & NamespacesThe system utilizes a structured namespace convention for efficiency and clarity. Note: Ensure your Redis configuration does not use a conflicting keyPrefix to maintain namespace integrity.NamespaceRedis TypeDescriptionrate-limit:registry:<userId>HashStores user metadata and administrative status (e.g., isSuspended).rate-limit:window:<userId>HashManages the active sliding window (current count and reset timestamp).rate-limit:history:<userId>ListStores a rolling history of the most recent request interactions.🚦 FeaturesDistributed Logic: Atomic Lua scripts prevent race conditions.Fail-Fast Interceptor: Real-time evaluation of OK, Warning, and Exceeded states.Admin Dashboard: Live WebSocket broadcasts for quota violations and warnings.Fail-Safe Scanning: Optimized SCAN implementation for dashboard hydration without blocking Redis.🛠️ Project SetupPrerequisitesRedis is a mandatory requirement for this project to handle state and atomic increment logic.Bash$ npm install
🏃 Running the appBash# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod

🧪 Test Suite
The system includes a unit test for the rate limit interceptor logic.Bash#
$ npm run test

📡 API Usage
The system expects the user identifier to be passed via the x-user-id header.

Swagger Documentation
Access the interactive documentation at /api.

Manual Test
curl -i -H "x-user-id: user123" http://localhost:3000/

⚙️ Interceptor Workflow
Extraction: Retrieve userId from headers.
Increment: Atomic check and increment via Redis Lua.
Broadcasting: Send real-time status to the EventsGateway.
Action:
200 OK: Request allowed.
401 Unauthorized: No 'x-user-id' header provided.
403 Forbidden: User manually suspended.
429 Too Many Requests: Quota exhausted.