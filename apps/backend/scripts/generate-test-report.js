#!/usr/bin/env node

import { execSync } from 'child_process';
import { unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

// ANSI color codes for parsing
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

// Function to remove ANSI codes
function stripAnsi(str) {
  return str.replace(ANSI_REGEX, '');
}

// Function to run tests and capture output
function runTests(command, type) {
  console.log(`Running ${type} tests...`);
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      env: { ...process.env, CI: 'true' }, // Disable interactive mode
    });
    return output;
  } catch (error) {
    // Tests failed but we still want the output
    return error.stdout || error.output?.join('\n') || '';
  }
}

// Parse Jest output to extract test results
function parseJestOutput(output, type) {
  const lines = output.split('\n').map((line) => stripAnsi(line));
  const testResults = [];
  let currentSuite = null;
  let currentDescribe = null;
  let inFailureDetails = false;
  let currentFailure = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match test suite
    if (line.includes('PASS') || line.includes('FAIL')) {
      const match = line.match(/(PASS|FAIL)\s+(.+?)(?:\s+\([\d.]+\s*s?\))?$/);
      if (match) {
        currentSuite = {
          status: match[1],
          file: match[2].trim(),
          tests: [],
        };
        testResults.push(currentSuite);
      }
    }

    // Match describe blocks
    if (line.match(/^\s+\w+.*$/) && !line.match(/^\s+[✓✕●]/) && currentSuite) {
      currentDescribe = line.trim();
    }

    // Match individual tests
    const testMatch = line.match(/^\s+([✓✕●])\s+(.+?)(?:\s+\((\d+)\s*ms\))?$/);
    if (testMatch && currentSuite) {
      const status = testMatch[1] === '✓' ? 'PASS' : testMatch[1] === '✕' ? 'FAIL' : 'SKIP';
      const testName = testMatch[2].trim();
      const duration = testMatch[3] || '0';

      currentSuite.tests.push({
        describe: currentDescribe,
        name: testName,
        status: status,
        duration: duration,
        error: null,
      });

      if (status === 'FAIL') {
        currentFailure = currentSuite.tests[currentSuite.tests.length - 1];
      }
    }

    // Capture error details
    if (line.includes('● ') && line.includes(' › ')) {
      inFailureDetails = true;
      const parts = line.split(' › ');
      if (parts.length >= 2) {
        const testName = parts[parts.length - 1].trim();
        // Find the test that matches this failure
        if (currentSuite) {
          currentFailure = currentSuite.tests.find((t) => t.name === testName);
        }
      }
    }

    // Capture error message
    if (inFailureDetails && currentFailure && line.trim() && !line.includes('●')) {
      if (!currentFailure.error) {
        currentFailure.error = '';
      }

      // Skip stack trace lines
      if (!line.includes('at ') && !line.match(/^\s+\d+\s*\|/)) {
        currentFailure.error += line.trim() + '\n';
      }

      // End of error details
      if (line.includes('at Object.')) {
        inFailureDetails = false;
        currentFailure = null;
      }
    }
  }

  // Extract summary
  const summaryMatch = output.match(
    /Test Suites:\s*(\d+)\s*failed,\s*(\d+)\s*passed,\s*(\d+)\s*total/,
  );
  const testSummaryMatch = output.match(
    /Tests:\s*(\d+)\s*failed,\s*(\d+)\s*passed,\s*(\d+)\s*total/,
  );

  return {
    type,
    suites: testResults,
    summary: {
      suites: summaryMatch
        ? {
            failed: parseInt(summaryMatch[1]),
            passed: parseInt(summaryMatch[2]),
            total: parseInt(summaryMatch[3]),
          }
        : null,
      tests: testSummaryMatch
        ? {
            failed: parseInt(testSummaryMatch[1]),
            passed: parseInt(testSummaryMatch[2]),
            total: parseInt(testSummaryMatch[3]),
          }
        : null,
    },
  };
}

