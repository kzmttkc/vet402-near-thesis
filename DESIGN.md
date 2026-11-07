# Dashboard

The page in `docs/` is the counting room for this thesis. The ground is near-black (`#08090b`) with bone type (`#f4f1e8`). One lime (`#dff34a`) carries the primary button and text selection. `--mark` is that same lime in the dark, and `#3a4800` when the system asks for a light room, so the marked word, the meter fill, the exhibit rule, and the diagram connectors stay readable on `#f3f0e7`.

Type is Avenir Next, then Futura. Monospace is only for counts, account ids, and hashes. No font is loaded from the network.

The first viewport is the mechanism headline, one sentence taken from `near.known.accounts` and `near.known.named_delegate`, then "Read the line" and "Replay". The band is the frozen snapshot plus the posted block. Replay walks the record in `docs/prereg.mjs` and compares the sha256 of `PREREG.md`. It does not call an RPC.

The five roster rows are exhibit cards. The drawing is the specified path in `spec/delivery-proof.md`, not a count. The meter is the lower bound against the line. The appendix still holds the biased sample, off the meter.

Motion is the band count-up and the replay steps. `prefers-reduced-motion: reduce` shows the final numbers and reveals every step at once.
