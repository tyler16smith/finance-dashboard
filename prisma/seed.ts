import { PrismaClient } from "../generated/prisma";

const db = new PrismaClient();

const defaults = [
    { name: "Salary",            sortOrder: 0,   isDefault: true },
    { name: "Reimbursement",     sortOrder: 1,   isDefault: true },
    { name: "Eating Out",        sortOrder: 10,  isDefault: true },
    { name: "Groceries",         sortOrder: 11,  isDefault: true },
    { name: "Mortgage & Rent",   sortOrder: 20,  isDefault: true },
    { name: "Home",              sortOrder: 21,  isDefault: true },
    { name: "Bills & Utilities", sortOrder: 22,  isDefault: true },
    { name: "Insurance",         sortOrder: 23,  isDefault: true },
    { name: "Auto & Transport",  sortOrder: 30,  isDefault: true },
    { name: "Gas",               sortOrder: 31,  isDefault: true },
    { name: "Cars",              sortOrder: 32,  isDefault: true },
    { name: "Travel",            sortOrder: 40,  isDefault: true },
    { name: "Flights",           sortOrder: 41,  isDefault: true },
    { name: "Shopping",          sortOrder: 50,  isDefault: true },
    { name: "Clothing",          sortOrder: 51,  isDefault: true },
    { name: "Entertainment",     sortOrder: 60,  isDefault: true },
    { name: "Sports & Fitness",  sortOrder: 61,  isDefault: true },
    { name: "Health & Medical",  sortOrder: 70,  isDefault: true },
    { name: "Kids",              sortOrder: 80,  isDefault: true },
    { name: "Gifts & Donations", sortOrder: 90,  isDefault: true },
    { name: "Business Services", sortOrder: 100, isDefault: true },
    { name: "Investments",       sortOrder: 110, isDefault: true },
    { name: "Loans",             sortOrder: 120, isDefault: true },
    { name: "Taxes",             sortOrder: 130, isDefault: true },
    { name: "Fees",              sortOrder: 140, isDefault: true },
    { name: "Uncategorized",     sortOrder: 999, isDefault: true },
];

async function main() {
    console.log("Seeding default categories...");

    for (const cat of defaults) {
        const existing = await db.category.findFirst({ where: { userId: null, name: cat.name } });
        if (!existing) {
            await db.category.create({ data: { userId: null, ...cat } });
            console.log(`  Created: ${cat.name}`);
        } else {
            console.log(`  Skipped (exists): ${cat.name}`);
        }
    }

    console.log("Done.");
}

main()
    .catch(console.error)
    .finally(() => db.$disconnect());
