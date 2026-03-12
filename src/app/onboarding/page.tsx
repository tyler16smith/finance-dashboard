import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";
import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage() {
	const session = await auth();
	if (!session?.user) redirect("/auth/signin");

	const hasExistingData = await api.transaction.hasData();

	return <OnboardingFlow hasExistingData={hasExistingData} />;
}
