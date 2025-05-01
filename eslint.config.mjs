import jsdocPlugin from "eslint-plugin-jsdoc";

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        // Root-level configuration for your project
        ignores: [
            "foundry/**",   // Symlinked directories - ignore linting
            "systems/**",   // Symlinked directories - ignore linting
            "**/*.md"
        ],
  
        languageOptions: {
            ecmaVersion: "latest", // Use the latest ECMAScript standard
            sourceType: "module",  // Allow ES module imports/exports
            globals: {
                // Browser, Node, and jQuery environments
                window: "readonly",
                document: "readonly",
                module: "readonly",
                require: "readonly",
                $: "readonly",
                jQuery: "readonly"
            }
        },

        linterOptions: {
		    reportUnusedInlineConfigs: "error",
	    },
  
        plugins: {
            jsdoc: jsdocPlugin 
        },

        rules: {
            "array-bracket-spacing": ["warn", "never"],
            "array-callback-return": "warn",
            "arrow-spacing": "warn",
            "comma-style": "warn",
            "computed-property-spacing": "warn",
            "constructor-super": "error",
            "default-param-last": "warn",
            "dot-location": ["warn", "property"],
            "eol-last": ["error", "always"],
            "eqeqeq": ["warn", "smart"],
            "func-call-spacing": "warn",
            "func-names": ["warn", "never"],
            "getter-return": ["warn", { allowImplicit: true }],
            "lines-between-class-members": "warn",
            "new-parens": ["warn", "always"],
            "no-alert": "warn",
            "no-array-constructor": "warn",
            "no-class-assign": "error",
            "no-compare-neg-zero": "warn",
            "no-cond-assign": "warn",
            "no-const-assign": "error",
            "no-constant-condition": "warn",
            "no-constructor-return": "warn",
            "no-delete-var": "warn",
            "no-dupe-args": "error",
            "no-dupe-class-members": "error",
            "no-dupe-keys": "warn",
            "no-duplicate-case": "warn",
            "no-duplicate-imports": ["warn", { includeExports: true }],
            "no-empty": ["warn", { allowEmptyCatch: true }],
            "no-empty-character-class": "warn",
            "no-empty-pattern": "warn",
            "no-func-assign": "warn",
            "no-global-assign": "warn",
            "no-implicit-coercion": ["warn", { allow: ["!!"] }],
            "no-implied-eval": "warn",
            "no-import-assign": "warn",
            "no-invalid-regexp": "warn",
            "no-irregular-whitespace": "warn",
            "no-iterator": "warn",
            "no-lone-blocks": "warn",
            "no-lonely-if": "warn",
            "no-misleading-character-class": "warn",
            "no-mixed-operators": "warn",
            "no-multi-str": "warn",
            "no-multiple-empty-lines": "warn",
            "no-new-func": "warn",
            "no-new-object": "warn",
            "no-new-symbol": "warn",
            "no-new-wrappers": "warn",
            "no-nonoctal-decimal-escape": "warn",
            "no-obj-calls": "warn",
            "no-octal": "warn",
            "no-octal-escape": "warn",
            "no-promise-executor-return": "warn",
            "no-proto": "warn",
            "no-regex-spaces": "warn",
            "no-script-url": "warn",
            "no-self-assign": "warn",
            "no-self-compare": "warn",
            "no-setter-return": "warn",
            "no-sequences": "warn",
            "no-template-curly-in-string": "warn",
            "no-this-before-super": "error",
            "no-unexpected-multiline": "warn",
            "no-unmodified-loop-condition": "warn",
            "no-unneeded-ternary": "warn",
            "no-unreachable": "warn",
            "no-unreachable-loop": "warn",
            "no-unsafe-negation": ["warn", { enforceForOrderingRelations: true }],
            "no-unsafe-optional-chaining": ["warn", { disallowArithmeticOperators: true }],
            "no-unused-expressions": "warn",
            "no-useless-backreference": "warn",
            "no-useless-call": "warn",
            "no-useless-catch": "warn",
            "no-useless-computed-key": ["warn", { enforceForClassMembers: true }],
            "no-useless-concat": "warn",
            "no-useless-constructor": "warn",
            "no-useless-rename": "warn",
            "no-useless-return": "warn",
            "no-var": "warn",
            "no-void": "warn",
            "no-whitespace-before-property": "warn",
            "prefer-numeric-literals": "warn",
            "prefer-object-spread": "warn",
            "prefer-regex-literals": "warn",
            "prefer-spread": "warn",
            "rest-spread-spacing": ["warn", "never"],
            "semi-spacing": "warn",
            "semi-style": ["warn", "last"],
            "space-unary-ops": ["warn", { words: true, nonwords: false }],
            "switch-colon-spacing": "warn",
            "symbol-description": "warn",
            "template-curly-spacing": ["warn", "never"],
            "unicode-bom": ["warn", "never"],
            "use-isnan": ["warn", { enforceForSwitchCase: true, enforceForIndexOf: true }],
            "valid-typeof": ["warn", { requireStringLiterals: true }],
            "wrap-iife": ["warn", "inside"],
            "indent": ["warn", 4, { SwitchCase: 1 }],
            "jsdoc/require-jsdoc": "warn",
            "jsdoc/check-param-names": "warn",
            "jsdoc/check-types": "warn"
        }
    }
];

