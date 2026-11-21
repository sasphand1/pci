# Pakistan Creator Index: runbook

## How it works in one minute
1. The admin adds people to the **bucket** (Module 3, Bucket). Each person has a YouTube and/or Instagram account.
2. Every day at **09:00 Asia/Karachi** the pipeline runs by itself: **Refresh** (fetch new numbers) → **Rank** (build drafts) → **Publish** (make drafts live if they pass the safety checks). No approval step.
3. The public website only shows **published** rankings. Nothing is calculated when someone opens a page.
4. Pipeline screen (Module 3) shows the last run, alerts, drafts, live rankings, and lets you run each step by hand or restore the previous ranking.

## Environment variables
| Name | Default | Meaning |
|---|---|---|
| `YOUTUBE_API_KEY` | none | Required for YouTube numbers. |
| `INSTAGRAM_GRAPH_ACCESS_TOKEN`, `INSTAGRAM_GRAPH_OWNER_ID` | none | Required for Instagram numbers (Business Discovery). |
| `PCI_PIPELINE_DAILY` | on | `false` switches the 09:00 run off. |
| `PCI_MIN_COVERAGE` | `0.5` | A ranking needs this share of its people to have fresh numbers or it is not published. |
| `PCI_RETENTION_DAYS_YOUTUBE`, `PCI_RETENTION_DAYS_INSTAGRAM` | 90 | How long old numbers are kept (minimum 8). |
| `RUN_WORKER_IN_API` | off | `true` runs the scheduler inside the API process when no separate worker is deployed. Use one or the other, not both. |
| `PCI_LEGACY_PUBLIC` | off | `true` brings the old public ranking endpoints back (rollback switch). |
| `PCI_LEGACY_SYNC` | off | `true` brings the old YouTube and Instagram sync back (rollback switch). |
| `PCI_DOCS` | on | `false` hides `/docs` and `/api/v1/openapi.json`. |

## Cutover (switching the public site to the new rankings)
Do these in order. Each step can be undone.
1. Deploy Zip 4 with the old switches still honoured: set `PCI_LEGACY_PUBLIC=true` and `PCI_LEGACY_SYNC=true` for the first deploy.
2. Run the pipeline once by hand (Pipeline → Run all three). Check Alerts is empty and Live rankings shows all rankings with a recent time.
3. Pipeline → **Compare with the old site**. Read the differences. Different people in the bucket than in the old list is expected; unexplained differences are not.
4. Open the public site and check the wheel (three sorts), the platform rows, the category rows, the Top 100 and one profile.
5. Remove `PCI_LEGACY_PUBLIC` and `PCI_LEGACY_SYNC` (or set them to `false`) and redeploy. Old public endpoints now answer 410 and the old sync stops using API quota.
6. Wait a week. If nothing needed the old pieces, the old code can be deleted (see the notes for Zip 4).
**Rollback:** set `PCI_LEGACY_PUBLIC=true` and `PCI_LEGACY_SYNC=true` again. The old site code still reads the old tables.

## Daily care
- Look at the Pipeline screen once a day. Alerts and a "stale" badge (a live ranking older than 36 hours) are the two things that need action.
- **Worker not responding:** the daily run needs the worker (or `RUN_WORKER_IN_API=true`). Restart it, then use *Run all three*.
- **YouTube or Instagram errors in Refresh results:** open the run's accounts. `rate_limited` and `error` are retried up to three times automatically. `not_found` means the account is gone or the handle changed; fix or remove the person. `hidden` means the owner hides the count; the person is left out of that ranking, never shown as zero.
- **A ranking was blocked by a safety check:** the previous ranking stays live. The alert names the check. The usual cause is too few people with fresh numbers (coverage). Fix the refresh problem, then Run all three.
- **Bad ranking went live:** Pipeline → Live rankings → *Restore previous*. It is refused if the previous ranking contains someone who has since been deleted.
- **Removing a person:** Bucket → select → Delete (owner only, type DELETE). They vanish from every ranking at once, the others keep their numbers, and nothing of them is left in the database.

## Quota notes
YouTube: about 1 unit per 50 channels plus 1 per uploads page (up to 4 pages per channel for Most Active). Instagram Business Discovery has its own hourly limit; a rate-limited account is retried, then reported.

## Backups and secrets
- Back up the PostgreSQL database daily. Rankings can be rebuilt from stored numbers; the bucket cannot.
- Keep API keys only in the host's environment settings, never in the repository. If a key was ever committed, rotate it.

## Public API
Read-only, documented at `/docs` (machine-readable at `/api/v1/openapi.json`). Everything under `/api/v1/public`.
