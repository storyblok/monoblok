#!/usr/bin/env node

import { execSync } from 'child_process';
import { exit } from 'process';

const MAIN_BRANCH = 'main';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function execCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });

    return result ? result.trim() : '';
  } catch (error) {
    if (options.ignoreError) {
      return null;
    }
    throw error;
  }
}

function getCurrentBranch() {
  return execCommand('git rev-parse --abbrev-ref HEAD', { silent: true });
}

function hasUncommittedChanges() {
  const status = execCommand('git status --porcelain', { silent: true });
  return status.length > 0;
}

function fetchFromRemote() {
  log('\n📡 Fetching latest changes from remote...', BLUE);
  try {
    execCommand('git fetch origin');
    return true;
  } catch (error) {
    log('⚠️  Warning: Failed to fetch from remote', YELLOW);
    return false;
  }
}

function isUpToDateWithRemote(branch) {
  try {
    const localCommit = execCommand(`git rev-parse ${branch}`, { silent: true });
    const remoteCommit = execCommand(`git rev-parse origin/${branch}`, { silent: true, ignoreError: true });

    if (!remoteCommit) {
      log(`⚠️  Warning: Could not find remote branch origin/${branch}`, YELLOW);
      return true; // Assume up to date if remote branch doesn't exist
    }

    return localCommit === remoteCommit;
  } catch (error) {
    log('⚠️  Warning: Could not verify if branch is up to date with remote', YELLOW);
    return true; // Assume up to date if we can't verify
  }
}

function main() {
  log('\n🚀 Monoblok Release Script\n', GREEN);

  // Check 1: Are we in a git repository?
  try {
    execCommand('git rev-parse --git-dir', { silent: true });
  } catch (error) {
    log('❌ Error: Not a git repository', RED);
    exit(1);
  }

  // Check 2: Are we on the main branch?
  const currentBranch = getCurrentBranch();
  if (currentBranch !== MAIN_BRANCH) {
    log(`❌ Error: You must be on the '${MAIN_BRANCH}' branch to release`, RED);
    log(`\nCurrent branch: ${currentBranch}`, YELLOW);
    log('\n📋 Instructions:', BLUE);
    log(`  1. Commit or stash your current changes`);
    log(`  2. Switch to the ${MAIN_BRANCH} branch: ${YELLOW}git checkout ${MAIN_BRANCH}${RESET}`);
    log(`  3. Pull the latest changes: ${YELLOW}git pull origin ${MAIN_BRANCH}${RESET}`);
    log(`  4. Run the release script again: ${YELLOW}pnpm release${RESET}\n`);
    exit(1);
  }

  log(`✅ On ${MAIN_BRANCH} branch`, GREEN);

  // Check 3: Do we have uncommitted changes?
  if (hasUncommittedChanges()) {
    log('❌ Error: You have uncommitted changes', RED);
    log('\n📋 Instructions:', BLUE);
    log(`  1. Review your changes: ${YELLOW}git status${RESET}`);
    log(`  2. Commit your changes: ${YELLOW}git add . && git commit -m "your message"${RESET}`);
    log(`  3. Or stash them: ${YELLOW}git stash${RESET}`);
    log(`  4. Run the release script again: ${YELLOW}pnpm release${RESET}\n`);
    exit(1);
  }

  log('✅ No uncommitted changes', GREEN);

  // Check 4: Fetch from remote and check if we're up to date
  fetchFromRemote();

  if (!isUpToDateWithRemote(MAIN_BRANCH)) {
    log(`❌ Error: Your ${MAIN_BRANCH} branch is not up to date with origin/${MAIN_BRANCH}`, RED);
    log('\n📋 Instructions:', BLUE);
    log(`  1. Pull the latest changes: ${YELLOW}git pull origin ${MAIN_BRANCH}${RESET}`);
    log(`  2. Resolve any conflicts if they occur`);
    log(`  3. Run the release script again: ${YELLOW}pnpm release${RESET}\n`);
    exit(1);
  }

  log(`✅ Up to date with origin/${MAIN_BRANCH}`, GREEN);

  // All checks passed, run the release command
  log('\n✨ All checks passed! Running release command...\n', GREEN);
  log('━'.repeat(50), BLUE);

  try {
    execCommand('pnpm nx release --skip-publish');
    log('\n━'.repeat(50), BLUE);
    log('\n✅ Release completed successfully!', GREEN);
    log('\n📋 Next steps:', BLUE);
    log('  1. Go to the GitHub Actions tab');
    log('  2. Select the "Publish" workflow');
    log('  3. Click "Run workflow" and select the main branch');
    log('  4. Click "Run workflow" to publish to npm\n');
  } catch (error) {
    log('\n━'.repeat(50), BLUE);
    log('\n❌ Release command failed', RED);
    log('Check the error message above for details\n', YELLOW);
    exit(1);
  }
}

main();
