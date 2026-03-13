# Feature Specification — Rules Engine

The Rules Engine provides automated transaction classification and transformation based on user-defined conditions.

# 2. Transaction Rules Engine

## Overview

Add a **Transaction Rules Engine** that allows users to define reusable automation rules for transactions.

This is not only a display filter.

This is a **condition builder + action engine**.

A rule evaluates transaction data against one or more conditions.

If the conditions match, one or more actions are applied to the transaction.

---

## Core Mental Model

### Rules are made of:
1. **Conditions**
2. **Actions**

### Conditions define:
Which transactions should match

### Actions define:
What should happen when a transaction matches

---

## Example Rule

```text
RULE NAME: Rental Property Repair Rule

IF
[ Merchant    ] [ contains     ] [ Home Depot           ]
AND
[ Description ] [ contains     ] [ repair               ]
AND
[ Amount      ] [ greater than ] [ 100                  ]

THEN
[ Change category ] -> [ Repairs                ]
[ Set description ] -> [ Rental repair expense ]
[ Add hashtag     ] -> [ #rentalA              ]
```

---

## Primary Use Cases

### Auto-categorization
Example:
- merchant contains `Shell`
- set category to `Gas`

### Auto-description cleanup
Example:
- merchant contains `ACH PAYMENT`
- set description to `Mortgage Payment`

### Auto-hashtag assignment
Example:
- description contains `Oak Street`
- add hashtag `#propertyOak`

### Import cleanup automation
Rules allow CSV imports to be normalized automatically as data enters the system.

---

## Rule Builder UI

The user should be able to create rules in a UI that feels similar to advanced filtering tools such as PostHog-style condition builders.

### Condition row structure
Each condition row should contain:

1. **field dropdown**
2. **operator dropdown**
3. **value input**

### Example fields
- Merchant
- Description
- Amount
- Category
- Date
- Account
- Notes
- Hashtag (future)
- Imported source/account (future)

### Example operators for text fields
- contains
- does not contain
- starts with
- ends with
- equals
- does not equal
- is empty
- is not empty

### Example operators for numeric fields
- equals
- does not equal
- greater than
- greater than or equal
- less than
- less than or equal

### Example operators for dates
- before
- after
- on
- between

---

## Condition Grouping

For V1, support **AND-based conditions**.

Example:

```text
IF
[ Merchant    ] [ contains     ] [ Home Depot ]
AND
[ Description ] [ contains     ] [ repair     ]
AND
[ Amount      ] [ greater than ] [ 100        ]
```

### Future enhancement
Later, support:
- OR groups
- nested groups
- parentheses / logic groups

But V1 should keep it simpler:
- one flat rule
- multiple conditions
- joined by AND

---

## Action Builder

A rule can perform one or more actions.

### V1 supported actions
- change category
- set description
- add hashtag

### Future actions
- remove hashtag
- append note
- set notes
- mark reviewed
- flag transaction
- set merchant normalization
- archive/ignore transaction
- split transaction

---

## Example Rule Visualization

```text
RULE NAME: Rental Property Repair Rule

IF
[ Merchant    v ] [ contains     v ] [ Home Depot         ]
AND
[ Description v ] [ contains     v ] [ repair             ]
AND
[ Amount      v ] [ greater than v ] [ 100                ]

THEN
[ Change category ] -> [ Repairs                ]
[ Set description ] -> [ Rental repair expense ]
[ Add hashtag     ] -> [ #rentalA              ]

[ + Add condition ]
[ + Add action    ]
```

---

## Rule Execution Timing

Rules should execute at two different moments.

---

### A. On Rule Creation or Edit

When a user creates or edits a rule, after clicking save, show a confirmation modal.

#### Modal concept

```text
Apply this rule to existing transactions?

( ) Yes, apply to all historical matching transactions
( ) No, only apply to future imports

[ ] Don't ask again / apply my default preference every time
```

This checkbox should allow the user to save a preference such as:
- always ask
- always apply to historical
- always future-only

### If user chooses historical apply
Run a historical backfill process:
- find all matching historical transactions for that user
- apply rule actions
- save changes
- record what was modified

### If user chooses future only
Do not modify historical rows.
The rule remains active for future imports.

---

### B. On Future Data Import

Rules should also run automatically during CSV import.

#### Import pipeline

```text
CSV import
-> parse file
-> map headers
-> normalize rows
-> evaluate active rules
-> apply matching actions
-> save final transactions
```

This ensures imported transactions are cleaned and enriched before they become visible in the dashboard.

---

## Recommended Rule Lifecycle

```text
User creates rule
-> save rule
-> ask whether to apply to history
-> optionally backfill historical transactions
-> keep rule active
-> automatically run on all future imports
```

---

## Should rules run only on import?

