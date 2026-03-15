import { z } from "zod";
import { createTRPCRouter, demoOrProtectedProcedure, protectedProcedure } from "~/server/api/trpc";
import { requireDemoUserId } from "~/server/services/demo/demo-mode.service";

function normalize(name: string) {
	return name.replace(/^#/, "").toLowerCase().trim();
}

function display(name: string) {
	return name.replace(/^#/, "").trim();
}

export const hashtagRouter = createTRPCRouter({
	list: demoOrProtectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.isDemoMode ? await requireDemoUserId() : ctx.session!.user.id;
		return ctx.db.hashtag.findMany({
			where: { userId },
			orderBy: { name: "asc" },
			include: { _count: { select: { transactions: true } } },
		});
	}),

	setOnTransaction: protectedProcedure
		.input(
			z.object({
				transactionId: z.string(),
				hashtags: z.array(z.string()),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Verify transaction ownership
			const tx = await ctx.db.transaction.findFirst({
				where: { id: input.transactionId, userId },
			});
			if (!tx) throw new Error("Transaction not found");

			// Upsert all hashtags, get their ids
			const names = input.hashtags.map(display).filter(Boolean);
			const hashtagIds: string[] = [];

			for (const name of names) {
				const normalizedName = normalize(name);
				const hashtag = await ctx.db.hashtag.upsert({
					where: { userId_normalizedName: { userId, normalizedName } },
					create: { userId, name, normalizedName },
					update: {},
				});
				hashtagIds.push(hashtag.id);
			}

			// Replace all associations
			await ctx.db.transactionHashtag.deleteMany({
				where: { transactionId: input.transactionId },
			});

			if (hashtagIds.length > 0) {
				await ctx.db.transactionHashtag.createMany({
					data: hashtagIds.map((hashtagId) => ({
						transactionId: input.transactionId,
						hashtagId,
					})),
				});
			}

			return { success: true };
		}),
});
