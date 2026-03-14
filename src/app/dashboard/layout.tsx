import { redirect } from "next/navigation";
import { DashboardProviders } from "~/components/layout/dashboard-providers";
import { Sidebar } from "~/components/layout/sidebar";
import { TopNav } from "~/components/layout/topnav";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await auth();
	if (!session?.user) redirect("/auth/signin");

	// Check if user has any transactions; if not, redirect to onboarding
	const hasData = await api.transaction.hasData();
	if (!hasData) redirect("/onboarding");

	return (
		<DashboardProviders>
			<div className="flex h-screen overflow-hidden bg-background">
				<div className="hidden md:flex">
					<Sidebar />
				</div>
				<div className="flex flex-1 flex-col overflow-hidden">
					<TopNav />
					<main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
				</div>
			</div>
		</DashboardProviders>
	);
}
