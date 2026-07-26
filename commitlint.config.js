/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
    extends: ["@commitlint/config-conventional"],

    /*
     * Production-grade commitlint configuration
     * ------------------------------------------------
     * Features:
     * - Strict Conventional Commits enforcement
     * - CI/CD friendly
     * - Monorepo compatible
     * - Readable commit history
     * - Semantic-release compatible
     */

    rules: {
        /**
         * ----------------------------------------------------------------
         * TYPE RULES
         * ----------------------------------------------------------------
         */

        "type-enum": [
            2,
            "always",
            [
                "feat", // new feature
                "fix", // bug fix
                "docs", // documentation
                "style", // formatting/style only
                "refactor", // code restructuring
                "perf", // performance improvements
                "test", // tests
                "build", // build system/dependencies
                "ci", // CI/CD changes
                "chore", // maintenance
                "revert", // revert commits
            ],
        ],

        "type-case": [2, "always", "lower-case"],
        "type-empty": [2, "never"],

        /**
         * ----------------------------------------------------------------
         * SCOPE RULES
         * ----------------------------------------------------------------
         */

        "scope-case": [2, "always", "lower-case"],
        "scope-empty": [2, "never"],

        "scope-enum": [
            2,
            "always",
            [
                "api",
                "auth",
                "ui",
                "database",
                "config",
                "deps",
                "build",
                "ci",
                "docker",
                "k8s",
                "infra",
                "security",
                "docs",
                "tests",
                "release",
                "logs",
            ],
        ],

        /**
         * ----------------------------------------------------------------
         * SUBJECT RULES
         * ----------------------------------------------------------------
         */

        "subject-empty": [2, "never"],

        // sentence should not end with period
        "subject-full-stop": [2, "never", "."],

        // enforce lowercase subject
        "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],

        /**
         * ----------------------------------------------------------------
         * HEADER RULES
         * ----------------------------------------------------------------
         */

        "header-max-length": [2, "always", 100],

        /**
         * ----------------------------------------------------------------
         * BODY RULES
         * ----------------------------------------------------------------
         */

        "body-leading-blank": [1, "always"],
        "body-max-line-length": [2, "always", 120],

        /**
         * ----------------------------------------------------------------
         * FOOTER RULES
         * ----------------------------------------------------------------
         */

        "footer-leading-blank": [1, "always"],
        "footer-max-line-length": [2, "always", 120],
    },

    /*
     * Ignore automated version bumps/releases
     */
    ignores: [
        (message) => message.startsWith("Merge branch"),
        (message) => message.startsWith("Merge pull request"),
        (message) => message.startsWith("Release "),
        (message) => /^v\d+\.\d+\.\d+$/.test(message),
    ],

    /*
     * Custom parser options
     */
    parserPreset: {
        parserOpts: {
            issuePrefixes: ["#"],
        },
    },

    /*
     * Default formatter
     */
    formatter: "@commitlint/format",

    /*
     * Helpful prompt support (works with @commitlint/prompt)
     */
    prompt: {
        settings: {},

        messages: {
            skip: ":skip",
            max: "upper %d chars",
            min: "at least %d chars",
            emptyWarning: "cannot be empty",
            upperLimitWarning: "over limit",
            lowerLimitWarning: "below limit",
        },

        questions: {
            type: {
                description: "Select the type of change that you are committing",
            },

            scope: {
                description: "What is the scope of this change?",
            },

            subject: {
                description: "Write a short, imperative tense description",
            },

            body: {
                description: "Provide a longer description of the change",
            },

            isBreaking: {
                description: "Are there any breaking changes?",
            },

            breakingBody: {
                description: "Describe the breaking changes",
            },

            breaking: {
                description: "Describe the breaking changes",
            },

            isIssueAffected: {
                description: "Does this change affect any open issues?",
            },

            issuesBody: {
                description: "Add issue references",
            },

            issues: {
                description: 'Add issue references (e.g. "fix #123")',
            },
        },
    },
};
