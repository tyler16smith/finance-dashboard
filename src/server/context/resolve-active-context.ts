import { db } from "~/server/db";

const DEMO_USER_EMAIL = "demo@internal.system";

let cachedDemoUserId: string | null = null;

/**
 * Resolves the demo system user's ID, with in-process caching.
 * Returns null if the demo user has not been seeded yet.
 */
export async function getDemoUserId(): Promise<string | null> {
	if (cachedDemoUserId) return cachedDemoUserId;

	const demoUser = await db.user.findUnique({
		where: { email: DEMO_USER_EMAIL },
		select: { id: true },
	});

	if (demoUser) {
		cachedDemoUserId = demoUser.id;
		return demoUser.id;
	}

	return null;
}

/**
 * Resolves the active data user ID for a request.
 * In demo mode: returns the seeded demo system user's ID.
 * In personal mode: returns the authenticated user's ID.
 */
export async function resolveActiveUserId(ctx: {
	isDemoMode: boolean;
	session: { user: { id: string } } | null;
}): Promise<string | null> {
	if (ctx.isDemoMode) {
		return getDemoUserId();
	}
	return ctx.session?.user.id ?? null;
}
