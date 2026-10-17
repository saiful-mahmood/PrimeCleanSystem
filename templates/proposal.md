# Cleaning Services Proposal

**Prepared for:** {{client_name}}
**Location:** {{location_address}}
**Prepared by:** {{business_name}} · {{owner_name}} · {{owner_phone}}
**Date:** {{date}} · **Valid through:** {{valid_through}}

## Overview

{{overview_paragraph}}

## Scope of work

{{#each scope_lines}}
- {{this}}
{{/each}}

## Frequency and schedule

{{frequency_sentence}}

## Pricing

| Item | Price |
|---|---|
| {{service_name}} ({{frequency}}) | {{price_per_visit}} per visit |
{{#each add_ons}}
| {{name}} | {{price}} |
{{/each}}

{{pricing_notes}}

## What's included

{{included_paragraph}}

## Terms

- Payment: {{payment_terms}}
- Access: {{access_terms}}
- Cancellations: {{cancellation_terms}}
- Supplies and equipment: {{supplies_terms}}
- Insurance: {{insurance_sentence}}

## Next steps

{{next_steps}}

---
<!--
Replace this file with your real template. Keep the {{placeholders}}; they map to the
structured `fields` stored on each proposal version:
  client_name, location_address, date, valid_through, overview_paragraph, scope_lines[],
  frequency, frequency_sentence, service_name, price_per_visit, add_ons[{name, price}],
  pricing_notes, included_paragraph, payment_terms, access_terms, cancellation_terms,
  supplies_terms, insurance_sentence, next_steps
Add placeholders freely; Claude Code will extend the fields schema to match.
-->
