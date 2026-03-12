import { authRouter } from "~/server/api/routers/auth";
import { investmentRouter } from "~/server/api/routers/investment";
import { scenarioRouter } from "~/server/api/routers/scenario";
import { spendingRouter } from "~/server/api/routers/spending";
import { transactionRouter } from "~/server/api/routers/transaction";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
	auth: authRouter,
	transaction: transactionRouter,
	investment: investmentRouter,
	scenario: scenarioRouter,
	spending: spendingRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
