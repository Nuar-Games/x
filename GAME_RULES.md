# X — The Card Game: Authoritative Game Rules

Status: **ESTABLISHMENT RULESET — LOCKED FOR X1**

Rules version: **0.1.0**

This document records only rules explicitly established by the creator. No implementation may invent, reinterpret, or imply unstated game behavior.

## 1. Core Identity

X is a capture-and-score TCG designed in opposition to long solitaire-style combo play.

Design intent:
- short, meaningful turns
- direct back-and-forth interaction
- no general chain/stack response wars
- no recursive negate-of-negate gameplay
- explicit card text controls exceptions
- Zone X is permanent score and is untouchable

## 2. Deck Construction and Card Roles

- Deck size: minimum 30 cards, maximum 50 cards.
- Maximum 2 cards with the same name.
- Match effects cannot alter deck-construction limits.

### Card roles

There are no separate construction-level card types. Every card is a dual-use X card.

Each card definition contains:
- identity/name;
- ATK;
- DEF;
- STA;
- Effect text / structured Effect definition, if it has one.

A card is used in one role at a time:
- deployed from hand as the VS; or
- played from hand into the Effect Zone to use its Effect.

Every card can be deployed as a VS card.

A card with no playable Effect definition cannot be played into the Effect Zone, but it can still be deployed as VS.

## 3. Starting Setup

- Each player starts with 5 cards in hand.
- No mulligan.
- Each player draws 1 card on their turn.

### Opening turn hand allowance

- A player's **opening turn** is that player's first turn of the match.
- On their opening turn, a player may hold 6 cards after drawing (Player 1 draws to 6 on their opening turn; Player 2 draws to 6 on their opening turn).
- Starting from each player's second turn, hand size has a hard cap of 5.
- If a player exceeds the hand limit after drawing, that player must discard down to the legal limit before taking other actions.

"Opening turn" is the only term used for this allowance. It is not related to "round" (see §12).

### Player order

- In online play, the challenger is Player 1.
- Outside online challenge flow, players may decide who is Player 1 by any method they want.

## 4. Arena Zones

### VS Zone

- Holds the card currently fighting for that player.
- A player may deploy any card as a VS card.
- A VS card is placed in either ATK or DEF position when deployed.
- A newly deployed VS card keeps that chosen position until that player's next turn.
- A newly deployed VS card may attack on the same turn it is deployed if the opponent has a VS card.
- A card deployed to VS does not activate its printed effect unless the card explicitly states an effect that activates when deployed to VS.

### Effect Zone

- Effect cards are played into the Effect Zone.
- Only a card with a playable Effect definition may be played into the Effect Zone (see §2).
- Every Effect card occupies STA capacity while it remains there.
- Maximum normal Effect Zone size is 5, subject to STA and explicit card effects.
- One-shot Effects resolve once but remain in the Effect Zone, occupying STA, until round end or removal.
- Continuous Effects remain in the Effect Zone and apply according to their text until removed or the round ends.

### Zone X

- Zone X is the scoring zone.
- Each card in Zone X is worth 1 point.
- A destroyed card that is captured goes to the opponent's Zone X.
- Zone X is absolute and untouchable.
- No effect can target, move, alter, retrieve, destroy, steal, copy from, or otherwise interact with a card once it enters Zone X.
- If a pending instruction refers to a card that has already entered Zone X, that instruction can no longer affect that card.

### Zone Tepi

- Zone Tepi is the discard/side zone.
- Order in Zone Tepi does not matter.
- Cards may be moved from Zone Tepi only when an effect explicitly says so.
- Effects may return cards from Zone Tepi to hand, deck, Effect Zone, or another explicitly named valid zone.

### Deck

- Each player draws 1 card from their deck on their turn.
- Any effect that searches a deck is followed by a shuffle.
- Deck information is hidden unless an effect explicitly says otherwise.

### Hand

- Hand information is hidden unless an effect explicitly says otherwise.
- Effects may directly take or move cards from an opponent's hand if the effect explicitly says so.
- Destination is exactly what the effect text states; there is no implied destination.

## 5. STA System

STA uses the Mega X capacity system exactly.

