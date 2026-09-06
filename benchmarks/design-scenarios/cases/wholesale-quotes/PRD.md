# Wholesale quotations

A wholesaler quotes orders containing items sold individually and goods sold by
weight. Deliver the server-side module described in HOST.md. This version creates
and retrieves quotation documents; it does not accept orders, charge customers,
reserve stock, or edit quotes. No UI, HTTP server, authentication implementation,
or deployment is needed. Requests are sequential. IDs are supplied by callers.

### Q1 — Read a quote request

A request has a unique quote ID, customer ID, destination zone, and a nonempty
list of lines. Each line has a product code and a quantity supplied as a decimal
string. IDs, codes, and the zone are nonempty strings. A product may appear only
once. Products sold individually accept integer strings from "1" through "1000".
Products sold by kilogram accept positive quantities up to 200 kg, with at most
three decimal places. Use ordinary decimal notation without signs or exponents.
The catalogue determines a product's sales unit; the caller does not select it.

### Q2 — Obtain catalogue and customer facts

Look up each product and the customer. The customer must exist and be active.
Catalogue prices are positive integer USD cents, per item or per kilogram. Each
product also supplies the grams per individual item when sold individually.
The customer discount is specified in integer basis points from 0 through 1000.
Record the catalogue and discount facts used so the quote remains understandable
after those external facts change.

### Q3 — Calculate merchandise pricing and shipment weight

For individual items, multiply count by unit price and item weight. For kilograms,
convert the quantity to grams and round each line's extended price upward to
whole cents. Sum line prices, then subtract the customer discount, rounded
downward to whole cents. This produces the discounted merchandise amount. Sum
the shipment weight in grams. All arithmetic fits within JavaScript's safe integer
range for this task; assume the catalogue's magnitudes respect that limit.

### Q4 — Obtain freight and issue the quote

Ask the freight host for a charge using the destination zone and calculated
shipment weight. If the destination is unsupported, no quote is issued. Otherwise
add the nonnegative freight charge in cents to the discounted merchandise amount.
Save and return the quote with its lines, pricing facts, weight, merchandise
amount, freight amount, total, and issue time. The issue time is obtained at the
start of this operation. The issued quote is a fixed document, not a live view.

### Q5 — Explain business rejections

Distinguish malformed requests, duplicate quote IDs, missing or inactive
customers, unknown products, quantities unsuitable for their sales unit, and an
unsupported destination. A quantity rejection identifies the product, supplied
quantity, and sales unit; an unsupported destination identifies the zone. Choose
and document how callers receive success and these rejections. No priority is
prescribed when multiple issues apply.

### Q6 — Retrieve an issued document

Retrieve a quote by ID without consulting the catalogue or recalculating pricing.
Missing quotes must be distinguishable. Records survive a new module instance
through JSON storage. Issuing a duplicate ID must preserve the earlier document.
