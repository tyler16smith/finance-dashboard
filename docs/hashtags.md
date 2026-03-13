# Feature Specification — Hashtags

## Overview

Add support for **hashtags** on transactions.

Hashtags are a lightweight grouping layer that allows users to group related transactions across different categories.

This is different from category classification.

### Category answers:
“What kind of transaction is this?”

Examples:
- Repairs
- Food
- Gas
- Insurance

### Hashtags answer:
“What broader thing does this belong to?”

Examples:
- `#rentalA`
- `#propertyOak`
- `#clientX`
- `#taxwriteoff`
- `#vacation2026`

This allows users to group transactions that span multiple categories but belong to the same real-world project, property, client, or tax bucket.

---

## Primary Use Cases

### Real estate grouping
A user may want to group all expenses related to a single property, even if those expenses fall into different categories.

Example:
- Home Depot → category: Repairs → hashtag: `#rentalA`
- State Farm → category: Insurance → hashtag: `#rentalA`
- City Utilities → category: Utilities → hashtag: `#rentalA`

### Tax prep grouping
A user may want to group transactions related to deductions or year-end review.

Examples:
- `#taxwriteoff`
- `#businessMeals`
- `#officeSetup`

### Client or project grouping
A freelancer may want to group expenses related to a client engagement or internal project.

Examples:
- `#clientApple`
- `#clientNike`
- `#marketingRefresh`

---

## Functional Requirements

### Hashtag storage
Each transaction should support zero or more hashtags.

### Hashtag behavior
- hashtags should be independent from category
- a transaction can belong to multiple hashtags
- hashtags should be user-owned
- hashtags should be queryable and filterable
- hashtags should be visible in the transaction table UI

### Hashtag creation
Hashtags can be added in two ways:

1. **manually by the user**
2. **automatically via transaction rules**

### Hashtag format
Use a normalized internal representation.

Examples:
- display value: `#rentalA`
- normalized value: `rentala` or `rentalA` depending on naming strategy

The UI should display hashtags with a leading `#`.

---

## UI Requirements

### Transaction table
Add a **Hashtags** column to the transaction table.

Example:

```text
| Date       | Merchant    | Category   | Amount | Hashtags              |
|------------|-------------|------------|--------|-----------------------|
| 2026-03-01 | Home Depot  | Repairs    | 245.00 | #rentalA #taxwriteoff |
| 2026-03-02 | Netflix     | Subscription | 15.49 | #personal             |
| 2026-03-03 | Chevron     | Gas        | 62.10  | #vehicleA             |
```

### Transaction detail/edit UI
Allow users to:
- add hashtags
- remove hashtags
- edit hashtags
- see all hashtags applied to a transaction

### Filtering
Allow filtering transactions by hashtag.

Examples:
- show all transactions tagged `#rentalA`
- show all transactions tagged `#clientX`

### Future analytics support
Hashtags should be available for:
- reports
- chart filtering
- exports
- year-end summaries
- grouped views across categories

---

## Database Changes for Hashtags

Use a normalized many-to-many relationship rather than a single text field.

This is more scalable and queryable than storing a comma-separated string.

### Recommended Prisma model additions

```prisma
model Transaction {
  id                   String                @id @default(cuid())
  userId               String
  importId             String?
  date                 DateTime
  merchant             String?
  description          String?
  category             String?
  amount               Decimal
  notes                String?
  rawMerchant          String?
  rawDescription       String?
  rawCategory          String?
  rawAmount            Decimal?
  rawDate              DateTime?
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt

  user                 User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  import               Import?               @relation(fields: [importId], references: [id], onDelete: SetNull)
  hashtags             TransactionHashtag[]
  ruleApplications     TransactionRuleApplication[]
}

model Hashtag {
  id                   String                @id @default(cuid())
  userId               String
  name                 String
  normalizedName       String
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt

  user                 User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions         TransactionHashtag[]

  @@unique([userId, normalizedName])
}

model TransactionHashtag {
  transactionId        String
  hashtagId            String
  createdAt            DateTime              @default(now())

  transaction          Transaction           @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  hashtag              Hashtag               @relation(fields: [hashtagId], references: [id], onDelete: Cascade)

  @@id([transactionId, hashtagId])
}
```

### Why this structure
This supports:
- multiple hashtags per transaction
- deduplicated hashtags per user
- efficient querying
- future hashtag analytics
- safe uniqueness constraints