# Keep User Profile data in Praxis and distinguish Paper Views from Practice Runs

**Status:** accepted

Praxis adds a private `/profile` page for the authenticated User. Praxis owns the
profile's display name, bio, curated avatar choice, and study setup references;
Clerk remains authoritative for authentication, email, and security. Profile
activity presents Paper Views as factual browsing history and does not call it
progress or conflate it with a Practice Run.

## Why

The profile should make the test archive feel personal without introducing a
social surface or unsupported performance claims. Keeping editable Praxis fields
in Postgres gives the API one stable place for the user's study context, while
leaving identity and security in Clerk avoids duplicating account concerns.

## Decision

- `GET /api/me/profile` returns the profile, level, enrolled course keys, and the
  five most recent Paper Views plus their total count.
- `PATCH /api/me/profile` owns only `displayName`, `bio`, and `avatarKey`.
- `/api/me/courses` continues to own program level and enrolled courses.
- Avatar values are stable curated keys, never asset filenames or arbitrary URLs.
- `Paper View` means a user opened a paper. `Recently Viewed` is its UI list.
  Neither implies a completed Practice Run, score, streak, or mastery.

## Consequences

The profile can evolve independently of Clerk and can safely fall back to
initials if an avatar key is removed. The first version deliberately omits
social visibility, destructive account actions, bookmarks, and gamified metrics.
The profile is desktop-first; mobile gets a later dedicated pass.
