import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type {
	OnGatewayConnection,
	OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import type { RateUpdateDto } from "./dtos/rate-update.dto";
import type { LimitExceededDto } from "./dtos/limit-exceeded.dto";

@WebSocketGateway({
	cors: {
		origin: "*", // In production, replace with your specific frontend URL
	},
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer()
	private readonly server: Server;

	private readonly logger = new Logger(EventsGateway.name);

	handleConnection(client: Socket) {
		this.logger.log(`Client connected: ${client.id}`);
	}

	handleDisconnect(client: Socket) {
		this.logger.log(`Client disconnected: ${client.id}`);
	}

	broadcastRateUpdate(payload: RateUpdateDto): void {
		this.server.emit("rate:update", payload);
	}

	broadcastLimitExceeded(payload: LimitExceededDto): void {
		this.server.emit("rate:limit_exceeded", payload);
	}
}