// Generate markdown report
function generateMarkdown(unitResults, e2eResults) {
  const timestamp = new Date().toISOString();
  let markdown = `# Test Coverage Report

**Generated:** ${timestamp}

## Summary

### Unit Tests
- **Total Tests:** ${unitResults.summary.tests?.total || 0}
- **Passed:** ${unitResults.summary.tests?.passed || 0} ✅
- **Failed:** ${unitResults.summary.tests?.failed || 0} ❌
- **Coverage:** ${(((unitResults.summary.tests?.passed || 0) / (unitResults.summary.tests?.total || 1)) * 100).toFixed(1)}%

### E2E Tests
- **Total Tests:** ${e2eResults.summary.tests?.total || 0}
- **Passed:** ${e2eResults.summary.tests?.passed || 0} ✅
- **Failed:** ${e2eResults.summary.tests?.failed || 0} ❌
- **Coverage:** ${(((e2eResults.summary.tests?.passed || 0) / (e2eResults.summary.tests?.total || 1)) * 100).toFixed(1)}%

### Overall
- **Total Tests:** ${(unitResults.summary.tests?.total || 0) + (e2eResults.summary.tests?.total || 0)}
- **Total Passed:** ${(unitResults.summary.tests?.passed || 0) + (e2eResults.summary.tests?.passed || 0)} ✅
- **Total Failed:** ${(unitResults.summary.tests?.failed || 0) + (e2eResults.summary.tests?.failed || 0)} ❌

---

## Unit Test Details

`;

  // Group tests by module
  const unitModules = {};
  unitResults.suites.forEach((suite) => {
    const moduleName = suite.file.split('/')[0] || 'root';
    if (!unitModules[moduleName]) {
      unitModules[moduleName] = [];
    }
    unitModules[moduleName].push(suite);
  });

  // Generate unit test details
  Object.keys(unitModules)
    .sort()
    .forEach((module) => {
      markdown += `### ${module} module\n\n`;

      unitModules[module].forEach((suite) => {
        const fileName = suite.file.split('/').pop();
        const passed = suite.tests.filter((t) => t.status === 'PASS').length;
        const failed = suite.tests.filter((t) => t.status === 'FAIL').length;
        const skipped = suite.tests.filter((t) => t.status === 'SKIP').length;

        markdown += `#### ${fileName} ${suite.status === 'PASS' ? '✅' : '❌'}\n`;
        markdown += `- **Passed:** ${passed} | **Failed:** ${failed} | **Skipped:** ${skipped}\n\n`;

        if (suite.tests.length > 0) {
          markdown += '| Test | Status | Feature/Function | Failure Reason |\n';
          markdown += '|------|--------|------------------|----------------|\n';

          suite.tests.forEach((test) => {
            const status = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '⏭️';
            const testPath = test.describe ? `${test.describe} › ${test.name}` : test.name;
            const feature = extractFeature(testPath, suite.file);
            const reason = test.error ? test.error.trim().split('\n')[0] : '-';

            markdown += `| ${testPath} | ${status} | ${feature} | ${reason} |\n`;
          });
          markdown += '\n';
        }
      });
    });

  markdown += `## E2E Test Details\n\n`;

  // Generate E2E test details
  e2eResults.suites.forEach((suite) => {
    const fileName = suite.file.split('/').pop();
    const passed = suite.tests.filter((t) => t.status === 'PASS').length;
    const failed = suite.tests.filter((t) => t.status === 'FAIL').length;
    const skipped = suite.tests.filter((t) => t.status === 'SKIP').length;

    markdown += `### ${fileName} ${suite.status === 'PASS' ? '✅' : '❌'}\n`;
    markdown += `- **Passed:** ${passed} | **Failed:** ${failed} | **Skipped:** ${skipped}\n\n`;

    if (suite.tests.length > 0) {
      markdown += '| Test | Status | Endpoint/Feature | Failure Reason |\n';
      markdown += '|------|--------|------------------|----------------|\n';

      suite.tests.forEach((test) => {
        const status = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '⏭️';
        const testPath = test.describe ? `${test.describe} › ${test.name}` : test.name;
        const feature = extractE2EFeature(testPath, suite.file);
        const reason = test.error ? test.error.trim().split('\n')[0] : '-';

        markdown += `| ${testPath} | ${status} | ${feature} | ${reason} |\n`;
      });
      markdown += '\n';
    }
  });

  markdown += `## Failed Tests Analysis\n\n`;

  // Analyze failures
  const allFailures = [];

  unitResults.suites.forEach((suite) => {
    suite.tests
      .filter((t) => t.status === 'FAIL')
      .forEach((test) => {
        allFailures.push({
          type: 'Unit',
          file: suite.file,
          test: test.describe ? `${test.describe} › ${test.name}` : test.name,
          error: test.error,
        });
      });
  });

  e2eResults.suites.forEach((suite) => {
    suite.tests
      .filter((t) => t.status === 'FAIL')
      .forEach((test) => {
        allFailures.push({
          type: 'E2E',
          file: suite.file,
          test: test.describe ? `${test.describe} › ${test.name}` : test.name,
          error: test.error,
        });
      });
  });

  if (allFailures.length > 0) {
    markdown += '### Common Failure Patterns\n\n';

    // Group failures by error type
    const failurePatterns = {};
    allFailures.forEach((failure) => {
      const errorType = categorizeError(failure.error);
      if (!failurePatterns[errorType]) {
        failurePatterns[errorType] = [];
      }
      failurePatterns[errorType].push(failure);
    });

    Object.keys(failurePatterns).forEach((pattern) => {
      markdown += `#### ${pattern} (${failurePatterns[pattern].length} failures)\n`;
      failurePatterns[pattern].slice(0, 3).forEach((failure) => {
        markdown += `- **${failure.type}** - ${failure.file}: ${failure.test}\n`;
      });
      if (failurePatterns[pattern].length > 3) {
        markdown += `- ...and ${failurePatterns[pattern].length - 3} more\n`;
      }
      markdown += '\n';
    });
  }

  return markdown;
}

