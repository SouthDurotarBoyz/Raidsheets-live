#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const raidsRoot = path.join(repoRoot, "raids");
const requiredRaidFiles = ["raid.json", "roster-schema.json", "roster-bindings.json"];
const bindingAttributes = ["data-bind", "data-bind-group", "data-target-bind"];
const failures = [];
const warnings = [];

function objectKeys(value) {
  return new Set(Object.keys(value ?? {}));
}

function values(value) {
  return Array.isArray(value) ? value : [value];
}

function report(collection, raidId, file, key, reason) {
  collection.push({ raidId, file, key, reason });
}

async function readJson(raidId, file) {
  const relativeFile = path.join("raids", raidId, file);
  try {
    return JSON.parse(await readFile(path.join(repoRoot, relativeFile), "utf8"));
  } catch (error) {
    report(failures, raidId, relativeFile, "(file)", `could not read valid JSON: ${error.message}`);
    return null;
  }
}

async function discoverRaids() {
  const entries = await readdir(raidsRoot, { withFileTypes: true });
  const raids = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const files = new Set(await readdir(path.join(raidsRoot, entry.name)));
    if (requiredRaidFiles.every((file) => files.has(file))) raids.push(entry.name);
  }

  return raids.sort();
}

async function extractFragmentBindings(raidId) {
  const bossesDirectory = path.join(raidsRoot, raidId, "bosses");
  let entries;
  try {
    entries = await readdir(bossesDirectory, { withFileTypes: true });
  } catch (error) {
    report(failures, raidId, path.join("raids", raidId, "bosses"), "(directory)", `could not read boss fragments: ${error.message}`);
    return { references: new Map(), allKeys: new Set() };
  }

  const references = new Map(bindingAttributes.map((attribute) => [attribute, []]));
  const allKeys = new Set();
  for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(".html")).sort((a, b) => a.name.localeCompare(b.name))) {
    const relativeFile = path.join("raids", raidId, "bosses", entry.name);
    const html = await readFile(path.join(repoRoot, relativeFile), "utf8");
    for (const attribute of bindingAttributes) {
      const pattern = new RegExp(`\\b${attribute}\\s*=\\s*(["'])\\s*([^"']+?)\\s*\\1`, "g");
      for (const match of html.matchAll(pattern)) {
        const key = match[2];
        references.get(attribute).push({ file: relativeFile, key });
        allKeys.add(key);
      }
    }
  }

  return { references, allKeys };
}

function validateReference(raidId, file, key, validKeys, reason) {
  if (typeof key !== "string" || !validKeys.has(key)) {
    report(failures, raidId, file, String(key), reason);
  }
}

async function validateRaid(raidId) {
  const schema = await readJson(raidId, "roster-schema.json");
  const bindings = await readJson(raidId, "roster-bindings.json");
  if (!schema || !bindings) return;

  const { references, allKeys } = await extractFragmentBindings(raidId);
  const fields = schema.fields ?? {};
  const schemaFields = objectKeys(fields);
  const schemaListFields = new Set(Object.keys(fields).filter((key) => fields[key]?.type === "list"));
  const schemaSingleFields = new Set(Object.keys(fields).filter((key) => fields[key]?.type === "single"));
  const singleDefaults = objectKeys(bindings.singleDefaults);
  const groupDefs = objectKeys(bindings.groupDefs);
  const singleAliases = objectKeys(bindings.singleAliases);
  const groupAliases = objectKeys(bindings.groupAliases);
  const groupTargetAliases = objectKeys(bindings.groupTargetAliases);
  const groupLabels = objectKeys(bindings.groupLabels);
  const indexAliases = objectKeys(bindings.indexAliases);
  const derivedBindings = objectKeys(bindings.derivedBindings);
  const singleValid = new Set([...schemaFields, ...singleDefaults, ...singleAliases, ...groupTargetAliases, ...indexAliases, ...derivedBindings, ...groupDefs]);
  const groupValid = new Set([...schemaListFields, ...groupDefs, ...groupAliases, ...groupLabels]);

  for (const attribute of ["data-bind", "data-target-bind"]) {
    for (const { file, key } of references.get(attribute)) {
      validateReference(raidId, file, key, singleValid, `${attribute} key is missing from the schema and binding config`);
    }
  }
  for (const { file, key } of references.get("data-bind-group")) {
    validateReference(raidId, file, key, groupValid, "data-bind-group key is missing from list schema fields and group binding config");
  }

  const bindingsFile = path.join("raids", raidId, "roster-bindings.json");
  const singleAliasTargets = new Set([...schemaFields, ...groupDefs, ...derivedBindings, ...singleDefaults]);
  for (const [alias, target] of Object.entries(bindings.singleAliases ?? {})) {
    for (const item of values(target)) {
      validateReference(raidId, bindingsFile, item, singleAliasTargets, `singleAliases '${alias}' target does not resolve`);
    }
  }

  const groupTargets = new Set([...schemaListFields, ...groupDefs]);
  for (const section of ["groupAliases", "groupTargetAliases"]) {
    for (const [alias, targets] of Object.entries(bindings[section] ?? {})) {
      for (const target of values(targets)) validateReference(raidId, bindingsFile, target, groupTargets, `${section} '${alias}' target does not resolve to a list field or groupDef`);
    }
  }
  for (const [alias, definition] of Object.entries(bindings.indexAliases ?? {})) {
    validateReference(raidId, bindingsFile, definition?.group, groupTargets, `indexAliases '${alias}' group does not resolve to a list field or groupDef`);
  }

  const derivedKeyTargets = new Set([...schemaSingleFields, ...singleDefaults, ...groupDefs, ...derivedBindings]);
  for (const [name, definition] of Object.entries(bindings.derivedBindings ?? {})) {
    for (const group of [...values(definition?.group).filter(Boolean), ...values(definition?.groups).filter(Boolean)]) {
      validateReference(raidId, bindingsFile, group, groupTargets, `derivedBindings '${name}' group does not resolve to a list field or groupDef`);
    }
    for (const key of values(definition?.keys).filter(Boolean)) {
      validateReference(raidId, bindingsFile, key, derivedKeyTargets, `derivedBindings '${name}' key does not resolve to a single field, singleDefault, groupDef, or derived binding`);
    }
  }

  for (const key of singleDefaults) {
    if (!allKeys.has(key) && !schemaFields.has(key)) report(warnings, raidId, bindingsFile, key, "stale singleDefaults key is not referenced by fragments or schema");
  }
  for (const key of groupLabels) {
    if (!allKeys.has(key) && !schemaFields.has(key)) report(warnings, raidId, bindingsFile, key, "stale groupLabels key is not referenced by fragments or schema");
  }
}

for (const raidId of await discoverRaids()) await validateRaid(raidId);

for (const warning of warnings) {
  console.warn(`WARNING: ${warning.raidId}: ${warning.file}: ${warning.key}: ${warning.reason}`);
}
for (const failure of failures) {
  console.error(`ERROR: ${failure.raidId}: ${failure.file}: ${failure.key}: ${failure.reason}`);
}

if (failures.length > 0) {
  process.exitCode = 1;
} else {
  console.log("Roster binding validation passed.");
}
