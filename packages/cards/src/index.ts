import rawFullSet from "../data/cards.0.2.0.json" with { type: "json" };
import rawProofSet from "../data/engine-proof.json" with { type: "json" };
import rawCases from "../data/card-effect-cases.0.2.0.json" with { type: "json" };
import { CardSetSchema, EffectCasesSchema, type CardSet, type EffectCases } from "./schema.ts";

export * from "./schema.ts";

/** Full card set from CARD DATABASE.xlsx. Validated on load. */
export const fullSet: CardSet = CardSetSchema.parse(rawFullSet);

/** Engine-proof subset (constitution Rule 7: 8–12 cards). Validated on load. */
export const engineProofSet: CardSet = CardSetSchema.parse(rawProofSet);

/** Expected behaviour per card, used to write engine regression tests. */
export const effectCases: EffectCases = EffectCasesSchema.parse(rawCases);
