---

name: lycobo-image
description: Submit single-image, image-set, and scheduled generation tasks through Lycobo. Prepare optional reference images from an authorized local folder and return task numbers after acceptance. Download originals only when requested.
---

# Lycobo Image Generation

## Connect to Lycobo

Use an agent that supports skill imports and Streamable HTTP MCP. If the account has access, open **App connections** from the Lycobo profile menu. Create an image API key and download the skill from **Skill and API key**. In **Set up connection**, copy the URL and header value, then add an HTTP connector to the agent. Import the skill and call its tools through the connector. Use the full registered tool name if the client adds a namespace.

Use `Authorization` as the header name and `Bearer <image API key>` as its value. Save the value in the connector’s credentials settings. Leave real keys out of conversations, prompts, task descriptions, and examples. If the tools are missing, credentials are invalid, or the account lacks access, explain the issue and direct the user to **App connections**.

## Submit generation tasks

Set the ratio through the current connector’s `aspectRatio` parameter. If the field is missing, ask the user to refresh the Lycobo connector’s tool list and pause submission.

1. Preserve the requested product details, copy language, and composition. Use the user's requested width-to-height ratio. When only the intended use is given, choose a suitable `aspectRatio`, such as `4:5` for a portrait product poster, `9:16` for full-screen vertical images, or `16:9` for a banner. Use `1:1` when the use is unclear. Resolutions are `1.5K`, `2K`, and `4K`, with `1.5K` as the default. If references are needed, prepare their asset IDs as described below.
2. For a single standalone image, call `generate_image` with `prompt`, `resolution`, `aspectRatio`, and `requestId`. The prompt must be 1–5,000 characters.
3. Call `generate_image_set` once per set with `title`, `resolution`, `aspectRatio`, `requestId`, and `images`. The set title and each image title must be 1–40 characters. The set title must contain at least one letter or number. Each image prompt must be 5–4,000 characters. A set contains 1–20 images with a shared ratio. If the user requests ten sets of ten, submit ten tasks with no extra confirmation for the combined count. If a single set exceeds 20, explain the limit and ask how to split it.
4. Generate a separate UUID for every new task’s `requestId`. Keep the UUID and inputs before submitting. If a timeout or lost response leaves acceptance unclear, make a bounded retry with the same UUID and unchanged inputs. Once you have a task `id`, reuse the existing task. If the request conflicts with an existing submission, check the saved receipt and original inputs.

Example `generate_image_set` arguments for a two-image set. Generate a fresh UUID for each real submission and reuse it for retries of that submission.

```json
{
  "title": "Linen bedding",
  "resolution": "1.5K",
  "aspectRatio": "4:5",
  "requestId": "ec01a690-674a-4676-9f88-f1eecbdf7bd0",
  "images": [
    {
      "title": "Hero image",
      "prompt": "Front view of beige linen bedding by a window, soft daylight, natural folds"
    },
    {
      "title": "Texture detail",
      "prompt": "Close-up of the same beige linen bedding, showing the weave and edge stitching"
    }
  ]
}
```

## Use local reference images

In Doubao, select **Local computer** and have the user choose a folder once and authorize it for the scheduled task. Save that folder, the file selection rule, and how references are assigned to each set. On later runs, read matching images from the authorized folder. The agent must be able to run the included script locally and call the connector. A cloud runner cannot read files on the computer.

