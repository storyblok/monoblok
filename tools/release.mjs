#!/usr/bin/env node

import { execSync } from 'child_process';
import { exit, argv, stdin, stdout } from 'process';
import * as readline from 'readline';

const MAIN_BRANCH = 'main';
const RELEASE_BRANCHES = ['main', 'alpha', 'beta', 'next'];

// Parse command line arguments
const args = argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-d');
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

function askConfirmation(question) {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  return new Promise((resolve) => {
    rl.question(`${YELLOW}${question} (y/N): ${RESET}`, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  log('\n🚀 Monoblok Release Script\n', GREEN);

  if (isDryRun) {
    log('🔍 DRY RUN MODE: No changes will be made\n', YELLOW);
  }

  // Check 1: Are we in a git repository?
  try {
    execCommand('git rev-parse --git-dir', { silent: true });
  } catch (error) {
    log('❌ Error: Not a git repository', RED);
    exit(1);
  }

  // Check 2: Are we on a release branch?
  const currentBranch = getCurrentBranch();
  if (!RELEASE_BRANCHES.includes(currentBranch)) {
    log(`❌ Error: You must be on a release branch to release`, RED);
    log(`\nCurrent branch: ${currentBranch}`, YELLOW);
    log(`Allowed branches: ${RELEASE_BRANCHES.join(', ')}`, YELLOW);
    log('\n📋 Instructions:', BLUE);
    log(`  1. Commit or stash your current changes`);
    log(`  2. Switch to a release branch: ${YELLOW}git checkout ${MAIN_BRANCH}${RESET}`);
    log(`  3. Pull the latest changes: ${YELLOW}git pull origin ${MAIN_BRANCH}${RESET}`);
    log(`  4. Run the release script again: ${YELLOW}pnpm release${RESET}\n`);
    exit(1);
  }

  const isPrerelease = currentBranch !== MAIN_BRANCH;
  log(`✅ On ${currentBranch} branch${isPrerelease ? ' (pre-release)' : ''}`, GREEN);

  // Check 3: Do we have uncommitted changes?
  if (hasUncommittedChanges()) {
    log('⚠️  Warning: You have uncommitted changes', YELLOW);
    const proceed = await askConfirmation('Do you want to proceed anyway?');
    if (!proceed) {
      log('\n📋 Instructions:', BLUE);
      log(`  1. Review your changes: ${YELLOW}git status${RESET}`);
      log(`  2. Commit your changes: ${YELLOW}git add . && git commit -m "your message"${RESET}`);
      log(`  3. Or stash them: ${YELLOW}git stash${RESET}`);
      log(`  4. Run the release script again: ${YELLOW}pnpm release${RESET}\n`);
      exit(1);
    }
    log('Proceeding with uncommitted changes...', YELLOW);
  } else {
    log('✅ No uncommitted changes', GREEN);
  }

  // Check 4: Fetch from remote and check if we're up to date
  fetchFromRemote();

  if (!isUpToDateWithRemote(currentBranch)) {
    log(`❌ Error: Your ${currentBranch} branch is not up to date with origin/${currentBranch}`, RED);
    log('\n📋 Instructions:', BLUE);
    log(`  1. Pull the latest changes: ${YELLOW}git pull origin ${currentBranch}${RESET}`);
    log(`  2. Resolve any conflicts if they occur`);
    log(`  3. Run the release script again: ${YELLOW}pnpm release${RESET}\n`);
    exit(1);
  }

  log(`✅ Up to date with origin/${currentBranch}`, GREEN);

  // All checks passed, run the release command
  log('\n✨ All checks passed! Running release command...\n', GREEN);
  log('━'.repeat(50), BLUE);

  try {
    // For pre-release branches, use the branch name as the preid (e.g., alpha, beta, next)
    // This creates versions like 7.4.0-alpha.0 instead of 7.4.0
    const dryRunFlag = isDryRun ? ' --dry-run' : '';
    const preidFlag = isPrerelease ? ` --preid=${currentBranch}` : '';
    const releaseCommand = `pnpm nx release --skip-publish${preidFlag}${dryRunFlag}`;

    log(`Running: ${releaseCommand}\n`, BLUE);
    execCommand(releaseCommand);
    log('\n━'.repeat(50), BLUE);

    if (isDryRun) {
      log('\n✅ Dry run completed successfully!', GREEN);
      log('\nNo changes were made. Run without --dry-run to perform the actual release.\n', YELLOW);
    } else {
      log('\n✅ Release completed successfully!', GREEN);
      log('\n📋 Next steps:', BLUE);
      log('  1. Go to the GitHub Actions tab');
      log('  2. Select the "Publish" workflow');
      log(`  3. Click "Run workflow" and select the ${YELLOW}${currentBranch}${RESET} branch`);
      log(`  4. Click "Run workflow" to publish to npm${isPrerelease ? ` with the ${YELLOW}${currentBranch}${RESET} tag` : ''}\n`);
    }
  } catch (error) {
    log('\n━'.repeat(50), BLUE);
    log('\n❌ Release command failed', RED);
    log('Check the error message above for details\n', YELLOW);
    exit(1);
  }
}

main().catch((error) => {
  log(`\n❌ Unexpected error: ${error.message}`, RED);
  exit(1);
});
