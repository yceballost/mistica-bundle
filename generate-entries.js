const fs = require("fs")
const path = require("path")

// The package index statically imports every module, icons included. With code
// splitting, esbuild then treats all icons as shared with the main bundle. Resolving
// each export to its own file keeps the icons out of the main bundle.
const PACKAGE = "@telefonica/mistica/dist-es"
const distEs = path.join(__dirname, "node_modules", PACKAGE)
const index = fs.readFileSync(path.join(distEs, "index.js"), "utf8")

// local alias -> { file, imported } where imported is a name, "default" or "*"
const sourceByAlias = new Map()
for (const [, specifiers, file] of index.matchAll(/^import \{([^}]*)\} from "\.\/([^"]+)";/gm)) {
    for (const specifier of specifiers.split(",")) {
        const [imported, alias = imported] = specifier.trim().split(/\s+as\s+/)
        if (imported) sourceByAlias.set(alias, { file, imported })
    }
}
for (const [, alias, file] of index.matchAll(/^import \* as (\w+) from "\.\/([^"]+)";/gm)) {
    sourceByAlias.set(alias, { file, imported: "*" })
}

// public name -> source
const sourceByName = new Map()
const exportList = index.match(/^export \{([^}]*)\};?\s*$/m)[1]
for (const specifier of exportList.split(",")) {
    const [alias, name = alias] = specifier.trim().split(/\s+as\s+/)
    if (sourceByAlias.has(alias)) sourceByName.set(name, sourceByAlias.get(alias))
}

const toExport = (name) => {
    const source = sourceByName.get(name)
    if (!source) throw new Error(`"${name}" is not exported by @telefonica/mistica`)
    const from = `"${PACKAGE}/${source.file}"`
    return source.imported === "*"
        ? `export * as ${name} from ${from}`
        : `export { ${source.imported} as ${name} } from ${from}`
}

const write = (file, names) => {
    fs.writeFileSync(path.join(__dirname, file), `${names.map(toExport).join("\n")}\n`)
    console.log(`${file}: ${names.length} exports`)
}

const entry = fs.readFileSync(path.join(__dirname, "entry.js"), "utf8")
const mainNames = entry
    .match(/export \{([^}]*)\}/)[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
write("entry.resolved.js", mainNames)

const iconNames = [...sourceByName.keys()].filter((name) => /^Icon\w+(Regular|Light|Filled)$/.test(name)).sort()
write("icons-entry.js", iconNames)
