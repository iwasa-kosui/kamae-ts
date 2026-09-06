# Implementation notes

The existing reservation command workflow remains in src/reservation.ts. Its
lookups, stock checks, idempotent repeat handling and public error mapping use the
legacy storage shape. Source values are copied before changes are submitted to
the host commit operation, and the expected revision comes from the loaded stock.

src/stock-report.ts consumes the supplied snapshot source directly and calculates
a sorted low-stock result. src/observation-receiver.ts consumes the supplied append
sink directly; it validates command fields without querying inventory and leaves
deduplication to the sink's documented guarantee.

src/provider-b.ts translates provider B lookup envelopes, decimal-string rows and
batch outcomes into the existing reservation workflow. Provider B does not need
the legacy provider at runtime. Provider error details are replaced by public
storage_unavailable or documented missing/conflict responses.

Each public factory accepts the resources available to its deployment. The
implementation retains a combined legacy storage interface where the existing
reservation service needs its query and commit operations; it adds no required
unrelated host methods to the new consumers.

