---
id: eval-extract-function
goal: Extract the duplicated price-formatting logic into one exported helper and use it in both places.
files_to_read:
  - src/invoice.ts
  - src/invoice.test.ts
constraints:
  - Behavior and output strings must not change.
  - Keep the existing public exports.
acceptance:
  - "`src/invoice.ts` exports `formatPrice(cents: number): string`, which turns an amount in cents into the price string the code produces today (for example 1205 becomes \"$12.05\" and -250 becomes \"-$2.50\")."
  - formatPrice is defined once, and both formatLine and formatInvoice call it; the formatting logic is no longer duplicated.
  - Outputs of formatLine and formatInvoice are identical to before for all inputs, and the existing tests pass unchanged.
verify: node --test
max_retries: 1
review: true
providers: [codex, claude]
---
