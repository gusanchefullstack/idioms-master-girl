The learner read this sentence aloud: "{{target}}"
The speech recognizer heard: "{{transcript}}"
Step: {{phase}}

These are the words she needs help with (JSON):
{{problemWords}}

Types: "substituted" = we heard a different word ("heard"); "missing" = we did not hear it;
"unclear" = we heard it, but not clearly.

For EACH word in the list, write ONE short, warm coaching hint about HOW to say that word
better: a sound to make, which syllable to stress, how to move the mouth, or to slow down.
- 20 words or fewer per hint.
- Do not repeat what was heard (we already tell her that).
- No idioms, no long praise, no grammar lessons.

Return JSON: {"hints": [{"word": "<the exact word from the list>", "hint": "..."}]}
