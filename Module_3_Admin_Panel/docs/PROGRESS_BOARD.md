# Progress tab — project boards

The **Progress** tab (under Overview) shows one visual board per project.

- **Everyone** (owner, editor, moderator) sees the same live board.
- **Owners and editors** can change it directly in the tab, and every change saves automatically for the whole team.

## Tools on the board

| Tool | What it does |
| --- | --- |
| Select | Click a shape, arrow or card, then set its status (Implemented, In progress, Missing, Not verifiable) and a note |
| Edit text | Click any text to rename it |
| + Text | Click the canvas to add a note; drag it to move |
| + Arrow | Click start, then end; give it a label and status |
| Undo | Revert the last change (Ctrl+Z) |
| Backup | Save the board state as a JSON file |
| Import | Load a backup |
| PNG / SVG | Save a picture of the board; Chrome/Edge ask where to save (e.g. Desktop) |
| Reset | Back to the original statuses (can be undone) |

If two people save at the same moment, the second is told and the board reloads with the latest version. Changes from teammates appear within 30 seconds.

## Hierarchy

```
public/progress-board/
  projects.json              projects shown as cards on the Progress page
  <slug>/index.html          the board (one folder per project)
  <slug>/status.json         default statuses (used until someone edits the board)
Module 1: progress_boards    saved team state per slug (GET/PUT /api/v1/admin/progress/:slug)
```

## Add a new project

1. Add a board folder `public/progress-board/<new-slug>/` (index.html + status.json). Ask Claude to build it from the same template.
2. Add `{ "slug": "<new-slug>", "title": "...", "description": "..." }` to `projects.json`.

## Security

- Saving requires an admin session, CSRF token and owner/editor role. It is validated, size-limited and audited.
- Board files are static and can only be framed by this admin site, never indexed.
- Keep keys, passwords and secrets out of board text and notes.
