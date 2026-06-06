# Challenge Rules — "Tantangan Turun 10 KG dalam 90 Hari"

> Source of truth for the Challenge module (PRD §21). Extracted verbatim from the owner's
> `challenge-rules.docx` (2026-06-06). Use these exact values/texts when building; the per-program
> Challenge Configuration UI is **seeded** with these defaults and the operator can edit them.
> All participant-facing text is Bahasa Indonesia.

## 1. Concept
The buyer purchases the e-book (the **program** = a `Product`) and may join a reward challenge to lose
weight over **90 days**. A participant starts the challenge **after** purchase by sending an **initial
proof** within **14 days** of purchase.

## 2. Three phases
| Phase | Days | Name | Focus |
|---|---|---|---|
| Fase 1 | 1–30 | Reset Pola Hidup | Membiasakan jam makan, stop minuman manis, olahraga ringan, target langkah, checklist harian. |
| Fase 2 | 31–60 | Bakar Lemak & Bangun Kekuatan | Latihan beban, aerobik, target langkah, protein, kontrol makan malam. |
| Fase 3 | 61–90 | Bentuk Tubuh & Pertahankan Hasil | Konsistensi, perkuat tubuh, kurangi cheating, siapkan pola maintenance. |

## 3. Start rules (bukti awal / initial proof)
- Must start **within 14 days** of purchase.
- **Challenge start date = date the initial proof is received** by the system/admin.
- Initial proof = a video **≤30 seconds**, **mp4**, **≤10 MB**, showing the participant's **face**
  together with the **starting weight on a digital scale**, clearly readable; a **full** video (not a
  clip) with a **date & time stamp**; **not edited / not AI** (e.g. via the "Timestamp Camera" app).
- If no initial proof within 14 days → participant is **gugur** (eliminated) from the reward program.

## 4. Finish rules (bukti akhir / final proof)
- The challenge runs **90 days** from the initial-proof date.
- On **day 90** the participant gets a reminder to send the final proof.
- Final proof = same video spec as the initial proof, showing the **final** weight.
- Participant has **≤14 days after day 90** to send the final proof.
- If no final proof within that window → **gugur** from reward judging.

## 5. Reward
- **Grand:** iPhone 17 Pro Max 128 GB — **1** main winner.
- **Saldo e-wallet Rp 5.000.000** — **10** people.
- Awarded to the best progress by **largest percentage of weight loss**. **Not a lottery** — winners are
  not chosen randomly.

## 6. Winner determination (formula — always fixed)
`percentLoss = (beratAwal − beratAkhir) ÷ beratAwal × 100`
Example: 80 kg → 72 kg = 8 kg lost → 8 ÷ 80 × 100 = **10%**.
Winners = largest `percentLoss` among participants who completed and submitted complete, valid proof.
Percentage (not raw kg) is used because starting weights differ.

## 7. WhatsApp reminder schedule (for the DEFERRED automation slice — D12)
Counted from **purchase** for the start phase, and from **challenge start (day 1 = initial proof received)** afterward.

| When | Trigger / status | Purpose |
|---|---|---|
| After purchase | Awaiting initial proof | Instruction to send initial proof |
| H+7 after purchase | Not sent initial proof | Reminder to start |
| H+13 | Not sent initial proof | Last reminder before deadline |
| H+14 | Not sent initial proof | Final day to send initial proof |
| H+15 | Not sent initial proof | Eliminated from reward |
| Day 1 challenge | Initial proof received | Challenge officially starts (Fase 1) |
| Day 30 | Fase 1 done | Enter Fase 2 |
| Day 60 | Fase 2 done | Enter Fase 3 |
| Day 90 | Awaiting final proof | Fase 3 done, instruction to send final proof |
| Day 97 | Not sent final proof | Reminder, 7 days left |
| Day 103 | Not sent final proof | Last reminder before deadline |
| Day 104 | Not sent final proof | Final day to send final proof |
| Day 105 | Not sent final proof | Eliminated from final judging |
| After final proof | Final proof received | Confirmation + await results |

> The full reminder **message templates** (Bahasa) are in the owner's `challenge-rules.docx` §8. They are
> per-program editable in the Challenge Configuration UI and seeded with those defaults when D12 is built.
> The contact placeholder in the templates is `hub : xxxxxxxx` → comes from the Challenge `contactInfo`.

## 8. Admin participant statuses (rules §9)
| Status (Bahasa) | Condition |
|---|---|
| Pembelian | Bought the e-book. |
| Menunggu Bukti Awal | Has not sent the initial-proof video. |
| Gugur Awal | No initial proof within 14 days of purchase. |
| Challenge Berjalan | Initial proof received; the 90-day challenge has started. |
| Fase 1 Selesai | Reached day 30. |
| Fase 2 Selesai | Reached day 60. |
| Menunggu Bukti Akhir | Reached day 90 and has not sent final proof. |
| Gugur Akhir | No final proof within 14 days after day 90. |
| Selesai | Both initial and final proofs complete. |
| Masuk Penilaian Reward | Data complete and valid for scoring. |

> "Fase 1/2 Selesai" and "Menunggu Bukti Akhir" are **derived** from the start date + today's date — they
> are not separate stored states. See PRD §21 for how the stored status enum maps to these labels.
