import { PrismaClient } from "../../generated/prisma";

const DEMO_USER_EMAIL = "demo@internal.system";

export async function seedDemoWorkspace(db: PrismaClient) {
	console.log("Seeding demo workspace...");

	// ── 1. Demo system user ──────────────────────────────────────────────────
	let demoUser = await db.user.findUnique({ where: { email: DEMO_USER_EMAIL } });
	if (!demoUser) {
		demoUser = await db.user.create({
			data: {
				email: DEMO_USER_EMAIL,
				name: "Demo User",
				emailVerified: new Date(),
			},
		});
		console.log("  Created demo user:", demoUser.id);
	} else {
		console.log("  Demo user exists:", demoUser.id);
	}
	const userId = demoUser.id;

	// ── 2. UserSettings ───────────────────────────────────────────────────────
	const existingSettings = await db.userSettings.findUnique({ where: { userId } });
	if (!existingSettings) {
		await db.userSettings.create({
			data: { userId, ruleExecutionPreference: "ALWAYS_ASK" },
		});
		console.log("  Created demo user settings");
	}

	// ── 3. Categories (user-level demo categories) ────────────────────────────
	const demoCategories = [
		{ name: "Side Income", sortOrder: 2 },
		{ name: "Subscriptions", sortOrder: 65 },
		{ name: "Pet Care", sortOrder: 85 },
	];

	const categoryMap: Record<string, string> = {};
	for (const cat of demoCategories) {
		let existing = await db.category.findFirst({
			where: { userId, name: cat.name },
		});
		if (!existing) {
			existing = await db.category.create({
				data: { userId, ...cat, isDefault: false },
			});
		}
		categoryMap[cat.name] = existing.id;
	}

	// Get system categories for use in transactions
	const systemCategories = await db.category.findMany({
		where: { userId: null, isDefault: true },
	});
	for (const cat of systemCategories) {
		categoryMap[cat.name] = cat.id;
	}

	// ── 4. Hashtags ────────────────────────────────────────────────────────────
	const hashtagNames = ["tax-deductible", "reimbursable", "family", "work", "recurring"];
	const hashtagMap: Record<string, string> = {};

	for (const name of hashtagNames) {
		let tag = await db.hashtag.findUnique({
			where: { userId_normalizedName: { userId, normalizedName: name } },
		});
		if (!tag) {
			tag = await db.hashtag.create({
				data: { userId, name: `#${name}`, normalizedName: name },
			});
		}
		hashtagMap[name] = tag.id;
	}

	// ── 5. Transactions (12 months of realistic data) ─────────────────────────
	const existingTxCount = await db.transaction.count({ where: { userId } });
	if (existingTxCount === 0) {
		const today = new Date();
		const transactions: Parameters<typeof db.transaction.create>[0]["data"][] = [];

		for (let monthOffset = 11; monthOffset >= 0; monthOffset--) {
			const month = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);

			// Salary income
			transactions.push({
				userId,
				date: new Date(month.getFullYear(), month.getMonth(), 1),
				amount: 8500,
				type: "INCOME",
				description: "Salary - Direct Deposit",
				account: "Chase Checking",
				categoryId: categoryMap["Salary"],
				category: "Salary",
			});

			// Side income (some months)
			if (monthOffset % 3 === 0) {
				transactions.push({
					userId,
					date: new Date(month.getFullYear(), month.getMonth(), 5),
					amount: 650,
					type: "INCOME",
					description: "Freelance Project Payment",
					account: "Chase Checking",
					categoryId: categoryMap["Side Income"],
					category: "Side Income",
				});
			}

			// Mortgage
			transactions.push({
				userId,
				date: new Date(month.getFullYear(), month.getMonth(), 3),
				amount: 2200,
				type: "EXPENSE",
				description: "Mortgage Payment",
				account: "Chase Checking",
				categoryId: categoryMap["Mortgage & Rent"],
				category: "Mortgage & Rent",
			});

			// Groceries
			transactions.push({
				userId,
				date: new Date(month.getFullYear(), month.getMonth(), 8),
				amount: 320 + Math.round(Math.random() * 80),
				type: "EXPENSE",
				description: "Whole Foods Market",
				account: "Amex Gold",
				categoryId: categoryMap["Groceries"],
				category: "Groceries",
			});

			// Eating out
			transactions.push(
				{
					userId,
					date: new Date(month.getFullYear(), month.getMonth(), 10),
					amount: 85,
					type: "EXPENSE",
					description: "Nobu Restaurant",
					account: "Amex Gold",
					categoryId: categoryMap["Eating Out"],
					category: "Eating Out",
				},
				{
					userId,
					date: new Date(month.getFullYear(), month.getMonth(), 18),
					amount: 42,
					type: "EXPENSE",
					description: "Chipotle",
					account: "Chase Checking",
					categoryId: categoryMap["Eating Out"],
					category: "Eating Out",
				},
			);

			// Bills & Utilities
			transactions.push({
				userId,
				date: new Date(month.getFullYear(), month.getMonth(), 12),
				amount: 145,
				type: "EXPENSE",
				description: "Electric Bill",
				account: "Chase Checking",
				categoryId: categoryMap["Bills & Utilities"],
				category: "Bills & Utilities",
			});

			// Subscriptions
			transactions.push(
				{
					userId,
					date: new Date(month.getFullYear(), month.getMonth(), 2),
					amount: 15.99,
					type: "EXPENSE",
					description: "Netflix",
					account: "Amex Gold",
					categoryId: categoryMap["Subscriptions"],
					category: "Subscriptions",
				},
				{
					userId,
					date: new Date(month.getFullYear(), month.getMonth(), 2),
					amount: 9.99,
					type: "EXPENSE",
					description: "Spotify",
					account: "Amex Gold",
					categoryId: categoryMap["Subscriptions"],
					category: "Subscriptions",
				},
			);

			// Health
			if (monthOffset % 2 === 0) {
				transactions.push({
					userId,
					date: new Date(month.getFullYear(), month.getMonth(), 15),
					amount: 220,
					type: "EXPENSE",
					description: "Doctor Visit Co-pay",
					account: "Chase Checking",
					categoryId: categoryMap["Health & Medical"],
					category: "Health & Medical",
				});
			}

			// Investments contribution
			transactions.push({
				userId,
				date: new Date(month.getFullYear(), month.getMonth(), 20),
				amount: 500,
				type: "EXPENSE",
				description: "Vanguard Brokerage Transfer",
				account: "Vanguard Brokerage",
				categoryId: categoryMap["Investments"],
				category: "Investments",
			});

			// Auto
			transactions.push({
				userId,
				date: new Date(month.getFullYear(), month.getMonth(), 7),
				amount: 55 + Math.round(Math.random() * 20),
				type: "EXPENSE",
				description: "Shell Gas Station",
				account: "Chase Checking",
				categoryId: categoryMap["Auto & Transport"],
				category: "Auto & Transport",
			});

			// Shopping (some months)
			if (monthOffset % 2 === 1) {
				transactions.push({
					userId,
					date: new Date(month.getFullYear(), month.getMonth(), 22),
					amount: 189,
					type: "EXPENSE",
					description: "Amazon Purchase",
					account: "Amex Gold",
					categoryId: categoryMap["Shopping"],
					category: "Shopping",
				});
			}
		}

		// Create all transactions
		for (const tx of transactions) {
			await db.transaction.create({ data: tx });
		}
		console.log(`  Created ${transactions.length} transactions`);
	} else {
		console.log(`  Skipped transactions (${existingTxCount} exist)`);
	}

	// ── 6. Transaction Rules ──────────────────────────────────────────────────
	const existingRules = await db.transactionRule.count({ where: { userId } });
	if (existingRules === 0) {
		const rules = [
			{
				name: "Netflix → Subscriptions",
				conditions: [{ field: "DESCRIPTION" as const, operator: "CONTAINS" as const, valueText: "Netflix" }],
				actions: [{ type: "SET_CATEGORY" as const, valueText: "Subscriptions" }],
			},
			{
				name: "Whole Foods → Groceries",
				conditions: [{ field: "DESCRIPTION" as const, operator: "CONTAINS" as const, valueText: "Whole Foods" }],
				actions: [{ type: "SET_CATEGORY" as const, valueText: "Groceries" }],
			},
			{
				name: "Vanguard → Investments",
				conditions: [{ field: "DESCRIPTION" as const, operator: "CONTAINS" as const, valueText: "Vanguard" }],
				actions: [{ type: "SET_CATEGORY" as const, valueText: "Investments" }],
			},
		];

		for (let i = 0; i < rules.length; i++) {
			const rule = rules[i]!;
			await db.transactionRule.create({
				data: {
					userId,
					name: rule.name,
					priority: i + 1,
					isActive: true,
					conditions: {
						create: rule.conditions.map((c, idx) => ({
							sortOrder: idx,
							field: c.field,
							operator: c.operator,
							valueText: c.valueText,
						})),
					},
					actions: {
						create: rule.actions.map((a, idx) => ({
							sortOrder: idx,
							type: a.type,
							valueText: a.valueText,
						})),
					},
				},
			});
		}
		console.log("  Created 3 transaction rules");
	}

	// ── 7. Investments ─────────────────────────────────────────────────────────
	const existingInvestments = await db.investment.count({ where: { userId } });
	if (existingInvestments === 0) {
		await db.investment.createMany({
			data: [
				{
					userId,
					type: "FOUR01K",
					name: "401(k) — Fidelity",
					startingBalance: 78500,
					monthlyContribution: 1000,
					annualReturnRate: 0.07,
				},
				{
					userId,
					type: "ROTH_IRA",
					name: "Roth IRA — Vanguard",
					startingBalance: 22000,
					monthlyContribution: 500,
					annualReturnRate: 0.07,
				},
				{
					userId,
					type: "STOCKS",
					name: "Brokerage — Vanguard",
					startingBalance: 35000,
					monthlyContribution: 300,
					annualReturnRate: 0.08,
				},
				{
					userId,
					type: "HSA",
					name: "HSA — Optum Bank",
					startingBalance: 4200,
					monthlyContribution: 150,
					annualReturnRate: 0.05,
				},
			],
		});
		console.log("  Created 4 investments");
	}

	// ── 8. Real Estate ─────────────────────────────────────────────────────────
	const existingRE = await db.realEstateInvestment.count({ where: { userId } });
	if (existingRE === 0) {
		await db.realEstateInvestment.createMany({
			data: [
				{
					userId,
					name: "Primary Residence — 123 Elm St",
					propertyType: "SINGLE_FAMILY",
					usageType: "PRIMARY_RESIDENCE",
					purchasePrice: 420000,
					purchaseDate: new Date("2019-06-15"),
					downPayment: 84000,
					closingCosts: 8500,
					currentEstimatedValue: 565000,
					currentLoanBalance: 298000,
					interestRate: 0.0325,
					loanTermYears: 30,
					remainingTermMonths: 258,
					monthlyMortgagePayment: 2200,
					monthlyPropertyTax: 520,
					monthlyInsurance: 120,
					monthlyHOA: 0,
					monthlyMaintenance: 200,
					appreciationRate: 0.04,
					expenseGrowthRate: 0.025,
					forecastScenario: "STANDARD",
				},
				{
					userId,
					name: "Rental Property — 456 Oak Ave",
					propertyType: "SINGLE_FAMILY",
					usageType: "RENTAL",
					purchasePrice: 285000,
					purchaseDate: new Date("2021-03-10"),
					downPayment: 57000,
					closingCosts: 5800,
					currentEstimatedValue: 320000,
					currentLoanBalance: 218000,
					interestRate: 0.045,
					loanTermYears: 30,
					remainingTermMonths: 294,
					monthlyMortgagePayment: 1440,
					monthlyRent: 2400,
					vacancyRate: 0.05,
					monthlyPropertyTax: 310,
					monthlyInsurance: 95,
					monthlyMaintenance: 150,
					monthlyManagement: 192,
					appreciationRate: 0.04,
					expenseGrowthRate: 0.025,
					forecastScenario: "STANDARD",
				},
			],
		});
		console.log("  Created 2 real estate properties");
	}

	// ── 9. Forecast Scenarios ──────────────────────────────────────────────────
	const existingScenarios = await db.forecastScenario.count({ where: { userId } });
	if (existingScenarios === 0) {
		await db.forecastScenario.createMany({
			data: [
				{
					userId,
					name: "Conservative",
					type: "CONSERVATIVE",
					investmentReturn: 0.04,
					inflationRate: 0.04,
					salaryGrowth: 0.01,
					contributionChange: 0,
					expenseGrowth: 0.04,
					isActive: false,
				},
				{
					userId,
					name: "Expected",
					type: "EXPECTED",
					investmentReturn: 0.07,
					inflationRate: 0.03,
					salaryGrowth: 0.03,
					contributionChange: 0.02,
					expenseGrowth: 0.03,
					isActive: true,
				},
				{
					userId,
					name: "Aggressive",
					type: "AGGRESSIVE",
					investmentReturn: 0.1,
					inflationRate: 0.02,
					salaryGrowth: 0.06,
					contributionChange: 0.05,
					expenseGrowth: 0.02,
					isActive: false,
				},
			],
		});
		console.log("  Created 3 forecast scenarios");
	}

	console.log("Demo workspace seeding complete.");
	return demoUser;
}
