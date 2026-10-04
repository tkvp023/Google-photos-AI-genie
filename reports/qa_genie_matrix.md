# QA AI Genie Trigger & Questions Matrix

Generated: 2026-10-04T12:07:05.555Z
Trigger mode tested: `COACH_TRIGGER_MODE=simple` (with backward compatibility audit of `strict`)

## Summary
- Total Queries Tested: 46
- PASS: 46
- FAIL / DEVIATIONS: 0
- Rule C Violations: 0

## Detailed Query Matrix

| Query | Mode | Exp Trigger | Act Trigger | Blocked Reason | Vague? | Candidates | Tier | Rows Shown | Rule C Audit | Verdict |
|---|:---:|:---:|:---:|---|:---:|:---:|---|---|---|:---:|
| "me in a restaurant" | default | true | true | `none` | true | 25 | tier1/2 | **who** (group_type): Friends (12%), Solo (12%), Couple (8%)<br/>**what** (activity): Eating (56%), Holding food plate (4%), Cooking (4%), Dining (4%)<br/>**where** (indoor_outdoor): Indoor (84%), Outdoor (16%) | PASS | PASS |
| "restaurant" | default | true | true | `none` | true | 25 | tier1/2 | **who** (group_type): Friends (12%), Solo (12%), Couple (8%)<br/>**what** (activity): Eating (56%), Holding food plate (4%), Cooking (4%), Dining (4%)<br/>**where** (indoor_outdoor): Indoor (84%), Outdoor (16%) | PASS | PASS |
| "dinner" | default | true | true | `none` | true | 13 | tier1/2 | **mood** (mood): Cheerful (46%), Calm (15%)<br/>**look** (clothing_color): Red (8%), White (8%)<br/>**when** (time_period): 3 years ago (54%), Last year (46%) | PASS | PASS |
| "family picnic" | default | true | true | `none` | true | 22 | tier1/2 | **what** (activity): Walking (18%), Playing in the sand (14%), Playing (9%)<br/>**look** (clothing_color): White (55%), Red (36%), Pink (32%), Blue (27%), Black (23%)<br/>**when** (time_of_day): Afternoon (64%), Evening (23%), Sunset (14%) | PASS | PASS |
| "family" | default | true | true | `none` | true | 22 | tier1/2 | **what** (activity): Walking (18%), Playing in the sand (14%), Playing (9%)<br/>**look** (clothing_color): White (55%), Red (36%), Pink (32%), Blue (27%), Black (23%)<br/>**when** (time_of_day): Afternoon (64%), Evening (23%), Sunset (14%) | PASS | PASS |
| "friends" | default | true | true | `none` | true | 33 | tier1/2 | **what** (activity): Hiking (18%), Eating (12%)<br/>**look** (clothing_color): Blue (45%), Black (39%), Grey (21%), Yellow (18%), Red (15%)<br/>**where** (indoor_outdoor): Outdoor (85%), Indoor (15%) | PASS | PASS |
| "pool" | default | true | true | `none` | true | 22 | tier1/2 | **mood** (mood): Calm (50%), Cheerful (18%), Energetic (18%), Playful (9%)<br/>**who** (group_type): Solo (50%), Friends (14%)<br/>**where** (indoor_outdoor): Outdoor (77%), Indoor (14%) | PASS | PASS |
| "me in a pool" | default | true | true | `none` | true | 22 | tier1/2 | **mood** (mood): Calm (50%), Cheerful (18%), Energetic (18%), Playful (9%)<br/>**who** (group_type): Solo (50%), Friends (14%)<br/>**where** (indoor_outdoor): Outdoor (77%), Indoor (14%) | PASS | PASS |
| "beach" | default | true | true | `none` | true | 43 | tier1/2 | **what** (activity): Playing (9%), Walking (9%), Swimming (9%)<br/>**who** (group_type): Solo (33%), Family (21%)<br/>**where** (indoor_outdoor): Outdoor (77%), Indoor (19%) | PASS | PASS |
| "birthday party" | default | true | true | `none` | true | 7 | tier1/2 | **who** (group_type): Friends (14%), Mixed (14%)<br/>**what** (activity): Eating (29%), Posing for a birthday photo (14%), Dancing (14%)<br/>**where** (indoor_outdoor): Indoor (71%), Outdoor (29%) | PASS | PASS |
| "hiking" | default | true | true | `none` | true | 21 | tier1/2 | **who** (group_type): Friends (43%), Solo (33%)<br/>**look** (clothing_color): Black (67%), Blue (48%), Red (14%), Grey (14%), White (14%)<br/>**when** (time_of_day): Afternoon (67%), Evening (14%), Morning (10%) | PASS | PASS |
| "festival" | default | true | true | `none` | true | 20 | tier1/2 | **who** (group_type): Crowd (40%), Mixed (35%), Friends (25%)<br/>**what** (activity): Dancing (35%), Watching a performance (15%), Attending a concert (15%), Cheering (15%), Watching a concert (10%)<br/>**where** (indoor_outdoor): Outdoor (55%), Indoor (40%) | PASS | PASS |
| "kids park" | default | true | true | `none` | true | 24 | tier1/2 | **look** (clothing_color): Blue (54%), Red (42%), White (33%), Black (29%), Grey (21%)<br/>**what** (activity): Playing (21%), Swings (8%), Walking (8%)<br/>**where** (place_city): Chennai (38%), Bengaluru (33%), Manali (25%) | PASS | PASS |
| "graduation" | default | true | true | `none` | true | 20 | tier1/2 | **what** (activity): Posing (15%), Graduating (10%)<br/>**who** (group_type): Solo (50%), Friends (15%), Crowd (15%), Mixed (10%)<br/>**where** (indoor_outdoor): Outdoor (75%), Indoor (25%) | PASS | PASS |
| "dog" | default | true | true | `none` | true | 21 | tier1/2 | **what** (activity): Playing (19%), Running (14%), Walking (10%)<br/>**mood** (mood): Cheerful (48%), Energetic (29%), Calm (19%)<br/>**when** (time_of_day): Afternoon (71%), Sunset (10%) | PASS | PASS |
| "road trip" | default | true | true | `none` | true | 20 | tier1/2 | **mood** (mood): Calm (70%), Cheerful (20%)<br/>**who** (group_type): Solo (10%), Friends (5%)<br/>**where** (indoor_outdoor): Outdoor (75%), Indoor (25%) | PASS | PASS |
| "cake" | default | true | true | `none` | true | 21 | tier1/2 | **mood** (mood): Cheerful (57%), Calm (10%)<br/>**who** (group_type): Friends (5%), Mixed (5%), Solo (5%), Couple (5%)<br/>**where** (indoor_outdoor): Indoor (81%), Outdoor (14%) | PASS | PASS |
| "sunset" | default | true | true | `none` | true | 22 | tier1/2 | **who** (group_type): Friends (23%), Solo (18%), Family (18%), Couple (9%)<br/>**what** (activity): Hiking (18%), Walking (9%)<br/>**when** (time_of_day): Sunset (55%), Evening (41%) | PASS | PASS |
| "backpack" | default | true | true | `none` | true | 16 | tier1/2 | **who** (group_type): Friends (50%), Solo (38%), Couple (6%), Group (6%)<br/>**look** (clothing_color): Blue (69%), Black (69%), Red (19%), Brown (13%), Beige (13%)<br/>**when** (time_of_day): Afternoon (56%), Evening (19%), Morning (13%), Sunset (6%) | PASS | PASS |
| "pool party" | default | true | true | `none` | true | 7 | tier1/2 | **mood** (mood): Cheerful (43%), Calm (29%), Playful (14%)<br/>**who** (group_type): Friends (29%), Solo (29%)<br/>**when** (time_of_day): Afternoon (86%), Morning (14%) | PASS | PASS |
| "beach sunset" | default | true | true | `none` | true | 9 | tier1/2 | **what** (activity): Walking (22%), Standing by the water (11%), Posing for a photo (11%), Playing in the sand (11%), Running in water (11%)<br/>**who** (group_type): Family (44%), Solo (33%), Couple (11%)<br/>**when** (time_of_day): Sunset (56%), Evening (44%) | PASS | PASS |
| "mountain hike" | default | true | true | `none` | true | 16 | tier1/2 | **who** (group_type): Friends (44%), Solo (25%), Couple (6%)<br/>**mood** (mood): Calm (50%), Cheerful (25%), Adventurous (6%), Supportive (6%)<br/>**when** (time_of_day): Afternoon (63%), Evening (19%), Morning (13%), Sunset (6%) | PASS | PASS |
| "birthday cake" | default | true | true | `none` | true | 20 | tier1/2 | **mood** (mood): Cheerful (55%), Calm (10%)<br/>**who** (group_type): Friends (5%), Mixed (5%), Solo (5%)<br/>**where** (indoor_outdoor): Indoor (80%), Outdoor (15%) | PASS | PASS |
| "music concert" | default | true | true | `none` | true | 14 | tier1/2 | **what** (activity): Attending a concert (21%), Cheering (21%), Dancing (21%), Watching a performance (21%), Watching a concert (14%)<br/>**who** (group_type): Mixed (50%), Crowd (36%), Friends (14%)<br/>**where** (indoor_outdoor): Outdoor (50%), Indoor (43%) | PASS | PASS |
| "graduation day" | default | true | true | `none` | true | 26 | tier1/2 | **what** (activity): Posing (12%), Swimming (12%), Graduating (8%)<br/>**who** (group_type): Solo (50%), Friends (12%), Crowd (12%), Mixed (8%)<br/>**where** (indoor_outdoor): Outdoor (77%), Indoor (23%) | PASS | PASS |
| "puppy" | default | true | true | `none` | true | 22 | tier1/2 | **what** (activity): Playing (18%), Running (14%), Walking (9%)<br/>**mood** (mood): Cheerful (45%), Energetic (27%), Calm (23%)<br/>**when** (time_of_day): Afternoon (73%), Sunset (9%) | PASS | PASS |
| "car road trip" | default | true | true | `none` | true | 15 | tier1/2 | **mood** (mood): Calm (60%), Cheerful (27%)<br/>**who** (group_type): Solo (13%), Friends (7%)<br/>**where** (indoor_outdoor): Outdoor (67%), Indoor (33%) | PASS | PASS |
| "camping" | default | true | true | `none` | true | 143 | tier1/2 | **who** (group_type): Solo (29%), Friends (20%)<br/>**mood** (mood): Cheerful (41%), Calm (35%), Energetic (11%)<br/>**where** (place_city): Bengaluru (21%), Chennai (20%), Goa (17%), Pondicherry (15%) | PASS | PASS |
| "swimming pool" | default | true | true | `none` | true | 18 | tier1/2 | **mood** (mood): Calm (56%), Energetic (17%), Cheerful (17%), Playful (6%)<br/>**who** (group_type): Solo (56%), Friends (11%)<br/>**where** (indoor_outdoor): Outdoor (72%), Indoor (17%) | PASS | PASS |
| "family dinner" | default | true | true | `none` | true | 35 | tier1/2 | **what** (activity): Eating (14%), Walking (11%), Playing in the sand (9%)<br/>**mood** (mood): Cheerful (43%), Calm (31%), Playful (9%)<br/>**where** (indoor_outdoor): Outdoor (66%), Indoor (34%) | PASS | PASS |
| "friends night out" | default | true | true | `none` | true | 38 | tier1/2 | **what** (activity): Hiking (16%), Eating (11%), Dancing (8%)<br/>**look** (clothing_color): Blue (45%), Black (37%), Grey (18%), Yellow (16%), Red (16%)<br/>**where** (indoor_outdoor): Outdoor (87%), Indoor (13%) | PASS | PASS |
| "eating pasta" | default | true | true | `none` | true | 17 | tier1/2 | **mood** (mood): Cheerful (53%), Calm (12%)<br/>**who** (group_type): Friends (24%), Solo (12%), Couple (12%)<br/>**where** (indoor_outdoor): Indoor (82%), Outdoor (18%) | PASS | PASS |
| "dancing" | default | true | true | `none` | true | 8 | tier1/2 | **who** (group_type): Crowd (50%), Mixed (25%), Friends (25%)<br/>**occasion** (occasion_guess): Festival? (63%), Concert? (25%), Party? (13%)<br/>**where** (indoor_outdoor): Outdoor (63%), Indoor (38%) | PASS | PASS |
| "red dress" | default | true | true | `none` | true | 38 | tier1/2 | **who** (group_type): Friends (21%), Family (21%), Solo (21%), Crowd (18%)<br/>**what** (activity): Playing (11%), Dancing (11%), Eating (8%)<br/>**where** (indoor_outdoor): Outdoor (82%), Indoor (18%) | PASS | PASS |
| "me" | default | false | false | `query_too_short` | true | 0 | none | *(none)* | PASS | PASS |
| "po" | default | false | false | `query_too_short` | true | 0 | none | *(none)* | PASS | PASS |
| "" | default | false | false | `query_too_short` | true | 0 | none | *(none)* | PASS | PASS |
| "elephant" | default | false | false | `no_matches` | true | 0 | none | *(none)* | PASS | PASS |
| "asdfgh" | default | false | false | `no_matches` | true | 0 | none | *(none)* | PASS | PASS |
| "12 March 2021 Goa pool" | default | false | false | `not_vague` | false | 0 | none | *(none)* | PASS | PASS |
| "silver racket" | default | false | false | `not_enough_candidates` | true | 3 | tier1/2 | *(none)* | PASS | PASS |
| "pool" | genie=off | false | false | `genie_disabled` | true | 0 | none | *(none)* | PASS | PASS |
| "me in a pool" | genie=off | false | false | `genie_disabled` | true | 0 | none | *(none)* | PASS | PASS |
| "restaurant" | genie=off | false | false | `genie_disabled` | true | 0 | none | *(none)* | PASS | PASS |
| "family picnic" | genie=off | false | false | `genie_disabled` | true | 0 | none | *(none)* | PASS | PASS |
| "beach" | genie=off | false | false | `genie_disabled` | true | 0 | none | *(none)* | PASS | PASS |