- STA is capacity, not a consumable mana/resource pool.
- The VS card itself occupies 1 STA capacity.
- Each Effect card in the Effect Zone occupies 1 additional STA capacity.
- Every Effect card costs exactly 1 STA capacity.
- No Effect card has a higher STA cost unless the rules are explicitly amended in the future.

Examples:
- STA 1 = 1 VS + 0 Effect cards.
- STA 2 = 1 VS + 1 Effect card.
- STA 3 = 1 VS + 2 Effect cards.
- STA 6 = 1 VS + up to 5 Effect cards under the normal Effect Zone limit.

STA does not "reset" because STA capacity is not spent down by ordinary deployment or Effect play.

Card effects may explicitly increase or reduce STA.

If STA is reduced below the number of cards currently occupying VS + Effect capacity:
- excess Effect cards are moved to Zone Tepi until the board is within capacity;
- the player whose effect caused the STA reduction chooses which Effect cards are removed;
- those removed cards stay in Zone Tepi even if STA later increases again.

If a VS card's STA reaches 0:
- the VS is immediately destroyed;
- it is immediately captured into the opponent's Zone X;
- remaining instructions on the resolving Effect continue in written order;
- nothing can continue affecting that VS after it has entered Zone X.

## 6. Turn Structure

Normal turn flow:

