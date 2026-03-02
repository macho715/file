import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export function loadYaml(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return (yaml.load(content) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

export function loadRulesConfig(rulesDir: string): Record<string, unknown> {
  return loadYaml(path.join(rulesDir, 'rules.yaml'));
}

export function loadMappingConfig(rulesDir: string): Record<string, unknown> {
  return loadYaml(path.join(rulesDir, 'mapping.yaml'));
}
