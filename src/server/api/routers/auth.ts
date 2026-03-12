import { TRPCError } from "@trpc/server";
import bcryptjs from "bcryptjs";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const authRouter = createTRPCRouter({
	register: publicProcedure
		.input(
			z.object({
				name: z.string().min(1, "Name is required"),
				email: z.string().email("Invalid email"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.user.findUnique({
				where: { email: input.email },
			});

			if (existing) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "An account with this email already exists.",
				});
			}

			const hashed = await bcryptjs.hash(input.password, 12);

			const user = await ctx.db.user.create({
				data: {
					name: input.name,
					email: input.email,
					password: hashed,
				},
				select: { id: true, email: true, name: true },
			});

			return user;
		}),
});
