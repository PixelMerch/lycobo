import { execFileSync } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateVersion } from "./release-notes.mjs";

const stable = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const compare = (a, b) => {
  const x = a.slice(1).split(".").map(BigInt);
  const y = b.slice(1).split(".").map(BigInt);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
};
export function nextVersion(tags, baseline) {
  validateVersion(baseline);
  const latest = tags
    .filter((tag) => stable.test(tag))
    .sort(compare)
    .at(-1);
  if (!latest || compare(baseline, latest) > 0) return baseline;
  const [major, minor, patch] = latest.slice(1).split(".");
  return `v${major}.${minor}.${BigInt(patch) + 1n}`;
}

async function tagForCommit(tags, sha, resolveTag) {
  for (const tag of tags) {
    if (!stable.test(tag.ref.slice("refs/tags/".length))) continue;
    const target = tag.object.type === "commit" ? tag.object.sha : await resolveTag(tag.object.sha);
    if (target === sha) return tag.ref.slice("refs/tags/".length);
  }
  return undefined;
}

/** Atomic tag reservation makes concurrent main releases safe; reruns reuse the same SHA. */
export async function reserveVersion({ sha, baseline, listTags, resolveTag, createTag }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const tags = await listTags();
    const existing = await tagForCommit(tags, sha, resolveTag);
    if (existing) return existing;
    const version = nextVersion(
      tags.map((tag) => tag.ref.slice("refs/tags/".length)),
      baseline,
    );
    try {
      await createTag(version, sha);
      return version;
    } catch (error) {
      const refreshed = await listTags();
      if (!refreshed.some((tag) => tag.ref === `refs/tags/${version}`)) throw error;
    }
  }
  throw new Error("Concurrent release allocation exceeded retry limit");
}

async function main() {
  const repo = process.env.GH_REPO;
  const sha = process.env.RELEASE_SHA;
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[0-9a-f]{40}$/.test(sha ?? ""))
    throw new Error("Invalid release target");
  const api = (...args) => JSON.parse(execFileSync("gh", ["api", ...args], { encoding: "utf8" }));
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const version = await reserveVersion({
    sha,
    baseline: `v${pkg.version}`,
    listTags: async () => api(`repos/${repo}/git/matching-refs/tags/v`),
    resolveTag: async (id) => {
      let tagId = id;
      for (let depth = 0; depth < 10; depth++) {
        const tag = api(`repos/${repo}/git/tags/${tagId}`);
        if (tag.object.type === "commit") return tag.object.sha;
        if (tag.object.type !== "tag") break;
        tagId = tag.object.sha;
      }
      throw new Error("Invalid annotated version tag");
    },
    createTag: async (tag, commit) =>
      api(
        `repos/${repo}/git/refs`,
        "--method",
        "POST",
        "-f",
        `ref=refs/tags/${tag}`,
        "-f",
        `sha=${commit}`,
      ),
  });
  await appendFile(process.env.GITHUB_ENV, `RELEASE_VERSION=${version}\n`);
  console.log(`Release version: ${version}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
