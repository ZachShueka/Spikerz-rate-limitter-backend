import { ExecutionContext } from "@nestjs/common";

export const createExecutionContext = ({
	headers,
	headerSpy,
}: {
	headers: Record<string, string | undefined>;
	headerSpy: jest.Mock;
}): ExecutionContext =>
	({
		switchToHttp: () => ({
			getRequest: () => ({ headers }),
			getResponse: () => ({ header: headerSpy }),
		}),
	}) as unknown as ExecutionContext;
