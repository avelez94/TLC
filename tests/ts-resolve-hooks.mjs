// Node module hook used only by `npm test`: lets tests import TypeScript modules the same
// way the app does (extensionless relative imports), without changing tsconfig.json.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../')
    if (relative && !/\.[cm]?[jt]sx?$/.test(specifier)) return nextResolve(`${specifier}.ts`, context)
    throw err
  }
}
