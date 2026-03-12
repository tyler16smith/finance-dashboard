import { PrismaAdapter } from "@auth/prisma-adapter";
import bcryptjs from "bcryptjs";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";

import { db } from "~/server/db";

declare module "next-auth" {
	interface Session extends DefaultSession {
		user: {
			id: string;
		} & DefaultSession["user"];
	}
}

export const authConfig = {
	providers: [
		Google,
		Credentials({
			name: "credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				const parsed = z
					.object({ email: z.string().email(), password: z.string().min(1) })
					.safeParse(credentials);

				if (!parsed.success) return null;

				const user = await db.user.findUnique({
					where: { email: parsed.data.email },
					select: {
						id: true,
						email: true,
						name: true,
						image: true,
						password: true,
					},
				});

				if (!user?.password) return null;

				const passwordMatch = await bcryptjs.compare(
					parsed.data.password,
					user.password,
				);

				if (!passwordMatch) return null;

				return {
					id: user.id,
					email: user.email,
					name: user.name,
					image: user.image,
				};
			},
		}),
	],
	adapter: PrismaAdapter(db),
	session: { strategy: "jwt" },
	callbacks: {
		jwt({ token, user }) {
			if (user) token.id = user.id;
			return token;
		},
		session({ session, token }) {
			if (token.id) {
				session.user.id = token.id as string;
			}
			return session;
		},
	},
	pages: {
		signIn: "/auth/signin",
	},
} satisfies NextAuthConfig;