// Helper function to extract feature from test name
function extractFeature(testName, fileName) {
  // Common patterns
  if (testName.includes('should create')) return 'Creation/Initialization';
  if (testName.includes('should return')) return 'Data Retrieval';
  if (testName.includes('should update')) return 'Update Operations';
  if (testName.includes('should delete')) return 'Delete Operations';
  if (testName.includes('should throw') || testName.includes('should fail'))
    return 'Error Handling';
  if (testName.includes('should validate')) return 'Validation';
  if (testName.includes('authentication') || testName.includes('auth')) return 'Authentication';
  if (testName.includes('authorization')) return 'Authorization';
  if (testName.includes('balance')) return 'Balance Management';
  if (testName.includes('transaction')) return 'Transaction Processing';
  if (testName.includes('wallet')) return 'Wallet Operations';
  if (testName.includes('game')) return 'Game Logic';

  // File-specific patterns
  if (fileName.includes('auth')) return 'Authentication Service';
  if (fileName.includes('balance')) return 'Balance Service';
  if (fileName.includes('payments')) return 'Payment Service';
  if (fileName.includes('users')) return 'User Management';
  if (fileName.includes('games')) return 'Game Service';

  return 'General Functionality';
}

// Helper function to extract E2E feature
function extractE2EFeature(testName) {
  // Extract endpoint if present
  // eslint-disable-next-line
  const endpointMatch = testName.match(/\/v\d\/[\w\/-]+/);
  if (endpointMatch) {
    return endpointMatch[0];
  }

  // Common E2E patterns
  if (testName.includes('GET')) return 'GET Endpoint';
  if (testName.includes('POST')) return 'POST Endpoint';
  if (testName.includes('PATCH')) return 'PATCH Endpoint';
  if (testName.includes('DELETE')) return 'DELETE Endpoint';
  if (testName.includes('authentication')) return 'Authentication Flow';
  if (testName.includes('authorization')) return 'Authorization Check';

  return 'API Endpoint';
}

// Helper function to categorize errors
function categorizeError(error) {
  if (!error) return 'Unknown Error';

  const errorLower = error.toLowerCase();

  if (errorLower.includes('expected') && errorLower.includes('received'))
    return 'Assertion Failure';
  if (errorLower.includes('cannot read property') || errorLower.includes('undefined'))
    return 'Null/Undefined Error';
  if (errorLower.includes('timeout')) return 'Timeout Error';
  if (errorLower.includes('connection') || errorLower.includes('econnrefused'))
    return 'Connection Error';
  if (errorLower.includes('not found')) return 'Not Found Error';
  if (errorLower.includes('unauthorized') || errorLower.includes('401'))
    return 'Authorization Error';
  if (errorLower.includes('bad request') || errorLower.includes('400')) return 'Validation Error';
  if (errorLower.includes('type') || errorLower.includes('cast')) return 'Type Error';
  if (errorLower.includes('database') || errorLower.includes('sql')) return 'Database Error';

  return 'Other Error';
}

// Main execution
function main() {
  console.log('Generating test coverage report...\n');

  // Run unit tests
  const unitOutput = runTests('npm test -- --verbose --no-coverage 2>&1', 'unit');

  // Run E2E tests
  const e2eOutput = runTests('npm run test:e2e -- --verbose 2>&1', 'e2e');

  // Parse results
  const unitResults = parseJestOutput(unitOutput, 'Unit');
  const e2eResults = parseJestOutput(e2eOutput, 'E2E');

  // Generate markdown
  const markdown = generateMarkdown(unitResults, e2eResults);

  // Write to file
  const reportPath = join(__dirname, '..', '..', '..', 'TEST_COVERAGE.md');
  writeFileSync(reportPath, markdown);

  console.log(`\n✅ Test coverage report generated: ${reportPath}`);
  console.log(`\nSummary:`);
  console.log(
    `- Unit Tests: ${unitResults.summary.tests?.passed || 0}/${unitResults.summary.tests?.total || 0} passed`,
  );
  console.log(
    `- E2E Tests: ${e2eResults.summary.tests?.passed || 0}/${e2eResults.summary.tests?.total || 0} passed`,
  );

  // Clean up temporary JSON files
  try {
    unlinkSync('test-results-unit.json');
    unlinkSync('test-results-e2e.json');
  } catch {
    // Ignore cleanup errors
  }
}

// Run the script
main().catch(console.error);
