// esbuild inject replaces free references (including dependency aliases) to the
// native code constructor in MAIN only. Zod's capability probe catches this error
// and selects its existing interpreted validator. No dependency source is patched.
function disabledCodeGeneration() {
  throw new Error('Dynamic code generation is disabled in the Figma main bundle');
}
export { disabledCodeGeneration as Function };