1. Draw 1 card.
2. Enforce the hand limit; discard first if over the limit.
3. VS step:
   - **If the player has no VS:** deploy one from hand in ATK or DEF position. This is required before Effect play or attack/pass.
   - **If the player has a surviving VS:** choose at most one of:
     - keep it as-is;
     - change its position between ATK and DEF;
     - voluntarily replace it (the old VS is captured into the opponent's Zone X, then a new VS is deployed in ATK or DEF).
4. Before playing new Effect cards, the player may voluntarily remove their own Effect cards.
5. Play Effect cards, limited by STA capacity and Effect Zone capacity.
6. Attack or pass.
7. Resolve all battle results fully.
8. Check Arena Collapse (§13).
9. End the turn unless another explicit effect grants additional legal actions/attacks.

A newly deployed or replacement VS chooses ATK or DEF when deployed. Its position is locked until its owner's next turn.

A newly deployed VS may attack on the same turn if it is in ATK position and the opponent has a VS.

### Voluntary VS replacement

- Allowed only at the start of the player's own turn.
- It is the alternative to changing the current VS position that turn; the player does not do both as separate start-of-turn actions.
- The current surviving VS is captured by the opponent into Zone X.
- The player then deploys a new VS.

### Voluntary Effect removal

- Allowed before playing new Effect cards.
- A voluntarily removed Effect card is captured by the opponent into Zone X.
- This frees its STA capacity.

A card effect may instead send an Effect card to Zone Tepi without capture, but only when the card explicitly says so.

## 7. Opening Turns

### Player 1 — opening turn

- Draws 1 card (may hold 6 cards this turn).
- Deploys a VS card.
- May play Effects according to STA.
- Cannot attack while Player 2 has no VS card.

### Player 2 — opening turn

- Draws 1 card (may hold 6 cards this turn).
- Deploys a VS card.
- May play Effects according to STA.
- May attack (if in ATK position) or pass.

## 8. Position Changes

- A VS may change ATK/DEF position only at the start of its owner's turn, before new Effects are played.
- A newly deployed VS cannot change its chosen deployment position until that player's next turn.
- Position change by itself does not count as meaningful action for Arena Collapse.
- Effects may force position changes only when explicitly stated.

## 9. Attack Rules

- Only a VS in ATK position can attack. A VS in DEF position cannot attack.
- No attack can be declared without an opposing VS card.
- No pass can be declared without the player having a VS card in their VS Zone.
- A player may choose to attack or pass.
- Normal rule: one attack at a time.
- Additional attacks are allowed only when an Effect explicitly permits them.
- Multiple attacks resolve one at a time, with full battle resolution before the next attack.
- Effects may explicitly force an attack or prevent/restrict attacking.

## 10. Battle Resolution Matrix

### ATK vs ATK

Attacker ATK > Defender ATK:
- Defender VS is destroyed.
- Defender VS is captured into attacker's Zone X.
- Attacker VS remains in VS Zone.

Attacker ATK < Defender ATK:
- Attacker VS is destroyed.
- Attacker VS is captured into defender's Zone X.
- Defender VS remains in VS Zone.

Attacker ATK = Defender ATK:
- Both VS cards are destroyed.
- Each destroyed VS is captured by the opposing player into that opponent's Zone X.
- The round ends.
- On the next normal player's turn, that player deploys first.

### ATK vs DEF

Attacker ATK > Defender DEF:
- Defender VS is not destroyed.
- The top card of defender's deck is captured into attacker's Zone X.
- The round does not end because no VS was destroyed.

Attacker ATK = Defender DEF:
- Both players discard the top card of their own deck to Zone Tepi.
- No VS is destroyed from this comparison.

Attacker ATK < Defender DEF:
- Attacker discards the top card of their own deck to Zone Tepi.
- No VS is destroyed from this comparison.

### DEF attacker

- A VS in DEF position cannot attack. There is no DEF-attacker case (DEF vs ATK or DEF vs DEF).
- If both opposing VS cards are in DEF position, no attack is possible.
- Players may still use legal Effects or change position at the normal start-of-turn timing.

## 11. Destruction and Capture Language

"Musnah" means destroyed.

Whenever a card is destroyed (musnah), it is captured by the opponent into Zone X unless an explicit rule already defines the destination.

Examples:
- destroyed by battle -> opponent Zone X;
- destroyed by opponent Effect -> opponent Zone X;
- "musnahkan diri sendiri" -> opponent Zone X.

Direct movement wording is different from destruction.

Example:
- "Hantar ke Zone Tepi" means move directly to Zone Tepi;
- it does not imply "musnah";
- therefore it does not imply capture.

No destruction/capture may be inferred from wording that does not explicitly use destruction language.

## 12. Round End

Terminology: **"round"** refers only to the combat cycle that ends when a VS card is destroyed. It is not used for the opening-turn hand allowance (§3).

A round ends when a VS card is destroyed.

At round end:
- all Effect cards belonging to both players are sent to Zone Tepi;
- a surviving VS remains in the VS Zone;
- a defeated player deploys a replacement VS according to the normal turn sequence.

A successful ATK > DEF result that captures a top-deck card does not end the round because no VS was destroyed.

## 13. Arena Collapse

The Arena has an active personality and becomes impatient when meaningful action does not occur.

Arena Collapse uses an individual-turn counter, not a full-round counter.

An inactive turn is a turn in which:
- no attack occurs; and
- no Effect card is played.

Changing VS position does not count as an action and does not reset the counter.

Arena Collapse is checked when the player would otherwise finish their turn. If that turn is the third consecutive inactive individual turn:

1. Arena Collapse triggers immediately.
2. Both VS cards are sent to Zone Tepi, not Zone X.
3. All Effect cards for both players are sent to Zone Tepi.
4. No capture points are awarded for those cards.
5. The inactivity counter resets to 0.
6. The player whose turn triggered the collapse immediately deploys a new VS in ATK or DEF position.
7. That deployment is the only continuation after the collapse. The player does not play Effects or attack.
8. The turn ends and normal turn order continues.

Playing an Effect or performing an attack resets the consecutive inactivity sequence.

Deploying a VS (including the post-collapse deployment) does not count as an action for Arena Collapse.

Effects may explicitly add to, reduce, reset, freeze, or accelerate the Arena Collapse counter.

## 14. Effect Timing and Resolution

- Effects are played during the owner's own turn only.
- There is no general chain/stack system.
- There is no "negate your negate" response war.
- Effects resolve one at a time.
- No simultaneous trigger pile is created.
- A card may interrupt/cancel something only if its explicit text and established rules directly permit it.
- Resolve card text in written order.
- Resolve as much of an effect as legally possible.
- Do not invent substitute actions for impossible instructions.
- Explicit text overrides normal rules only where it explicitly says so.

## 15. Continuous and One-Shot Effects

- One-shot: effect resolves once when played, then the card stays in Effect Zone occupying STA until round end or removal.
- Continuous: effect remains active while the card remains active in Effect Zone, according to its text.
- Card text may explicitly define another duration.

Stat modifications:
- ATK/DEF/STA modifications normally last only while the modifying effect remains active;
- if the Effect leaves the Effect Zone, the affected stat immediately returns to its previous value;
- explicit permanent or alternative durations override this default;
- multiple continuous modifiers stack;
- when one stacked modifier leaves, the stat recalculates immediately using only modifiers still active.

## 16. Explicit Card-Text Authority

Card effects may explicitly:
- move cards between reachable zones;
- move a VS directly to Zone Tepi without destruction/capture;
- move either player's Effect cards directly to Zone Tepi without capture;
- return cards from Zone Tepi;
- take/move cards from an opponent's hand;
- look at, reorder, discard, capture, or move cards in a deck;
- force VS position changes;
- force or prevent attacks;
- modify Arena Collapse;
- modify hand-size limits;
- modify ATK, DEF, or STA;
- copy another reachable card's effect.

All such behavior requires explicit wording. No implied behavior is allowed.

Zone X is never reachable by effects.

## 17. Effect Copying

- A card may copy another card's effect only if explicitly stated.
- The source must be in a reachable zone; Zone X cannot be used as a copy source.
- When copied text refers to the original card's identity/state, use the copying card's own identity/state unless the copied text explicitly says otherwise.
- Copying is limited to one generation.
- A copied effect cannot itself be copied again.

## 18. Hidden Information

Default rule:
- hand and deck information remain hidden;
- cards moved/taken from hidden zones remain hidden unless an effect explicitly says to reveal/show them.

Explicit card text controls any reveal.

## 19. Deck Exhaustion and Match End

Normal turn draw:
- if a player cannot draw because the deck is empty, the match ends and Zone X is scored.

Battle/effect instructions requiring top-deck cards:
- if the deck is empty when a required top-deck capture/discard cannot be performed, the match proceeds to end-and-score according to the resolution rules below.

If an Effect empties a deck while it still has remaining instructions:
- finish resolving the entire current Effect first;
- perform as much of each instruction as legally possible;
- then check the deck-empty condition;
- then end the match and score Zone X.

If an Effect says to draw/capture/discard multiple cards but fewer remain:
- process as many cards as actually exist;
- do not substitute cards from another zone;
- finish the Effect;
- then perform the deck-empty end check and scoring.

If both decks become empty from the same resolving Effect:
- finish the Effect;
- count Zone X normally;
- higher score wins;
- tied score uses the tie-breaker.

## 20. Winning

- Each card in Zone X is worth 1 point.
- When the match ends, the player with more cards in Zone X wins.

### Tie-breaker

If Zone X scores are tied:

1. Each player forms a tie-break pool from all cards they own that are not in Zone X (deck, hand, VS Zone, Effect Zone, Zone Tepi).
2. Each player shuffles their pool.
3. Each player reveals one card from their pool.
4. The player whose revealed card has the higher **printed/base ATK** wins. Temporary modifiers do not apply.
5. If ATK ties, each player reveals the next card from their remaining shuffled pool, and step 4 repeats.
6. If the tie cannot be broken because a player has no card left to reveal, the match is a draw.

Note: this keeps the "shuffle and reveal higher ATK" concept, but it is defined for X. It is not a copy of a verified Mega X implementation.

## 21. Anti-Solitaire Design Law

Future card design must preserve X's defining intent:
- no long uninterrupted combo turns as the normal game pattern;
- no general response-chain wars;
- no recursive negate stacks;
- no excessive tutor/search loops that turn the game into solitary sequencing;
- no design where one player routinely performs a very long combo while the opponent only watches.

X should produce visible pressure, positional choices, capture decisions, and frequent turn exchange.

## 22. Interpretation Law

When implementing or designing cards:

1. Use this document as authority.
2. Preserve Mega X mechanics exactly only where the creator explicitly says X inherits them.
3. Do not reinterpret established mechanics.
4. Do not infer capture from non-destruction wording.
5. Do not infer destruction from movement wording.
6. Do not infer hidden card behavior.
7. Do not infer duration, destination, or targeting beyond explicit text.
8. Zone X overrides all effects because it is unreachable.
9. If a true contradiction blocks implementation, document that contradiction instead of inventing a rule.
10. Do not generate endless hypothetical edge-case questions when the existing rules already determine legal behavior.
