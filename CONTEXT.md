# Praxis

This context defines the exam-practice language for browsing past IITM BS papers and questions.

## Language

**Exam**:
A named assessment event made available for practice and review.
_Avoid_: test, paper set

**Course**:
The academic subject to which an exam belongs.
_Avoid_: class, subject line

**Paper Variant**:
One concrete version of an exam paper within a course and exam.
_Avoid_: attempt, form

**Question**:
A single answerable prompt inside a paper variant.
_Avoid_: item, problem statement

**Practice Run**:
A user session of solving or reviewing questions in the platform.
_Avoid_: attempt, simulation

**Timed Run**:
A Practice Run taken under the exam clock, with auto-submit when time expires. One of the three modes a user chooses when entering a paper variant.
_Avoid_: attempt, timed test, mock

**Open Run**:
A Practice Run taken without a clock. Answers stay editable and results appear only at hand-in. One of the three entry modes.
_Avoid_: untimed attempt, browse mode

**Checked Run**:
A Practice Run without a clock where the user checks each question on its own: checking reveals that question's result and locks its answer, and the total score appears at hand-in. One of the three entry modes. Labelled "Practice" in the UI and stored as `runMode: 'practice'`.
_Avoid_: practice mode (collides with Practice Run), quiz mode

**User**:
The Clerk-backed authenticated person/account using Praxis.

**User Profile**:
The user's editable Praxis identity and study preferences. Authentication,
email, and account security remain part of the User's identity provider.

**Paper View**:
A record that a User opened a Paper Variant. A Paper View is not a Practice Run
and does not imply completion, mastery, or a score.

**Recently Viewed**:
The profile presentation of a user's most recent Paper View records.
