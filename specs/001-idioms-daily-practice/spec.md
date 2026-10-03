# Feature Specification: IdiomsMasterGirl – Daily Idiom Practice

**Feature Branch**: `001-idioms-daily-practice`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "IdiomsMasterGirl – an app for my wife, Eugenia, who is studying
English in SF (A2 ESL level). It teaches English idioms at her level through a daily session:
Learn (idiom, meaning, when to use, 3 examples, with American-English audio), Speak try 1
(record, score, warm tips), Speak try 2 (record again, show improvement), Write (3 own
sentences graded and corrected), Read aloud (hear corrected sentences, record, score), and a
Daily score saved with a progress chart and streak. Scores combine accuracy (transcript vs
target) and clarity (per-word confidence); missed or unclear words feed warm, specific
feedback. Open core: a local language model and local speech recognition; difficulty
basic to medium."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Learn today's idiom (Priority: P1)

Eugenia signs in and sees the idiom of the day, chosen for her level (A2, basic to medium).
She reads its meaning in simple English, a short "when to use it" note and three example
sentences. Each line (the idiom and each example) has a play button that reads it aloud in
a natural American-English voice, so she can hear the right pronunciation as many times as
she wants.

**Why this priority**: This is the heart of the app. Even with nothing else, Eugenia learns
one new idiom a day and hears how it sounds.

**Independent Test**: Sign in, open today's session and check that one idiom with meaning,
usage note and three examples is shown. Press each play button and hear the audio.

**Acceptance Scenarios**:

1. **Given** Eugenia has an account, **When** she signs in with her username or her email
   plus her password, **Then** she lands on today's session.
2. **Given** it is a new day, **When** she opens the app, **Then** she sees one idiom she has
   not seen in the last 60 days, its meaning, a "when to use it" note and exactly 3 examples,
   all written at A2–B1 vocabulary level.
3. **Given** today's idiom is shown, **When** she reopens the app later the same day,
   **Then** she sees the same idiom and examples (not a new one).
4. **Given** today's idiom is shown, **When** she presses the play button next to the idiom
   or an example, **Then** she hears that exact text in an American-English voice.
5. **Given** she has already played a sentence once, **When** she plays it again, **Then**
   the audio starts without a new generation delay (reused from the saved copy).

---

### User Story 2 - Speak and improve (tries 1 and 2) (Priority: P1)

