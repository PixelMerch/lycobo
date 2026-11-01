import { expect, it } from "vitest";
import { nextVersion, reserveVersion } from "./release-version.mjs";

it("increments stable patches numerically and respects an explicit new baseline", () => {
  expect(nextVersion(["v0.4.9", "v0.4.10", "v8.0.0-beta"], "v0.4.0")).toBe("v0.4.11");
  expect(nextVersion(["v0.4.9"], "v0.5.0")).toBe("v0.5.0");
  expect(nextVersion([], "v0.4.0")).toBe("v0.4.0");
});
it("reuses an existing commit tag without allocating a duplicate", async () => {
  const version = await reserveVersion({
    sha: "same",
    baseline: "v0.4.0",
    listTags: async () => [{ ref: "refs/tags/v0.4.1", object: { type: "tag", sha: "annotation" } }],
    resolveTag: async () => "same",
    createTag: async () => {
      throw new Error("must not create");
    },
  });
  expect(version).toBe("v0.4.1");
});
it("retries a competing reservation but surfaces real API failures", async () => {
  const tags = [{ ref: "refs/tags/v0.4.0", object: { type: "commit", sha: "old" } }];
  let calls = 0;
  const options = {
    sha: "new",
    baseline: "v0.4.0",
    listTags: async () => tags,
    resolveTag: async () => "old",
    createTag: async (version) => {
      if (++calls === 1) {
        tags.push({ ref: `refs/tags/${version}`, object: { type: "commit", sha: "competitor" } });
        throw new Error("exists");
      }
    },
  };
  expect(await reserveVersion(options)).toBe("v0.4.2");
  await expect(
    reserveVersion({
      ...options,
      createTag: async () => {
        throw new Error("permission denied");
      },
    }),
  ).rejects.toThrow("permission denied");
});
