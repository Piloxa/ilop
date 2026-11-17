# Conformance matrix

Every normative rule, and where it is checked. "Harness" = this repository's offline runner (117 cases). "Piloxa" = the reference implementation's own test file `app/test/ilop-v02.test.js` (143 lettered assertions in 18 tests, run with `node --test` against mock payment and mock printer; no real charges, no real mail).

| Spec | Rule | Harness | Piloxa | Untestable offline |
|---|---|---|---|---|
| 2 | manifest valid, same-origin, from live tools/list | D-01..D-13 | D-01..D-14 | live L-01..L-07 |
| 2 | authorize advertised only if served | D-05, D-06 | D-05..D-07 | live L-09 |
| 2 | only tested protocol versions listed | D-08, D-09 | D-08, M-01..M-05 | live L-13 |
| 3 | quote/check read only, no order | Q-01..Q-10, R-05 | Q-01..Q-10 | |
| 3 | prepare never prints, mails, charges, authorizes | P-01..P-12 | P-01..P-13 | |
| 4.1 | ACCEPTED is not executed | A-08 | A-09..A-14, S-01..S-05 | |
| 4.1 | states forward only, terminal final | T-04, T-05, T-12 | S-16 | |
| 4.2 | charged only after capture | A-07, P-09, T-06 | A-09..A-14 | |
| 4.3 | unknown never coerced; OUTCOME_UNCERTAIN not retryable | A-04..A-06, A-09, S-11, S-12 | A-18..A-20, X-06 | |
| 5.1 | approval binds content, destination, total; authenticated by provider | A-13..A-17 | A-03..A-05 | how the provider verifies email/sign-in |
| 5.2 | user_approved never sufficient; forged or missing credential charges nothing | A-13 | A-01, A-06, A-08 | host's own confirmation step |
| 5.3 | hold then capture at acceptance | | A-09..A-14, A-18..A-20 | real processor behaviour |
| 6.6 | typed errors | A-10..A-12 | A-01..A-08, X-06 | |
| 7.1 | idempotency replay and conflict | A-02 | A-09..A-14 | |
| 7.2 | one capture, one partner job | T-08, R-04 | A-15..A-17 | real partner idempotency |
| 8 | provenance, no invented proofs | E-01..E-08, T-07, T-09, T-10 | E-01..E-06 | carrier truthfulness |
| 9 | no status by id; same refusal; no street address | M-02 | S-06..S-15, X-01..X-04, M-21, M-22 | live L-12 |
| 10.2 | 2026-07-28 headers, discover, handles | M-01, M-02 | M-06..M-23, E-07..E-09 | live L-13, L-14 |
| 12 | vendor neutrality | R-01..R-05 | | |
| — | owner-only switches | | X-05 | |

Totals at the time of writing: harness 117 of 117 pass; Piloxa 143 lettered assertions pass. Together 260, over the 103 the 0.2 plan asked for. Counting is by assertion id; several ids share one `node --test` test.
