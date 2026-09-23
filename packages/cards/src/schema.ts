import { z } from "zod";

/**
 * Card definition schema (GAME_RULES.md §2 — card roles).
 *
 * Every card is dual-use: it can be deployed as VS, and it can be played
 * into the Effect Zone only if it has an `effect` definition.
 *
 * `no` and `star` come from CARD DATABASE.xlsx. They are metadata only:
 * GAME_RULES.md does not use them for any rule.
 *
 * `status: "DEFERRED"` marks a card that must not be implemented yet.
 *
 * `effect` is checked only for a `family` name until the X1 effect-resolver
 * mechanic vocabulary is defined (ARCHITECTURE.md §14). It will be tightened then.
 */
export const EffectDefinitionSchema = z.object({ family: z.string().min(1) }).passthrough();

export const CardDefinitionSchema = z
  .object({
    id: z.string().regex(/^X\d{3}$/, "id must look like X001"),
    no: z.number().int().min(1),
    name: z.string().min(1),
    star: z.number().int().min(0),
    atk: z.number().int().min(0),
    def: z.number().int().min(0),
    sta: z.number().int().min(1),
    effectText: z.string().min(1).optional(),
    effect: EffectDefinitionSchema.optional(),
    /** DEFERRED = not implemented until a concrete playable definition exists (GAME_RULES.md §18A). */
    status: z.literal("DEFERRED").optional()
  })
  .strict()
  .refine((c) => (c.effect === undefined) === (c.effectText === undefined), {
    message: "effect and effectText must both be present or both absent"
  });

export type CardDefinition = z.infer<typeof CardDefinitionSchema>;

export const CardSetSchema = z
  .object({
    cardSetVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    source: z.string().min(1).optional(),
    cards: z.array(CardDefinitionSchema)
  })
  .strict()
  .superRefine((set, ctx) => {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const card of set.cards) {
      if (ids.has(card.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate card id: ${card.id}` });
      if (names.has(card.name)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate card name: ${card.name}` });
      ids.add(card.id);
      names.add(card.name);
    }
  });

export type CardSet = z.infer<typeof CardSetSchema>;

export const EffectCasesSchema = z
  .object({
    cardSetVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    cases: z.array(z.object({ cardId: z.string(), assert: z.string().min(1) }).strict())
  })
  .strict();

export type EffectCases = z.infer<typeof EffectCasesSchema>;
