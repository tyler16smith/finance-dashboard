import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe config — no Prisma adapter, no bcryptjs, no Credentials provider.
// Used exclusively in middleware (Edge Runtime).
export const edgeAuthConfig = {
	providers: [Google],
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
