#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Check for Russian characters in code files and markdown files
 * This script is used in pre-commit hooks to prevent Russian comments
 */

// Get staged files
let stagedFiles;
try {
  stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
    .split('\n')
    .filter((file) => file.trim() !== '');
} catch (error) {
  console.error('Error getting staged files:', error.message);
  process.exit(1);
}

// Filter for relevant file types
const relevantFiles = stagedFiles.filter((file) => {
  const ext = path.extname(file);
  return (
    ['.ts', '.js', '.tsx', '.jsx', '.md'].includes(ext) &&
    !file.includes('node_modules') &&
    !file.includes('dist') &&
    !file.includes('.temp/') &&
    !file.includes('etc/k6-load-test/') &&
    !file.includes('frontend/admin-panel/')
  );
});

if (relevantFiles.length === 0) {
  console.log('✅ No relevant files to check');
  process.exit(0);
}

let hasRussianContent = false;
const russianPattern = /[а-яёА-ЯЁ]/;

for (const file of relevantFiles) {
  if (!fs.existsSync(file)) {
    continue; // File might be deleted
  }

  try {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for Russian characters in comments and strings
      if (russianPattern.test(line)) {
        // Skip if it's in a string literal (basic check)
        const trimmed = line.trim();
        if (
          trimmed.startsWith('//') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('/*') ||
          (file.endsWith('.md') && !trimmed.startsWith('```'))
        ) {
          console.error(`❌ Russian text found in ${file}:${i + 1}`);
          console.error(`   ${line.trim()}`);
          hasRussianContent = true;
        }
      }
    }
  } catch (error) {
    console.error(`Error reading file ${file}:`, error.message);
  }
}

if (hasRussianContent) {
  console.error('\n❌ Commit rejected: Russian characters found in comments or markdown');
  console.error('Please translate all comments to English before committing.');
  process.exit(1);
}

console.log('✅ No Russian characters found in comments');
process.exit(0);
