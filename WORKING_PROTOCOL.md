# X — Working Protocol

This document records the operating commitments for work on **X — The Card Game**.

Its purpose is to reduce friction, prevent repeated clarification loops, and ensure the project is completed from authoritative repository state rather than conversational improvisation.

## 1. Help Must Reduce Work, Not Create It

The tool/assistant must do the consolidation, comparison, documentation, verification, and implementation work itself wherever the established rules already provide enough information.

Do not turn a clear task into a long interrogation.

## 2. Do Not Reopen Settled Rules

Once the creator has explicitly settled a mechanic, do not ask the same question again in another form.

Do not manufacture ambiguity around a rule that has already been defined.

## 3. Mega X Inheritance Is Exact When Explicitly Declared

When the creator says a mechanic is "exactly the same as Mega X," preserve that mechanic exactly.

Do not reinterpret it, redesign it, rename its underlying meaning, or introduce additional conceptual layers unless the creator explicitly asks for a change.

## 4. Ask Only When Truly Blocking

A clarification question is justified only when:
- two authoritative rules directly conflict; or
- implementation cannot proceed deterministically without a missing decision.

Do not ask speculative edge-case questions merely because they are imaginable.

## 5. Batch Genuine Ambiguities

When multiple genuine blockers exist, collect them into one concise batch.

Do not drip-feed one low-value question at a time.

## 6. No Invented Rules

If behavior is unspecified and not determined by existing rules:
- mark it as unresolved;
- do not silently invent a result;
- do not present an assumption as established truth.

## 7. Repository Is the Durable Authority

Important decisions made during establishment or development must be written into the repository promptly.

Chat statements are not enough.

At minimum, authoritative project state should live in:
- `PROJECT_CONSTITUTION.md`
- `GAME_RULES.md`
- `WORKING_PROTOCOL.md`
- `ARCHITECTURE.md` when architecture work begins
- `PROJECT_STATE.md` for current milestone/status
- `DECISIONS.md` for major architectural decisions

## 8. Complete Work Properly

Do not stop at promises or partial descriptions when the requested task can be completed now.

For each substantial task:
1. identify the authoritative source;
2. perform the work;
3. verify against the source;
4. persist the result when it is project-defining;
5. report exactly what changed.

## 9. Preserve User Decisions Exactly

Do not "improve" wording into a different mechanic.

Do not add implications that the creator did not state.

For card text and rules, explicit wording controls behavior.

## 10. Reduce Cognitive Load

Responses during establishment and debugging should be concise and decision-oriented.

Avoid overwhelming the creator with large walls of hypothetical issues unless a comprehensive audit was explicitly requested.

## 11. No Production Experimentation

Do not use production, live player data, or deployment systems as a scratchpad.

Follow the project constitution: stable systems remain intact while replacements or changes are verified separately.

## 12. Verification Before Claims

Do not claim something is complete, fixed, deployed, preserved, or working without checking the relevant repository, tests, backend, or deployment state when that evidence is available.

## 13. Established Project Promise

For X, the working standard is:

- preserve settled mechanics;
- reduce unnecessary questions;
- do the heavy lifting;
- persist important decisions;
- expose only real blockers;
- verify before claiming success;
- finish each stage before pushing into the next;
- do not repeat the failure pattern that occurred during Mega X development.

These are operating constraints for future work on this repository, subordinate only to higher-level safety/system requirements and explicit creator amendments.
