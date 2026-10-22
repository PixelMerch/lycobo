import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectChanges,
  loadGitHubAuthors,
  renderNotes,
  validateVersion,
} from "./release-notes.mjs";

const directories = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
async function fixture() {
  const cwd = await mkdtemp(path.join(tmpdir(), "lycobo-release-test-"));
  directories.push(cwd);
  const git = (...args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Author",
        GIT_AUTHOR_EMAIL: "author@example.invalid",
        GIT_COMMITTER_NAME: "Committer",
        GIT_COMMITTER_EMAIL: "committer@example.invalid",
      },
    }).trim();
  git("init", "--initial-branch=main");
  const commit = async (file, subject) => {
    await writeFile(path.join(cwd, file), subject);
    git("add", "--", file);
    git("-c", "commit.gpgsign=false", "commit", "-m", subject);
    return git("rev-parse", "HEAD");
  };
  return { cwd, git, commit };
}
describe("release history", () => {
  it("records the complete first release, then limits the next version to new commits", async () => {
    const { cwd, git, commit } = await fixture();
    await commit("first.txt", "feat(web): 初始功能");
    git("tag", "v0.1.0");
    const sha = await commit("fix.txt", "fix(api): repair task retries");
    const initial = collectChanges(cwd, "v0.1.0", "v0.1.0");
    expect(initial.previous).toBeNull();
    expect(initial.commits).toHaveLength(1);
    expect(initial.commits[0].files).toEqual(["first.txt"]);
    const next = collectChanges(cwd, "v0.2.0");
    expect(next.previous).toBe("v0.1.0");
    expect(next.commits).toHaveLength(1);
    expect(next.commits[0]).toMatchObject({
      sha,
      author: "Author",
      committer: "Committer",
      type: "fix",
      files: ["fix.txt"],
    });
  });
  it("ignores tags on an unrelated branch and includes merge changes", async () => {
    const { cwd, git, commit } = await fixture();
    await commit("base.txt", "chore(repo): initialize");
    git("checkout", "-b", "other");
    await commit("other.txt", "feat(web): unrelated");
    git("tag", "v9.0.0");
    git("checkout", "main");
    await commit("main.txt", "fix(api): scope requests");
    expect(collectChanges(cwd, "v0.1.0").previous).toBeNull();
    git("-c", "commit.gpgsign=false", "merge", "--no-ff", "other", "-m", "Merge reviewed changes");
    const data = collectChanges(cwd, "v10.0.0");
    expect(data.commits[0].files).toContain("other.txt");
  });
  it("rejects shell-like and malformed version input", () => {
    for (const version of ["v01.2.3", "0.1.0", "v0.1.0; touch /tmp/a", "v1.0.0\nBAD=1", "--help"]) {
      expect(() => validateVersion(version)).toThrow();
    }
    expect(validateVersion("v0.1.0")).toBe("v0.1.0");
  });
  it("groups changes, attributes author and committer, escapes injected Markdown and preserves full JSON paths", async () => {
    const { cwd, commit } = await fixture();
    const sha = await commit("商品图.txt", "fix(web): <script> @everyone [broken]");
    const data = collectChanges(cwd, "v0.1.0");
    const notes = renderNotes(
      data,
      "PixelMerch/lycobo",
      new Map([[sha, { author: "author-user", committer: "github-actions[bot]" }]]),
    );
    expect(notes).toContain("## 问题修复");
    expect(notes).toContain("[@author-user](https://github.com/author-user)");
    expect(notes).toContain("提交人");
    expect(notes).toContain("&#60;script&#62;");
    expect(notes).not.toContain("@everyone");
    expect(notes).not.toContain("author@example.invalid");
    expect(data.commits[0].files).toEqual(["商品图.txt"]);
    expect(renderNotes(data, "PixelMerch/lycobo", new Map(), 0)).toContain("完整日志");
  });
  it("does not silently lose contributor attribution on GitHub API failure", async () => {
    await expect(
      loadGitHubAuthors(
        "PixelMerch/lycobo",
        "a".repeat(40),
        "test-only",
        async () => new Response("", { status: 403 }),
      ),
    ).rejects.toThrow("403");
    await expect(loadGitHubAuthors("bad/repo/extra", "a", "test-only")).rejects.toThrow(
      "Invalid repository",
    );
  });
});
