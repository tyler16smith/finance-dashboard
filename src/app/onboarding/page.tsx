import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";
import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage() {
	const session = await auth();
	if (!session?.user) redirect("/auth/signin");

	// If they already have data, send them to the dashboard
	const hasData = await api.transaction.hasData();
	if (hasData) redirect("/dashboard");

	return <OnboardingFlow />;
}
