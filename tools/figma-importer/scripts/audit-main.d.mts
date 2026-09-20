export function auditMainBundle(code: string): {
  ecmaVersion: number;
  sourceType: string;
  importExpressions: number;
  importMeta: number;
  moduleDeclarations: number;
  dynamicCodeGenerationReferences: number;
  comments: number;
};