For V1:
- yes, rules should always run on import
- yes, rules should optionally run on historical data immediately after creation/edit

### Future enhancement
Later, rules could also run when:
- a user manually creates a transaction
- a user manually edits a transaction
- a user clicks “re-run rules” on selected transactions

---

## Rule Ordering and Conflict Resolution

Multiple rules may match the same transaction.

### Example
Rule 1:
- merchant contains `Home Depot`
- set category = `Home Maintenance`

Rule 2:
- description contains `duplex`
- add hashtag `#rentalA`

Both can apply.

But sometimes rules may conflict.

### Example conflict
Rule A:
- set category = `Gas`

Rule B:
- set category = `Travel`

### V1 recommendation
Rules execute in a defined order:
- top to bottom
- later rules can override earlier scalar field changes

### Action conflict strategy
- **category**: latest matching rule wins
- **description**: latest matching rule wins
- **hashtags**: merge uniquely, do not overwrite

---

## Raw vs Final Transaction Values

To support re-runs, auditability, and safe imports, store both:

1. **raw imported values**
2. **final normalized values after rules**

### Example

```text
rawMerchant: "HOME DEPOT #4701"
merchant: "Home Depot"

rawCategory: null
category: "Repairs"

rawDescription: "HD repair"
description: "Rental repair expense"

hashtags: ["#rentalA"]
```

### Why this matters
- allows future rule re-runs
- preserves original imported data
- helps debugging
- supports audit trails
- avoids destructive overwrites

---

## Technical Architecture

The rules engine should be designed as a reusable transaction-processing system.

### Suggested internal concepts
- `ruleEvaluator`
- `conditionMatcher`
- `actionExecutor`
- `ruleRunner`
- `historicalBackfillRunner`

### Example flow

```text
transaction input
-> load active rules for user
-> evaluate each rule in order
-> if conditions match, execute actions
-> continue until all rules processed
-> return final transaction state
```

---

## Database Changes for Rules Engine

Use normalized models rather than storing the rule as a single unstructured string.

### Recommended Prisma model additions

```prisma
enum RuleField {
  MERCHANT
  DESCRIPTION
  AMOUNT
  CATEGORY
  DATE
  ACCOUNT
  NOTES
}

enum RuleOperator {
  CONTAINS
  NOT_CONTAINS
  STARTS_WITH
  ENDS_WITH
  EQUALS
  NOT_EQUALS
  GREATER_THAN
  GREATER_THAN_OR_EQUAL
  LESS_THAN
  LESS_THAN_OR_EQUAL
  IS_EMPTY
  IS_NOT_EMPTY
  BEFORE
  AFTER
  ON
  BETWEEN
}

enum RuleActionType {
  SET_CATEGORY
  SET_DESCRIPTION
  ADD_HASHTAG
}

model TransactionRule {
  id                   String                      @id @default(cuid())
  userId               String
  name                 String
  isActive             Boolean                     @default(true)
  priority             Int
  applyModePreference  RuleApplyModePreference?
  createdAt            DateTime                    @default(now())
  updatedAt            DateTime                    @updatedAt

  user                 User                        @relation(fields: [userId], references: [id], onDelete: Cascade)
  conditions           TransactionRuleCondition[]
  actions              TransactionRuleAction[]
  applications         TransactionRuleApplication[]

  @@index([userId, isActive, priority])
}

enum RuleApplyModePreference {
  ALWAYS_ASK
  APPLY_HISTORICAL
  FUTURE_ONLY
}

model TransactionRuleCondition {
  id                   String                      @id @default(cuid())
  ruleId               String
  sortOrder            Int
  field                RuleField
  operator             RuleOperator
  valueText            String?
  valueNumber          Decimal?
  valueDate            DateTime?
  secondValueText      String?
  secondValueNumber    Decimal?
  secondValueDate      DateTime?

  rule                 TransactionRule             @relation(fields: [ruleId], references: [id], onDelete: Cascade)

  @@index([ruleId, sortOrder])
}

model TransactionRuleAction {
  id                   String                      @id @default(cuid())
  ruleId               String
  sortOrder            Int
  type                 RuleActionType
  valueText            String?
  hashtagId            String?

  rule                 TransactionRule             @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  hashtag              Hashtag?                    @relation(fields: [hashtagId], references: [id], onDelete: SetNull)

  @@index([ruleId, sortOrder])
}

model TransactionRuleApplication {
  id                   String                      @id @default(cuid())
  transactionId        String
  ruleId               String
  appliedAt            DateTime                    @default(now())
  wasHistoricalBackfill Boolean                    @default(false)

  transaction          Transaction                 @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  rule                 TransactionRule             @relation(fields: [ruleId], references: [id], onDelete: Cascade)

  @@index([transactionId])
  @@index([ruleId])
}
```

