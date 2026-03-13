import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const categoryRouter = createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.db.category.findMany({
            where: { OR: [{ userId: null }, { userId: ctx.session.user.id }] },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        });
    }),

    create: protectedProcedure
        .input(z.object({ name: z.string().min(1).max(100) }))
        .mutation(async ({ ctx, input }) => {
            return ctx.db.category.create({
                data: { userId: ctx.session.user.id, name: input.name },
            });
        }),

    update: protectedProcedure
        .input(z.object({ id: z.string(), name: z.string().min(1).max(100) }))
        .mutation(async ({ ctx, input }) => {
            const cat = await ctx.db.category.findFirst({
                where: { id: input.id, userId: ctx.session.user.id },
            });
            if (!cat) throw new Error("Category not found");
            return ctx.db.category.update({
                where: { id: input.id },
                data: { name: input.name },
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const cat = await ctx.db.category.findFirst({
                where: { id: input.id, userId: ctx.session.user.id },
            });
            if (!cat) throw new Error("Category not found");

            const uncategorized = await ctx.db.category.findFirst({
                where: { userId: null, name: "Uncategorized" },
            });
            if (uncategorized) {
                await ctx.db.transaction.updateMany({
                    where: { categoryId: input.id, userId: ctx.session.user.id },
                    data: { categoryId: uncategorized.id },
                });
            }

            await ctx.db.category.delete({ where: { id: input.id } });
            return { success: true };
        }),
});
