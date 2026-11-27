# Download originals when tasks finish

If the user asks for automatic downloads, choose a destination folder in Doubao’s **Local computer** mode and save that choice for scheduled runs. It can differ from the reference folder. Skip this guide for ordinary submissions.

1. Call `prepare_task_downloads({taskIds})` once with the accepted IDs, up to 20 per batch. For existing tasks, task numbers also work. Reuse the existing tasks for downloads.
2. Pass the tool’s JSON to `python3 scripts/download_task.py <destination-folder>` on standard input, with the folder as a separate argument. When it reports `started`, confirm downloads are scheduled and end the turn. Keep tickets out of chat and logs.
3. The helper checks tasks in batches and downloads each finished task independently into a `Lycobo-<task-number>` subfolder. It saves available images after partial success, downloads up to three images across the computer for the current user, and skips already-saved files.
4. `restartResume: true` confirms macOS login recovery is enabled for the current user. Pending downloads resume after login while the ticket is valid, for up to seven days. In other cases, `python3 scripts/download_task.py --worker` resumes the local queue. For expired tickets or a rotated key, get a fresh ticket for the existing tasks. The task subfolder’s `.lycobo-download.json` records failures.
