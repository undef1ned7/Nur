# UBL Invoice package — integration guide

The `ubl-invoice/` directory is a standalone TypeScript package for generating **UBL 2.1** invoice XML. It is **not** wired into the main CRM `package.json` today. The CRM uses a simpler helper at `src/utils/archiveInvoiceXml.ts` for warehouse archive invoices.

## Option A — local workspace dependency (recommended for production use)

1. Build the package:

```bash
cd ubl-invoice
npm install
npm run build
```

2. Link it from the root `package.json`:

```json
{
  "dependencies": {
    "ubl-invoice": "file:./ubl-invoice"
  }
}
```

3. Install from the repo root:

```bash
npm install
```

4. Import in application code:

```typescript
import { InvoiceBuilder, generateInvoiceXml, validateInvoice } from "ubl-invoice";
```

5. Run package tests:

```bash
cd ubl-invoice && npm test
```

## Option B — manual copy (quick spike)

1. Run `npm run build` inside `ubl-invoice/`.
2. Copy `ubl-invoice/dist/` into a path your bundler resolves (e.g. `src/vendor/ubl-invoice/`).
3. Import from that copied path until a proper workspace link is added.

## When to use which

| Use case | Module |
|---|---|
| Warehouse archive XML (simplified) | `src/utils/archiveInvoiceXml.ts` |
| Full UBL 2.1 compliance, validation, decimal math | `ubl-invoice` package |

## Requirements

- Node.js >= 20 (see `ubl-invoice/package.json`)
- Vitest tests live in `ubl-invoice/tests/`

## Related docs

- Package README: `ubl-invoice/README.md` (if present)
- Archive XML tests: `src/utils/archiveInvoiceXml.test.ts`
