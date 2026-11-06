function bindingChanged(saved, deployed) {
  if (saved?.type !== deployed?.type) return true;
  return saved?.type === "plain_text" && saved.text !== deployed?.text;
}

/** 比较仓库、控制台设置和活动版本，只返回差异名称，不输出密钥值。 */
export function configurationDifferences(config, settingsBindings, activeBindings) {
  const settings = new Map(settingsBindings.map((binding) => [binding.name, binding]));
  const active = new Map(activeBindings.map((binding) => [binding.name, binding]));
  const differences = new Set();
  for (const name of new Set([...settings.keys(), ...active.keys()])) {
    const saved = settings.get(name);
    const deployed = active.get(name);
    if (bindingChanged(saved, deployed)) differences.add(`settings:${name}`);
  }
  for (const [name, value] of Object.entries(config.vars ?? {})) {
    if (settings.get(name)?.text !== value) differences.add(`settings:${name}`);
    if (active.get(name)?.text !== value) differences.add(`active:${name}`);
  }
  for (const name of config.secrets?.required ?? []) {
    if (settings.get(name)?.type !== "secret_text") differences.add(`settings:${name}`);
    if (active.get(name)?.type !== "secret_text") differences.add(`active:${name}`);
  }
  return [...differences].sort();
}
