---

name: lycobo-image
description: Submit single-image, image-set, and scheduled generation tasks through Lycobo and return task numbers. Prepare local references or download originals on request.
---

# Lycobo Image Generation

Add the HTTP MCP connector from Lycobo **App connections**. Save `Authorization: Bearer <image API key>` in the connector’s credentials. If a tool is missing or authentication fails, ask the user to check the connector.

## Submit

- For one image, call `generate_image` with `prompt`, `resolution`, `aspectRatio`, and `requestId`. Call `generate_image_set` once per set, using `title` and `images: [{title, prompt}]` in place of a single prompt. Each set can contain 1–20 images with a shared ratio and up to five references. Ten sets are ten tasks.
- Default to `1.5K`; also support `2K` and `4K`. Pass `aspectRatio` directly. Use the requested ratio, pick one based on the intended use, or use `1:1` if neither is specified. If the parameter is missing, ask the user to refresh the connector before submitting.
- For local references, follow [Local reference images](references/local-images.md) to prepare `referenceAssetIds`.
- Use a new UUID for each new task. If acceptance is unclear, retry with the same UUID and arguments. Observe rate-limit delays. Reuse accepted tasks to avoid duplicate charges.

## Receipts and schedules

Read `id`, `publicId`, and `historyUrl` from the tool’s text JSON. After receiving `id`, say “Submitted” with the task number linked to `historyUrl`. For multiple sets, give the accepted count and each task number; mention rejected submissions separately. End the turn by default. If automatic downloads were requested, follow [Automatic downloads](references/downloads.md) for this run’s tasks.

For schedules, use the agreed cadence, time zone, selection rules, prompts, ratio, and resolution. Explain that Lycobo charges credits per image when creating the schedule. Use new task UUIDs for each occurrence.