After learning, Eugenia records herself saying the idiom and each of the three examples.
For each recording she gets a score (accuracy and clarity) and warm, specific tips naming
the words that were missed or unclear (e.g. "Try stressing PIECE of cake; 'cake' came
through as 'cape'"). She then records everything a second time and sees her try-2 score
next to try 1, with how much she improved.

**Why this priority**: Speaking practice with honest, kind feedback is what makes this a
practice partner and not just a dictionary.

**Independent Test**: With today's idiom shown, record the idiom and the 3 examples twice.
Check that each recording gets a score and tips after try 1, and that try 2 shows the score
and the change from try 1.

**Acceptance Scenarios**:

1. **Given** she is in Speak try 1, **When** she records the idiom, **Then** she sees an
   accuracy score, a clarity score, a combined score (0–100) and which words were missed or
   unclear.
2. **Given** a try-1 recording had missed or low-confidence words, **When** the score is
   shown, **Then** she also gets 1–3 short, encouraging tips that name those exact words.
3. **Given** a try-1 recording had no problem words, **When** the score is shown, **Then**
   she gets a short positive message and no invented corrections.
4. **Given** she finished try 1, **When** she completes try 2 for the same items, **Then**
   she sees try-2 scores per item, the overall try-2 score and the difference from try 1
   (e.g. "+12 points").
5. **Given** a recording is too short, silent or unreadable, **When** it is submitted,
   **Then** she is asked kindly to record again, and it is not counted as a scored attempt.

---

### User Story 3 - Write my own sentences (Priority: P2)

Eugenia writes three sentences of her own using today's idiom. Each one is graded on
whether the idiom is used correctly and on grammar, and she gets a corrected version with
a short, friendly explanation of what changed.

**Why this priority**: Using the idiom in her own words is how it becomes hers; it builds
on stories 1–2.

**Independent Test**: Enter 3 sentences (one correct, one with a grammar error, one using
the idiom wrongly) and check that each gets a grade, a corrected version and an explanation
that matches the error.

**Acceptance Scenarios**:

1. **Given** she is in the Write step, **When** she submits 3 sentences, **Then** each one
   gets an idiom-usage grade, a grammar grade, a corrected version and a one- or two-line
   explanation.
2. **Given** a sentence is already correct, **When** it is graded, **Then** the corrected
   version is the same as hers and she is told it is correct.
3. **Given** a sentence does not contain the idiom, **When** she submits, **Then** she is
   gently reminded to use the idiom and can edit before grading.
4. **Given** she submits fewer than 3 non-empty sentences, **When** she tries to continue,
   **Then** the app asks for the missing ones.

---

### User Story 4 - Read my corrected sentences aloud (Priority: P2)

Eugenia plays each corrected sentence in the American-English voice, then records herself
reading it. Each reading is scored the same way as in the Speak step, with warm tips.

**Why this priority**: It closes the loop: her own words, said correctly.

**Independent Test**: With 3 corrected sentences available, play each one, record a reading
and check that each gets a score and tips.

**Acceptance Scenarios**:

1. **Given** her 3 corrected sentences, **When** she presses play on one, **Then** she hears
   that corrected sentence in the American-English voice.
2. **Given** she records herself reading a corrected sentence, **When** it is scored,
   **Then** she sees accuracy, clarity, combined score and tips about missed or unclear words.

---

### User Story 5 - Daily score, progress and streak (Priority: P3)

At the end of the session Eugenia sees her daily score, a chart of her daily scores over
time and her current streak of consecutive practice days. Her history is saved and is still
there tomorrow.

**Why this priority**: Seeing progress keeps her motivated, but the learning works without it.

**Independent Test**: Complete sessions on several (simulated) days and check that the
daily score is saved, the chart shows each day and the streak counts consecutive days.

**Acceptance Scenarios**:

1. **Given** she finishes all steps, **When** the summary opens, **Then** she sees today's
   daily score (0–100) and the score of each step.
2. **Given** she completed sessions on past days, **When** she opens progress, **Then** she
   sees a chart of daily scores for at least the last 30 days.
3. **Given** she completed yesterday's session, **When** she completes today's, **Then** her
   streak goes up by 1; **given** she missed a day, **Then** the streak restarts at 1.
4. **Given** she leaves mid-session, **When** she comes back the same day, **Then** she can
   continue from the step she was on without losing earlier results.

---

### Edge Cases

- Microphone permission is denied: she sees a clear message on how to allow it, and the
  Learn and Write steps still work.
- The voice (audio playback) service is unreachable or the internet is off: saved audio
  still plays; for unsaved text a local fallback voice is used, or the play button shows
  "audio unavailable" while the rest of the session keeps working.
- The local language model is not running: the app shows a friendly "tutor is offline,
  start it and retry" message instead of a crash; no fake content is shown.
- She records with background noise or speaks a different sentence: low accuracy is shown
  and the tip points to the missed words, never a scolding message.
- The day changes during a session (past midnight): the session stays tied to the day it
  started.
- All suitable idioms were used in the last 60 days: the oldest-seen idiom is reused.
- Wrong username/email or password: a simple error message; no hint about which was wrong.
- Grading output from the tutor is incomplete or malformed: it retries once, then shows the
  sentence as "could not grade, try again" rather than an invented grade.

## Requirements *(mandatory)*

### Functional Requirements

**Account**

- **FR-001**: System MUST let Eugenia sign in with either her username or her email,
  plus a password.
- **FR-002**: System MUST keep her signed in on her device until she signs out.
- **FR-003**: System MUST store her profile: name, level (default A2), difficulty range
  (default basic to medium) and preferred voice (default American English).

**Daily idiom (Learn)**

- **FR-004**: System MUST select one idiom per calendar day from a curated, stored idiom
  list filtered to her level, avoiding idioms shown in the previous 60 days.
- **FR-005**: For the selected idiom, System MUST show its meaning, a "when to use it" note
  and exactly 3 example sentences, written in vocabulary appropriate for A2–B1 learners.
- **FR-006**: System MUST keep the same idiom and examples for the whole day.
- **FR-007**: System MUST provide a play button for the idiom, each example and each
  corrected sentence that plays it aloud in an American-English voice.
- **FR-008**: System MUST save generated audio per exact sentence text and reuse it on later
  plays instead of generating it again.

**Speaking & scoring**

- **FR-009**: System MUST let her record herself for each target item (idiom, 3 examples,
  and later 3 corrected sentences) and re-record before submitting.
- **FR-010**: System MUST transcribe each recording and compute:
  - **Accuracy** (0–100): how closely the transcript matches the target text, based on the
    word error rate (ignoring case and punctuation).
  - **Clarity** (0–100): the average recognition confidence of her spoken words.
  - **Combined score** (0–100): 70% accuracy + 30% clarity.
- **FR-011**: System MUST identify problem words: target words that were missing or replaced
  in the transcript, and spoken words with confidence below a set threshold (default 0.6).
- **FR-012**: System MUST generate 1–3 short, warm, specific tips from the problem words
  (naming the word and what was heard instead), and MUST NOT invent problems when there
  are none.
- **FR-013**: System MUST support two speaking tries per day for the idiom and its 3
  examples, and show try-2 scores with the difference from try 1, per item and overall.
- **FR-014**: System MUST reject silent or too-short recordings (under 0.5 s of speech)
  with a kind retry prompt and not score them.

**Writing**

- **FR-015**: System MUST let her enter 3 sentences of her own and require that each is
  non-empty and contains the idiom (allowing natural verb/pronoun changes) before grading.
- **FR-016**: For each sentence, System MUST return an idiom-usage grade (0–100), a grammar
  grade (0–100), a corrected version and a short friendly explanation in simple English.

**Read aloud**

- **FR-017**: System MUST let her play each corrected sentence and then record herself
  reading it, scored as in FR-010 to FR-012.

**Daily score & progress**

- **FR-018**: System MUST compute a daily score (0–100) as the average of: Speak try 2
  combined score, Write average grade and Read-aloud combined score; and show each part.
- **FR-019**: System MUST save every session's attempts, scores, sentences and the daily
  score locally, so they are kept across restarts.
- **FR-020**: System MUST show a chart of daily scores over time (at least the last 30 days)
  and her current streak.
- **FR-021**: A day counts toward the streak only when all steps of that day's session are
  completed; missing a calendar day restarts the streak.
- **FR-022**: System MUST let her resume an unfinished session on the same day from the step
  she left.

**Tutor behavior, privacy & openness**

- **FR-023**: All tutor text (examples, tips, grades, corrections) MUST be generated by a
  locally running open-weight model; tutor personality and difficulty MUST be adjustable in
  editable settings without code changes.
- **FR-024**: Speech transcription and scoring MUST run locally on the device; recordings
  MUST NOT be sent to any external service.
- **FR-025**: Only the text to be spoken (idiom, examples, corrected sentences) may be sent
  to the external voice service; the app MUST state this in a short settings note, and the
  external voice MUST be turn-off-able, falling back to a local voice.
- **FR-026**: With no internet connection, all steps except new external-voice audio MUST
  keep working.

### Key Entities

- **Learner**: Eugenia's account and profile – username, email, password, level, difficulty
  range, voice preference, current streak.
- **Idiom**: an entry in the curated list – phrase, level, meaning, "when to use it" note,
  last date shown.
- **Daily Session**: one per learner per day – the idiom, its 3 examples, current step,
  step scores, daily score, completed flag.
- **Practice Item**: a text to say aloud in a session – idiom, example or corrected
  sentence; links to its saved audio.
- **Speaking Attempt**: one recording of a practice item – try number (1, 2 or read-aloud),
  transcript, accuracy, clarity, combined score, problem words, tips.
- **Written Sentence**: one of her 3 sentences – original text, corrected text, usage grade,
  grammar grade, explanation.
- **Audio Clip**: saved spoken audio for an exact text and voice, reused across plays.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Eugenia can complete a full daily session (all 6 steps) in 20 minutes or less.
- **SC-002**: Today's idiom and examples appear within 10 seconds of opening the session on
  her laptop, and replays of saved audio start within 1 second.
- **SC-003**: Each recording's score and tips appear within 8 seconds of her finishing it.
- **SC-004**: The same clear recording gets combined scores within ±5 points when scored
  twice, so scores are trusted.
- **SC-005**: In a check of 20 tips, at least 18 name a word that was actually missed or
  unclear in the recording, and none are discouraging in tone.
- **SC-006**: In a check of 15 written sentences with known errors, at least 13 corrections
  fix the error without changing her meaning.
- **SC-007**: Eugenia practices at least 5 days in her first week and says the level feels
  "right" (not too easy, not too hard) for at least 4 of those days.
- **SC-008**: Over 2 weeks of use, her average Speak try-2 score is higher than her try-1
  score on at least 70% of days.
- **SC-009**: With the internet turned off, she can complete a full session using already
  saved or local-fallback audio.
- **SC-010**: Running the app costs nothing per session beyond the free tier of the external
  voice service.

## Assumptions

- Single user: the app is built for Eugenia only; one account, no sign-up flow for others.
  An account is created once during setup.
- Runs on the couple's laptop and is used in its browser; mobile-specific design is out of
  scope for v1, but layouts should work on a phone-width screen.
- The curated idiom list (around 100 common American idioms tagged A2–B1) is created as part
  of this feature; the tutor picks and explains from it, keeping idioms real (constitution IV).
- "Basic to medium" means very common, everyday idioms (e.g. "piece of cake", "break the
  ice"), with examples using everyday vocabulary and short sentences (≤ 15 words).
- Feedback, explanations and the interface are in simple English; her native language is
  not used in v1.
- Score formula weights (70/30), the 0.6 confidence threshold and the 60-day no-repeat window
  are starting defaults that can be tuned in settings.
- The external voice service is accepted by the user as the one non-local piece for
  pronunciation quality, with a free or low-cost tier (the user has an MLH sponsor credit code
  for it, so the build costs nothing). It is optional at run time (FR-025,
  FR-026), keeping the core open and local as the constitution requires.
- Stack named by the user for planning (kept out of the requirements above): Ollama running
  Gemma locally, faster-whisper for speech recognition and word confidence, the ElevenLabs
  TTS API for the American voice, a small Next.js web UI in TypeScript and SQLite storage.
