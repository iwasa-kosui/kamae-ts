export function selectedPackage(original: string, selected: string) {
  const before = JSON.parse(original), after = JSON.parse(selected);
  const dependencies = after.dependencies;
  if (!dependencies || typeof dependencies !== "object" || Array.isArray(dependencies))
    throw new Error("dependencies must be an object");
  const canonical = (value: Record<string, unknown>) => JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
  const { dependencies: _, ...originalFields } = before;
  const { dependencies: __, ...selectedFields } = after;
  if (canonical(originalFields) !== canonical(selectedFields)) throw new Error("Only dependencies may change in package.json");
  for (const [name, version] of Object.entries(dependencies)) {
    if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(name) ||
        typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version))
      throw new Error(`Select exact registry versions only: ${name}`);
  }
  return dependencies as Record<string, string>;
}
