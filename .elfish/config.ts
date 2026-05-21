export default {
  name: "elfish",
  hooks: {
    "follow-up": "@elfish/hooks/follow-up",
  },
  gates: "@elfish/gates/js",
  /*
    {
      "decompose": ["@elfish/gates/js/decompose"],
      "spec": ["@elfish/gates/js/spec"],
      "plan": ["@elfish/gates/js/plan"],
      "implement": ["@elfish/gates/js/implement"],
      "review": ["@elfish/gates/js/review"],
      "recompose": ["@elfish/gates/js/recompose"],
    },
  */
  workflows: [
    "@elfish/workflows/standard",
    "@elfish/workflows/quick-fix",
    "@elfish/workflows/eipc",
    "@elfish/workflows/doc-update",
  ],
};
