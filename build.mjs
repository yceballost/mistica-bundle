import { build } from "esbuild"

// react and react-dom stay external so the page and the bundle share one copy.
// CommonJS dependencies (react-autosuggest, lottie-react...) call require("react"),
// which esbuild cannot satisfy in an ES module and turns into a call that throws in
// the browser. This plugin points those require calls at a small ES module that
// re-exports the external package through a normal import.
const EXTERNALS = ["react", "react-dom", "react/jsx-runtime"]

const cjsRequireOfExternals = {
    name: "cjs-require-of-externals",
    setup(build) {
        build.onResolve({ filter: /^(react|react-dom)$/ }, (args) =>
            args.kind === "require-call" ? { path: args.path, namespace: "external-shim" } : undefined
        )
        build.onLoad({ filter: /.*/, namespace: "external-shim" }, (args) => ({
            contents: `import * as ns from "${args.path}"\nexport * from "${args.path}"\nexport default ns\n`,
            loader: "js",
        }))
    },
}

await build({
    entryPoints: { mistica: "entry.resolved.js", "mistica-icons": "icons-entry.js" },
    bundle: true,
    splitting: true,
    format: "esm",
    minify: true,
    external: EXTERNALS,
    outdir: "dist",
    chunkNames: "chunks/[name]-[hash]",
    plugins: [cjsRequireOfExternals],
    logLevel: "warning",
})
