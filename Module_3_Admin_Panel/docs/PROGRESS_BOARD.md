# Progress tab — project boards

The **Progress** tab (under Overview, visible to all admin roles) shows one visual board per project,
so every software contributor can see what is built, in progress, missing or not verifiable.

## Hierarchy

```
public/progress-board/
  projects.json              list of projects (tabs on the Progress page)
  creator-index/             one folder per project (slug = folder name)
    index.html               interactive board (read-only in the panel via ?view=1)
    status.json              shared progress: statuses, notes, edited text, added notes/arrows
    diagram.svg / .png       static copies
```

## Update a board

1. Progress → choose the project → **Open editor** (owner/editor).
2. Click shapes, arrows or cards to set status and notes. Use **Edit text**, **+ Text** and **+ Arrow** as needed.
3. Click **Export**. This downloads `status.json`.
4. Replace `public/progress-board/<slug>/status.json` in the repo, commit to main and deploy.

Edits made in the editor stay in your browser until you export and deploy. Collaborators only see deployed `status.json`.

## Add a new project

1. Create the board files (index.html + status.json) in `public/progress-board/<new-slug>/`.
   Boards are generated per project. Ask Claude to build the next one from the same template.
2. Add `{ "slug": "<new-slug>", "title": "...", "description": "..." }` to `projects.json`.
3. `npm test` checks that every listed project has its files.

## Security note

Boards are static files: framing is limited to this admin origin, and the boards are never indexed by search engines.
They do not require a login to fetch if someone knows the exact URL, so keep secrets, keys and credentials out of board text and notes.
