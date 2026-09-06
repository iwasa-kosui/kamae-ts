# Implementation

Version 2 accepts decimal amounts and calendar-component dates, while version 1 retains its original fields. The wire parser converts accepted amounts to integer cents and dates to canonical strings before persistence.

Both intake consumers pass the host's receivedOn value to parsing so an omitted version 2 shipping date can use the call context. Single intake, retrieval and sequential batch row responses retain the existing public contract and canonical storage format.

The existing repository operation and response types are retained. Version-specific wire validation and conversion remain in validation.ts; the existing single and batch consumers use its normalized OrderInput result. No storage migration or time source was introduced.

