# Say2Draw Human Eval Rubric

## Purpose

Say2Draw eval exists to improve the agent. It connects a generated result with runtime logs, human judgment, failure review, and later agent changes.

The loop is:

1. Run a voice or text command.
2. Save the trace log.
3. Human evaluator gives a 0-4 score.
4. Low-score cases become failure reviews.
5. High-score cases can become golden examples.
6. The project uses these records to improve prompts, routing, planning, patch workflow, rendering, fallback behavior, and logging.

## What to judge

Judge whether the result serves the user's intent.

For drawing tasks, do not score artistic quality in isolation. Score practical usefulness:

- Did it understand the command?
- Is the core structure correct?
- Is the visual result usable?
- Can the user continue from this result?
- Would this result work in a demo or user workflow?

## 0-4 score scale

| Score | General standard | Say2Draw interpretation |
| --- | --- | --- |
| 4 | Perfect result | Fully follows the command. Structure is clear, visual result is usable, and almost no revision is needed. |
| 3 | Good result with small issues | Main intent is correct and usable. It has minor issues, such as slightly crowded layout, imperfect labels, or small visual defects. |
| 2 | Mostly usable with many issues | The intent is partly captured, but the result needs clear revision. Examples: missing node, unclear arrow, awkward layout, weak composition. |
| 1 | Only a little reference value | A few local elements are useful, but the overall result does not serve the task well. |
| 0 | Useless result | Wrong intent, blank output, crash, unrelated result, unreadable drawing, or fully unusable output. |

## Score handling

| Score range | Handling |
| --- | --- |
| 0-2 | Enter failure review. Inspect the linked trace log and decide which part of the agent should change. |
| 3-4 | Candidate for golden example. Extract the input and successful plan, patch, or rendering pattern when useful. |

## Required eval fields

Each human eval record should include:

- `evalId`: unique eval record id.
- `traceId`: id of the runtime trace being scored.
- `score`: integer from 0 to 4.
- `note`: short human explanation.
- `decision`: next handling decision.
- `improvementTarget`: where this case should feed back into the agent.

## Decisions

| Decision | Meaning |
| --- | --- |
| `failure_review` | Low-score case. Needs root-cause review and later improvement. |
| `golden_candidate` | High-score case. Can be considered as a prompt or workflow example. |
| `no_action` | Keep the record only. No immediate follow-up. |
| `needs_more_data` | Current logs are insufficient. Logging or reproduction is needed. |

## Improvement targets

| Target | When to use |
| --- | --- |
| `prompt` | The model needs clearer instruction or examples. |
| `router` | The command went to the wrong path or mode. |
| `planner` | The plan has wrong intent type, missing elements, or weak structure. |
| `patch_workflow` | Revision or plan patch did not apply correctly. |
| `renderer` | Plan is acceptable, but visual output is wrong or unreadable. |
| `fallback_policy` | Fallback path creates poor or misleading output. |
| `logging` | The trace does not contain enough evidence for diagnosis. |
| `golden_example` | High-quality case should be extracted as a reusable example. |
| `none` | No improvement action is needed. |

## Examples

### Low-score example

```json
{
  "evalId": "E-20260624-001",
  "traceId": "T-20260624-001",
  "score": 2,
  "note": "The flow direction is understandable, but the final payment success node is missing.",
  "failureType": "missing_required_step",
  "decision": "failure_review",
  "improvementTarget": "planner"
}
```

### High-score example

```json
{
  "evalId": "E-20260624-002",
  "traceId": "T-20260624-002",
  "score": 4,
  "note": "The flow is complete, the node order is natural, and the result can be used as a demo example.",
  "decision": "golden_candidate",
  "improvementTarget": "golden_example"
}
```
