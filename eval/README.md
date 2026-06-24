# Say2Draw Eval Data Loop

## Goal

This directory stores the human eval data loop for Say2Draw.

The goal is agent improvement:

```text
runtime trace
  -> human 0-4 rating
  -> low-score failure review
  -> agent change

runtime trace
  -> high-score rating
  -> golden example
  -> future prompt or workflow example
```

## Directory layout

```text
eval/
  README.md
  eval-log-template.json
  trace-template.json
  ratings/
  failures/
  golden/
```

| Path | Purpose |
| --- | --- |
| `ratings/` | Human 0-4 score records. Each record links to a trace through `traceId`. |
| `failures/` | Root-cause reviews for 0-2 score cases. |
| `golden/` | High-quality examples extracted from 3-4 score cases. |
| `trace-template.json` | Runtime trace schema template. |
| `eval-log-template.json` | Human rating schema template. |

PR34 uses local files. SQLite can be added later when filtering, dashboards, or large-scale statistics become necessary.

## Trace log

A trace log is the machine evidence for one run.

It should answer:

- What did the user ask?
- Which mode and model were used?
- What plan or patch did the agent produce?
- What final result was rendered?
- Did fallback or error handling happen?
- Which debug entries explain the path?

Template: `eval/trace-template.json`.

The key field is:

```json
"traceId": "T-20260624-001"
```

## Human rating

A human rating is the evaluator's judgment on one trace.

It should answer:

- What score did the result receive?
- Why did it receive that score?
- What should happen next?
- Which agent component should learn from this case?

Template: `eval/eval-log-template.json`.

The key link is:

```json
"traceId": "T-20260624-001"
```

This connects the rating to the runtime evidence.

## Decisions

| Decision | Meaning |
| --- | --- |
| `failure_review` | Low-score case. Inspect the trace and write a failure review. |
| `golden_candidate` | High-score case. Consider extracting it as a golden example. |
| `no_action` | Keep the score record only. |
| `needs_more_data` | The current trace is insufficient for diagnosis. Improve logging or reproduce. |

## Improvement targets

| Target | Agent feedback path |
| --- | --- |
| `prompt` | Improve system prompt, task prompt, or examples. |
| `router` | Improve intent routing or mode selection. |
| `planner` | Improve plan schema, plan validation, or deterministic plan fallback. |
| `patch_workflow` | Improve revision patch interpretation and application. |
| `renderer` | Improve SVG or visual rendering logic. |
| `fallback_policy` | Improve fallback conditions and fallback output. |
| `logging` | Add missing trace fields or debug events. |
| `golden_example` | Extract as a reusable positive example. |
| `none` | No agent change needed. |

## Low-score workflow

Use this path for score 0-2:

```text
rating in eval/ratings
  -> find linked trace by traceId
  -> inspect prompt, plan, patch, finalPlan, renderResult, debugLog
  -> write failure review in eval/failures
  -> decide agent change target
  -> implement improvement in a later PR
```

Suggested failure review fields:

```text
# Failure Review

- evalId:
- traceId:
- score:
- user input:
- observed issue:
- likely root cause:
- improvement target:
- proposed change:
- follow-up PR:
```

## Golden example workflow

Use this path for score 3-4 when the case is reusable:

```text
rating in eval/ratings
  -> find linked trace by traceId
  -> extract successful input, plan, patch, or rendering pattern
  -> save golden example in eval/golden
  -> use in later prompt or workflow updates
```

Suggested golden example fields:

```json
{
  "goldenId": "G-20260624-001",
  "sourceEvalId": "E-20260624-002",
  "sourceTraceId": "T-20260624-002",
  "useCase": "flowchart_generation",
  "input": "画一个用户登录到订单支付的流程图",
  "whyGood": "Complete flow with clear required steps.",
  "agentUse": "prompt_example"
}
```

## Storage rule

Keep generated eval data in local files during the first phase.

Runtime traces are automatically appended to:

```text
data/traces/YYYY-MM-DD.jsonl
```

Future human rating records should use:

```text
data/eval-ratings/YYYY-MM-DD.jsonl
```

Each line should be one JSON object. This keeps the data readable and easy to migrate.

## Future migration

Move to SQLite when the project needs:

- score filtering
- failure type statistics
- prompt version comparison
- model comparison
- eval dashboard
- hundreds of trace and rating records
