# Gurbani Tag Seva Project

A working copy of the ReadGurbani **Audio Tagging Seva** tool
(original: readgurbani.com/audio_tag_seva.html), fixed so the Gurbani
panktis load again.

**Why the original broke:** its parser read the `gurmukhi` column from a
fixed position (column 6). The current ReadGurbani CSVs gained extra
`is_heading` columns (1 on most Angs, 3 on Ang 1), moving `gurmukhi` to
column 7 or 9. This copy reads the `uid` and `gurmukhi` columns **by
header name**, so any column layout works.

**Data:** the site's own copy of the Gursevak / readgurbani.com SGGS
database is bundled in `data/` (all 1,430 Angs, 60,610 tukhs, UIDs
unchanged; Katha track lists for all 1,430 Angs). Verified 2026-11-22:
line counts and text match the local Gurbani timestamper database for
every Ang (only difference: the CSVs keep the vishraam marks `;` `.` `,`
that the timestamper stripped).

**Audio:**
- Katha — Sant Gurbachan Singh Ji Bhindranwale, Larivaar Katha of Sri
  Guru Granth Sahib Ji, streamed from gurmatveechar.com
- Sehaj Paath — Bhagat Jaswant Singh Ji, per-Ang audio streamed from
  media.gursevak.com (https; tagging for Sehaj Paath is already complete)

**Use:** pick Source + Ang, Load, play the track, press **Tag** as each
tukh starts. Export Tagged / Export Flat download the timestamp CSVs;
Import Flat reloads a flat file.
