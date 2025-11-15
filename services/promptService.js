const fs = require('fs');
const yaml = require('js-yaml');
const { PROMPT_FILE } = require('../config');

let cachedConfig;

function loadPromptConfig() {
  if (!cachedConfig) {
    const raw = fs.readFileSync(PROMPT_FILE, 'utf-8');
    cachedConfig = yaml.load(raw);
  }
  return cachedConfig;
}

function buildPrompt(variables = {}) {
  const config = loadPromptConfig();
  const template = config?.template || '';
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
    const value = variables[key];
    return value == null ? '' : String(value);
  });
}

module.exports = {
  buildPrompt
};
