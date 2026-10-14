export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "web",
        "api",
        "worker",
        "contracts",
        "db",
        "queue",
        "generation",
        "storage",
        "design",
        "docs",
        "deps",
        "ci",
        "repo",
        "skills",
      ],
    ],
    "subject-case": [0],
    "scope-empty": [2, "never"],
  },
};
