import { parse } from 'acorn';

/** Deliberately scan raw source too: sandbox scanners can reject comments/strings. */
export function auditMainBundle(code) {
  if (/\bimport\s*(?:\(|\/[/*])/.test(code)) throw new Error('MAIN audit: possible import expression');
  if (/\bimport\s*\./.test(code)) throw new Error('MAIN audit: import.meta');
  if (/\beval\s*(?:\(|\/[/*])/.test(code)) throw new Error('MAIN audit: possible eval expression');
  if (/<!--|-->/.test(code)) throw new Error('MAIN audit: HTML comment token');
  const comments = [];
  // Script goal rejects static imports/exports; ES2015 rejects later syntax,
  // including async/await, object spread, optional chaining and dynamic import.
  const ast = parse(code, { ecmaVersion: 2015, sourceType: 'script', onComment: comments });
  if (comments.length) throw new Error('MAIN audit: comments must not reach the sandbox');
  const forbidden = new Set(['eval', 'Function', 'AsyncFunction', 'GeneratorFunction', 'AsyncGeneratorFunction']);
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Identifier' && forbidden.has(node.name)) {
      throw new Error(`MAIN audit: dynamic code generation reference ${node.name}`);
    }
    // Also reject globalThis['Function']/aliases reached through literal properties.
    if (node.type === 'MemberExpression' && node.computed && node.property.type === 'Literal' && forbidden.has(node.property.value)) {
      throw new Error('MAIN audit: computed dynamic code generation reference');
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(ast);
  return { ecmaVersion: 2015, sourceType: 'script', importExpressions: 0, importMeta: 0, moduleDeclarations: 0, dynamicCodeGenerationReferences: 0, comments: 0 };
}