---

## Why these models matter

### `TransactionRule`
Stores the rule definition and metadata.

### `TransactionRuleCondition`
Stores each condition row in the rule builder.

### `TransactionRuleAction`
Stores each action row in the rule builder.

### `TransactionRuleApplication`
Stores an audit trail of which rules were applied to which transactions.

This supports:
- debugging
- historical tracking
- future re-runs
- transparency for users
- better admin insight later

---

## Additional Database Considerations

### Transaction table changes
Ensure the transaction table includes:
- raw imported fields
- final normalized fields
- user ownership
- optional import reference

### Import table
Recommended to track imports separately for observability and reprocessing.

Example:

```prisma
model Import {
  id                   String                @id @default(cuid())
  userId               String
  fileName             String
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt

  user                 User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions         Transaction[]
}
```

---

# API / tRPC Considerations

Add tRPC procedures for both hashtags and rules.

## Hashtag procedures
- create hashtag
- list hashtags
- update hashtag
- delete hashtag
- add hashtag to transaction
- remove hashtag from transaction

## Rule procedures
- create rule
- update rule
- list rules
- delete rule
- reorder rules
- toggle rule active/inactive
- run rule against historical transactions
- preview rule match count before backfill
- get rule application history (future)

---

## Suggested useful rule workflows

### Rule preview before save
Optionally show:
- how many historical transactions would match this rule

### Historical apply modal
After saving/editing a rule, show:

```text
Apply this rule to existing transactions?

( ) Yes, apply to all historical matching transactions
( ) No, only apply to future imports

[ ] Remember this preference / don't ask again
```

### Stored preference
Store the user’s default rule application preference on either:
- the user record
- or per-rule as an initial setting

Recommended:
store a user-level default preference, with optional override per action.

---

## Suggested User Preference Model

```prisma
enum RuleExecutionPreference {
  ALWAYS_ASK
  APPLY_HISTORICAL
  FUTURE_ONLY
}

model UserSettings {
  id                          String                    @id @default(cuid())
  userId                      String                    @unique
  ruleExecutionPreference     RuleExecutionPreference   @default(ALWAYS_ASK)
  createdAt                   DateTime                  @default(now())
  updatedAt                   DateTime                  @updatedAt

  user                        User                      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

# UI Requirements for Rules Engine

## Rules list page
Display:
- rule name
- active/inactive
- priority/order
- summary preview of conditions and actions
- edit button
- delete button
- run historically button

## Rule builder page/modal
Allow:
- add condition
- remove condition
- add action
- remove action
- reorder conditions/actions if needed
- save rule
- cancel

## Historical apply modal
Show after save/edit:
- apply to historical
- future only
- remember preference / do not ask again

## Transaction table indicators
Transactions that had rules applied may later support:
- a rules-applied icon
- hover details
- audit history link

That is optional for V1.

---

# Recommended V1 Scope

## Hashtags
V1 should include:
- hashtag database support
- hashtag display in transaction table
- add/remove hashtags manually
- add hashtags via rules
- filter transactions by hashtag

## Rules Engine
V1 should include:
- flat AND-based conditions
- action types:
  - set category
  - set description
  - add hashtag
- historical apply prompt after save
- “don’t ask again” preference
- automatic rule execution on future imports
- ordered rule execution
- raw vs normalized field storage
- basic rule application audit logging

---

# Future Enhancements

## Hashtags
- hashtag autocomplete
- hashtag analytics
- hashtag-specific reports
- hashtag rollup dashboard

## Rules Engine
- OR groups
- nested condition groups
- preview mode before saving
- test a rule on sample transactions
- re-run rules on selected transactions
- manual transaction rule application
- rule version history
- action types for notes and merchant normalization
- bulk rule management
- import-source-specific rules

---

# End-to-End System Visualization

```text
CSV Import / Manual Transaction
            |
            v
     Normalize raw transaction input
            |
            v
     Load active rules for user
            |
            v
   Evaluate conditions in rule order
            |
            v
 If conditions match -> apply actions
            |
            +--> set category
            +--> set description
            +--> add hashtags
            |
            v
 Save raw + final transaction values
            |
            v
 Show in transaction table / dashboard / reports
```

---

# Summary

These two features should work together as a transaction normalization and grouping layer.

## Hashtags provide:
- flexible grouping across categories
- better tax prep workflows
- easier real estate / client / project reporting

## Rules Engine provides:
- automated categorization
- automated description cleanup
- automated hashtag assignment
- reusable import normalization
- reduced manual transaction cleanup over time

Together, they make the financial dashboard significantly more powerful, especially for users managing:
- rental properties
- freelance finances
- multiple tax buckets
- client-related expenses
- large imported transaction histories