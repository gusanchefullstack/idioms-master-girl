<!--
Sync Impact Report
- Version change: (unversioned template) → 1.0.0
- Modified principles (template placeholder → new title):
  - [PRINCIPLE_1_NAME] → I. Open-Source AI at the Core (NON-NEGOTIABLE)
  - [PRINCIPLE_2_NAME] → II. Built for One Real Person
  - [PRINCIPLE_3_NAME] → III. Local-First & Private by Default
  - [PRINCIPLE_4_NAME] → IV. Patient, Trustworthy Practice Partner
  - [PRINCIPLE_5_NAME] → V. Weekend-Sized Simplicity
- Added sections:
  - Open-Source & Technology Constraints (was [SECTION_2_NAME])
  - Development Workflow & Submission (was [SECTION_3_NAME])
  - Governance (filled)
- Removed sections: none
- Dependent templates: none modified (read the constitution at runtime; out of scope here)
- Deferred TODOs:
  - The friend's target language, native language and proficiency level are not stated;
    capture them in the feature spec (/speckit-specify), not here.
-->

# Idiom Expert Girl Constitution

## Core Principles

### I. Open-Source AI at the Core (NON-NEGOTIABLE)

- The core AI capability (generating, explaining and evaluating idioms and conversation
  practice) MUST run on an open-weight model (e.g. Llama, Mistral, Qwen, Gemma) through
  open-source tooling (e.g. Ollama, llama.cpp, Transformers, an open-source agent framework).
- A closed, proprietary model API MUST NOT be on the critical path. The app MUST stay fully
  usable with no proprietary API key configured.
- The model MUST be swappable via configuration (model name/endpoint), with no code changes.
- Prompts, system instructions and agent behavior MUST live in versioned, editable files in
  the repo, so the behavior can be inspected and changed.

**Rationale**: The challenge requires open pieces to be what makes the project work, and
openness is what lets us tune the tutor to one person, run it offline and for free.

### II. Built for One Real Person

- Every feature MUST trace to a concrete need of the specific friend this is built for
  (target language, level, interests, the idioms they actually trip over).
- Features that serve only a hypothetical "general user" MUST be cut or deferred.
- The friend's preferences (level, topics, correction style) MUST be configurable in a
  simple profile, not hard-coded across the codebase.

**Rationale**: The theme is "Build for a Friend": it does not have to be big, it has to
matter to them.

### III. Local-First & Private by Default

- After a one-time setup (installing the runtime and downloading the model), the app MUST
  work on a laptop with no internet connection.
- Practice history, mistakes and profile data MUST be stored locally on the friend's device.
  Data MUST NOT be sent to third-party servers without an explicit, opt-in user action.
- No telemetry, analytics or remote logging of the friend's conversations.

**Rationale**: A language learner's mistakes are personal. Keeping them on a device they
control is a key benefit of the open approach and a key point of the submission post.

### IV. Patient, Trustworthy Practice Partner

- Tone MUST be encouraging and patient. Corrections MUST explain *why* and offer a correct
  alternative, never just say "wrong".
- Every idiom presented MUST include its meaning, at least one natural example sentence and
  usage notes (register, region, literal vs figurative), when relevant.
- To limit hallucinated idioms, the app MUST ground idioms in a curated, versioned local
  idiom list (or clearly label model-generated idioms as unverified).
- Explanations MUST be pitched to the friend's configured level, using their native language
  for clarification where helpful.

**Rationale**: A practice partner is only useful if the learner trusts it and wants to keep
coming back.

### V. Weekend-Sized Simplicity

- Scope MUST fit a weekend build: one small, working, demo-able core loop beats many
  half-finished features.
- Choose the simplest stack that works. New dependencies and abstractions MUST justify
  themselves against a concrete need (YAGNI).
- The app MUST be runnable from a clean clone with documented setup in a few commands.

**Rationale**: Shipping something real to the friend matters more than architectural breadth.

## Open-Source & Technology Constraints

- All model weights, runtimes and core libraries MUST have open licenses that allow this use.
  The README MUST list the exact model, its license and the runtime used.
- Running the app MUST cost nothing: no paid API keys or paid hosting required for the core
  experience.
- Hardware target: a typical consumer laptop. Default model size MUST be chosen to run
  acceptably there (e.g. ≤ 8B params, quantized). Larger models are optional upgrades.
- Optional cloud or hosted components (e.g. a demo deployment) are allowed only if they also
  use open-weight models and are not required for local use.

## Development Workflow & Submission

- Work follows the Spec Kit flow: constitution → specify → (clarify) → plan → tasks →
  implement. Plans MUST include a Constitution Check against Principles I–V.
- Each core feature MUST have at least a smoke-level check (manual script or automated test)
  showing it works offline against the local model.
- The README MUST include: who it is built for and why, setup and run steps, the model swap
  instructions, and a section on why open innovation matters here (offline, privacy,
  customization, zero cost), including where the open approach worked better than a closed
  one.
- Before submission, verify on a machine with networking disabled that the core loop works.

## Governance

- This constitution supersedes other project practices. Specs, plans and tasks MUST comply.
  Any deviation MUST be documented with a justification in the plan's Complexity Tracking.
- Amendments: edit this file via `/speckit-constitution`, record a Sync Impact Report, and
  bump the version.
- Versioning (semantic): MAJOR for removing or redefining a principle; MINOR for adding a
  principle/section or materially expanding guidance; PATCH for wording and clarifications.
- Compliance review: every `/speckit-plan` and `/speckit-analyze` run MUST check against
  these principles. Violations of Principle I or III block shipping.

**Version**: 1.0.0 | **Ratified**: 2026-10-03 | **Last Amended**: 2026-10-03