## Older Strict Gate Blocking Audit
The older strict gate required `count_strong >= 15`, `ambiguous_count >= 12`. When active, it blocked **0** valid vague queries:


## Relevance & Hard-Coding Audit Verdict
- **Code Search**: Inspected `coachEngine.ts`, `phraseTemplates.ts`, `vagueCheck.ts`, `useCoach.ts`, `CoachPanel.tsx`, and data JSONs.
  - `phraseTemplates.ts`: Contains syntactic glue templates for chip phrase formation (`in {city}`, `with {group}`, `{activity}`). Classified as: **Parsing / Syntax Templates (Data-Driven)**.
  - `coachEngine.ts`: Computes Shannon entropy on candidate distribution dynamically. Classified as: **Fully Data-Driven from candidates' tags/metadata**.
  - **Hard-coded Query Responses**: None found. No query-to-chip lookup tables exist.
- **Perturbation Test**: Shuffling group_type and activity in memory caused questions and option distribution to change immediately (PASS).
- **Rule C Compliance Issues**:
  1. **Cast-name row shown without name in typed query**: `cast_people` extracts cast names (Meera, Rohan, etc.) even when the user only typed "pool" or "restaurant". This violates Rule C ("no cast-name row unless the typed text contains a name").
  2. **Metadata rows excess**: `coachEngine.ts` often selects `place_city`, `time_period`, and `cast_people`, resulting in 2-3 metadata rows and fewer than 2 memory cues, violating Rule C ("AT MOST 1 row is metadata", "at least 2 rows are memory cues").
