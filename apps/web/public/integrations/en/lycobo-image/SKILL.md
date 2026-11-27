---

name: lycobo-image
description: Generate individual images or multiple image sets with Lycobo, check task status, preview images, and retrieve results. Use when the user asks for Lycobo image generation, Lycobo task results, or scheduled Lycobo generation in an agent that supports scheduling.
---

# Lycobo Image Generation

## Connect to Lycobo

Use an agent that supports skill imports and Streamable HTTP MCP. If the account has access, open **App connections** from the Lycobo profile menu. Create an image API key and download the skill from **Skill and API key**. In **Set up connection**, copy the URL and header value, then add an HTTP connector to the agent. Import the skill and call its tools through the connector. Use the full registered tool name if the client adds a namespace.

Use `Authorization` as the header name and `Bearer <image API key>` as its value. Save the value in the connector’s credentials settings. Leave real keys out of conversations, prompts, task descriptions, and examples. If the tools are missing, credentials are invalid, or the account lacks access, explain the issue and direct the user to **App connections**.

## Submit generation tasks

1. Preserve the requested product details, copy language, and composition. Use the user's requested width-to-height ratio. When only the intended use is given, choose a suitable `aspectRatio`, such as `4:5` for a portrait product poster, `9:16` for full-screen vertical images, or `16:9` for a banner. Use `1:1` when the use is unclear. Resolutions are `1.5K`, `2K`, and `4K`, with `1.5K` as the default. Direct users who need to upload a reference image to the Lycobo website.
2. For a single standalone image, call `generate_image` with `prompt`, `resolution`, `aspectRatio`, and `requestId`. The prompt must be 1–5,000 characters.
3. Call `generate_image_set` once per set with `title`, `resolution`, `aspectRatio`, `requestId`, and `images`. The set title and each image title must be 1–40 characters. The set title must contain at least one letter or number. Each image prompt must be 5–4,000 characters. A set contains 1–20 images with a shared ratio. If the user requests ten sets of ten, submit ten tasks with no extra confirmation for the combined count. If a single set exceeds 20, explain the limit and ask how to split it.
4. Generate a separate UUID for every new task’s `requestId`. Keep the UUID and inputs before submitting. If a timeout or lost response leaves acceptance unclear, make a bounded retry with the same UUID and unchanged inputs. Once you have a task `id`, query that task with `get_image`. If the request conflicts with an existing submission, check the saved receipt and original inputs.
5. Save the returned `id`, `publicId`, and `historyUrl`. Show the actual `publicId` and submitted ratio to the user, for example, “Task ID `WS8TZGMH5` · `4:5`.” `id` is the internal task UUID. `replayed: true` means the request returned an existing task. For multiple sets, report each set’s title, short ID, and status.

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

## Check status and share results

When the user wants images delivered in chat, follow submission with `get_image`. Pass either the short `publicId` or the UUID `id` as `taskId`. Query an existing task directly. If the tool wraps JSON in a text item inside `content`, read the status, task number, and links from that item.

- For `queued` or `running`, wait according to `retryAfterSeconds`. Check the same task at most three times in the current run. If it is still processing, return the task ID and current status.
- For `succeeded`, show the task ID, previews, and links to download the originals. For `partially_failed`, report the partial failure and deliver the images the tool returned.
- For `failed` or `needs_reconciliation`, report the failure or pending review. Ask before submitting a replacement that could use credits again.

For in-chat previews, call `preview_image` with the task ID and `imageIndex` (starting at 1, defaulting to the first image). If the client cannot render the MCP image result, share the `images[].previewUrl` from `get_image` so the user can open the thumbnail. For multiple images, list each preview link by `imageIndex`.

Turn each `images[].url` into a clickable “Download original N” file link in chat. Preview and download links expire at `expiresAt`, normally after 15 minutes. Call `get_image` again with the same task ID to refresh them. Share `historyUrl` if the user needs the set as a ZIP or wants to open its web record.

## Handle failures

When the tool sets `isError: true`, read `code`, `message`, and `retryAfterSeconds` if present.

- For authentication failures, check the connector URL, the `Authorization` value, and the key’s status. Continue the original task after correcting the connection.
- For invalid input, identify the field and the constraint. For content rejection, explain the reason and wait for revised instructions. For insufficient credits, tell the user that credits are needed. Pause the affected submission after an explicit rejection.
- When rate-limited, wait as instructed and reuse the original UUID when retrying the same task. If the current run cannot wait, report accepted tasks and what remains.
- After an ambiguous submission, retain the original UUID to avoid duplicate tasks and charges. If a status check fails, retain the existing task link and ID.

## Schedule generation

When the agent supports scheduling, use the requested cadence and time zone. Ask for missing prompts, set counts, image counts per set, or timing details. Set the aspect ratio and resolution when creating the schedule and apply them to each run. Explain that Lycobo charges credits per image under its generation rules. Generate new task UUIDs for each scheduled run and reuse them for retries of that run. Submit only the work for the current occurrence and report each set’s task link.