1. At the start of each run, select up to five references per set using the saved rules. The folder may contain more images, and each set can use a different selection. Prepare references shared by several sets once. For the selected files only, run `python3 scripts/reference_files.py fingerprint <folder> <file1> <file2> ...` to calculate each original file’s SHA-256. Pass each filename as a separate argument, using a relative path within the folder or an absolute path. Keep the returned `files` locally. Renaming identical content still reuses the existing asset.
2. Call `prepare_reference_uploads` with only `{ "fingerprints": [...] }`. Deduplicate the hashes and send up to 100 per call. A hit returns `sha256` and `assetId`. A miss returns `sha256`, `uploadUrl`, and `uploadToken`. When every hash is a hit, use the returned asset IDs and skip the upload command.
3. If any hashes are missing, run `python3 scripts/reference_files.py upload <folder>`. Pass `{ "files": [...], "references": [...] }` on standard input. The two arrays come from steps 1 and 2. The helper compresses only new or changed files to WebP, preserves aspect ratio and transparency, and targets 500 KiB with a 1 MiB cap and a 1,600-pixel longest edge. The device needs Pillow with WebP support or ImageMagick 7. For a test deployment, pass the Lycobo origin confirmed by the user with `--base-url`.
4. Read the matching `assetId` values from the helper’s `files` output. Deduplicate them and pass them as `referenceAssetIds` to `generate_image` or `generate_image_set`. Each task accepts up to five references. Images in a set share the references for that set. If a required reference is missing, changes during processing, or fails to upload, pause the affected task and report the cause. Recalculate and check fingerprints again if a ticket expires or a file changes. Keep the original arguments and request UUID after submitting the new task.

The connector keeps the long-lived key. Give short-lived upload tickets only to the local helper’s standard input. Omit credentials and local paths from chat, task descriptions, and logs. If the schedule cannot access the local computer or the connector does not list `prepare_reference_uploads`, explain that it needs local execution or a connector refresh.

## Submission receipt

Read the JSON from the tool’s text item in `content`. A task `id` confirms that Lycobo accepted the submission. Save `id`, `publicId`, and `historyUrl`. Reply briefly with “Submitted · Task WS8TZGMH5,” using the actual task number and linking it to `historyUrl`. For multiple sets, give the accepted count and list each set’s name and task number. Explain any submissions that were not accepted separately. If Lycobo reports a different aspect ratio from the request, include the actual ratio.

End the run after handling submissions by default. Start a local download for a task only when the user explicitly asks for automatic downloads.

## Optional automatic downloads

When users explicitly request automatic downloads, have them choose a destination folder in Doubao’s **Local computer** mode. Save it for scheduled runs. The destination can differ from the reference folder. Share the submission receipt first.

1. Call `prepare_task_download` separately for each task `id`. Pass its full JSON to `python3 scripts/download_task.py <destination-folder>` on standard input, with the folder as a separate argument. Use only the destination the user chose. If the tool is missing, ask the user to refresh the Lycobo connector.
2. The local helper starts a separate download process for each task. When it reports `started`, tell the user the images will be downloaded after generation and end the turn. Each finished task saves its originals to a separate `Lycobo-<task-number>` subfolder. If some images fail to generate, the helper saves the available originals. For a test deployment, use `--base-url` and `--media-origin` with the confirmed API and media origins.
3. The computer must stay on and allow the background process to run. Read the folder’s `.lycobo-download.json` for failures. To resume, request a ticket for the existing task and start the helper again. It skips files already saved. Pass tickets only on standard input and omit tickets, signed URLs, and image display from chat.

## Handle failures

When the tool sets `isError: true`, read `code`, `message`, and `retryAfterSeconds` if present.

- For authentication failures, check the connector URL, the `Authorization` value, and the key’s status. Continue the original task after correcting the connection.
- For invalid input, identify the field and the constraint. For content rejection, explain the reason and wait for revised instructions. For insufficient credits, tell the user that credits are needed. Pause the affected submission after an explicit rejection.
- When rate-limited, wait as instructed and reuse the original UUID when retrying the same task. If the current run cannot wait, report accepted tasks and what remains.
- If acceptance is still unclear after a retry, report “Submission unconfirmed” and keep the original UUID and inputs so the same submission can be resumed.

## Schedule generation

When the agent supports scheduling, use the requested cadence and time zone. Ask for missing prompts, set counts, image counts per set, or timing details. Set the aspect ratio and resolution when creating the schedule and apply them to each run. Explain that Lycobo charges credits per image under its generation rules. Generate new task UUIDs for each scheduled run and reuse them for retries of that run. Submit the work for the current occurrence and report its receipts. If the schedule includes automatic downloads, start a download for each accepted task in that run.
