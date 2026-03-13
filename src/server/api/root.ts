import { authRouter } from "~/server/api/routers/auth";
import { hashtagRouter } from "~/server/api/routers/hashtag";
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
	hashtag: hashtagRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
