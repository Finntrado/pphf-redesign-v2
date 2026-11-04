# Facts and decisions needed from PPHF

These are shown on the staging site as pink **TODO** markers where they appear. Nothing here has been invented.

## Donations (most important)
1. **Online payment link**: Razorpay / PayU / Give.do / bank gateway URL → `src/_data/copy/donate.yml` → `paymentUrl`.
   Until it's set, the Donate button opens a pre-filled email to connect@pphfglobal.org with the donor's amount, frequency and cause.
2. **Bank transfer details**: bank & branch, account number, IFSC → `donate.yml` → `bank.rows`.
3. **UPI ID** (if any).
4. **80G**: confirm the deduction rate (50%?) and that the current 80G certificate is valid for this financial year → `donate.yml` → `tax.todo`.
5. **Foreign donations**: does PPHF hold FCRA registration? If yes, how should overseas donors give? → `donate.yml` → `faqs`.
6. **Suggested amounts** (₹1,000 / 2,500 / 5,000 / 10,000 / 25,000) are placeholders; change them in `donate.yml` → `amounts`.
   If you have real "what your gift does" figures (e.g. "₹X funds one health camp"), send them; none were invented.
7. **Monthly giving**: confirm PPHF can accept recurring donations (the form offers "Give monthly").

## Content to confirm
8. **Flood Relief Appeal 2026**: still active? Update the figures if the situation has changed (`copy/appeal.yml`, `copy/home.yml` → `appeal`, `nav.json` → `appeal` for the ribbon). Remove the ribbon when the appeal closes (delete `appeal` from `nav.json`).
9. **PPHF PULSE Fund**: the deadline (16 Oct 2026) has passed, so the page now shows "Applications closed". Add the announced partners after 15 November.
10. **Internship page**: the only listed role closed on 20 July 2024. Remove it or add a current one (`copy/internship.yml`).
11. **Homepage hero line**: "Health, passed from people to people." Happy with this as the organisation's headline?
12. **Contact form endpoint** (Formspree or a WordPress form URL) → `site.json` → `forms.contactEndpoint`. Until then the form opens the visitor's email app.

## Before going live
13. Remove the `X-Robots-Tag: noindex` header from `vercel.json`.
14. Have a Hindi speaker spot-check the machine translation on Home, Donate and the Appeal.
