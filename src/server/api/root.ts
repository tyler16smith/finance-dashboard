import { authRouter } from "~/server/api/routers/auth";
import { categoryRouter } from "~/server/api/routers/category";
import { hashtagRouter } from "~/server/api/routers/hashtag";
import { investmentRouter } from "~/server/api/routers/investment";
import { realEstateRouter } from "~/server/api/routers/real-estate";
import { ruleRouter } from "~/server/api/routers/rule";
import { scenarioRouter } from "~/server/api/routers/scenario";
import { spendingRouter } from "~/server/api/routers/spending";
import { transactionRouter } from "~/server/api/routers/transaction";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
	auth: authRouter,
	transaction: transactionRouter,
	investment: investmentRouter,
	realEstate: realEstateRouter,
	scenario: scenarioRouter,
	spending: spendingRouter,
	hashtag: hashtagRouter,
	rule: ruleRouter,
	category: categoryRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
