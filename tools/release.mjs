#!/usr/bin/env node

import { execSync } from 'child_process';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { exit, argv, stdin, stdout } from 'process';
import * as readline from 'readline';

import { getBranchEligiblePackages } from './release-branches.mjs';

const MAIN_BRANCH = 'main';
const RELEASE_BRANCHES = ['main', 'alpha', 'beta', 'next'];

// Parse command line arguments
const args = argv.slice(2);
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
    execCommand('git fetch origin --tags --force');
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

let versionArg = null;
let projectsArg = null;
let firstRelease = false;
let isDryRun = false;
const filteredArgs = [];

const isVersion = (value) => /^\d+\.\d+\.\d+/.test(value);

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--dry-run' || arg === '-d') {
    isDryRun = true;
    continue;
  }

  if (arg === '--first-release') {
    firstRelease = true;
    continue;
  }

  if (arg === '--version') {
    const next = args[i + 1];
    if (next && isVersion(next)) {
      versionArg = next;
      i++;
      continue;
    }
  }

  if (arg.startsWith('--version=')) {
    versionArg = arg.slice('--version='.length);
    continue;
  }

  if (arg.startsWith('--projects=')) {
    projectsArg = arg.slice('--projects='.length);
    continue;
  }

  filteredArgs.push(arg);
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

  // Filter packages by their `release.branches` config.
  const { eligible, excluded } = getBranchEligiblePackages(currentBranch);

  if (excluded.length > 0) {
    log(`\n⏭️  Skipping packages not configured to release from ${currentBranch}:`, YELLOW);
    for (const name of excluded) log(`   - ${name}`, YELLOW);
  }

  // Snapshot the on-disk `version` of each excluded package so we can detect
  // if `nx release` bumps one of them. See the abort check after the release
  // command below — this prevents the regression that produced commit
  // f824b398e and the subsequent ETARGET failures for downstream consumers.
  const baseSha = execCommand('git rev-parse HEAD', { silent: true });
  const excludedSnapshot = snapshotPackageVersions(excluded);

  let effectiveProjects;
  if (projectsArg) {
    const requested = projectsArg.split(',').map(s => s.trim()).filter(Boolean);
    const droppedByBranch = requested.filter(p => excluded.includes(p));
    const kept = requested.filter(p => !excluded.includes(p));

    if (droppedByBranch.length > 0) {
      log(`\n⚠️  Removing requested projects not eligible on ${currentBranch}: ${droppedByBranch.join(', ')}`, YELLOW);
    }
    if (kept.length === 0) {
      log(`\n❌ Error: None of the requested projects are configured to release from ${currentBranch}`, RED);
      log('\n📋 Instructions:', BLUE);
      log(`  1. Check each package's ${YELLOW}release.branches${RESET} in its package.json`);
      log(`  2. Switch to a branch the project(s) support, or add ${YELLOW}${currentBranch}${RESET} to their ${YELLOW}release.branches${RESET}\n`);
      exit(1);
    }
    effectiveProjects = kept.join(',');
  } else {
    if (eligible.length === 0) {
      log(`\n❌ Error: No packages are configured to release from ${currentBranch}`, RED);
      exit(1);
    }
    effectiveProjects = eligible.join(',');
  }

  // All checks passed, run the release command
  log('\n✨ All checks passed! Running release command...\n', GREEN);
  log('━'.repeat(50), BLUE);

  try {
    // Build release command with correct version position
    let releaseCommand = 'pnpm nx release';
    if (versionArg) releaseCommand += ` ${versionArg}`;
    releaseCommand += ' --skip-publish';
    if (isPrerelease) releaseCommand += ` --preid=${currentBranch}`;
    releaseCommand += ` --projects=${effectiveProjects}`;
    if (firstRelease) releaseCommand += ' --first-release';
    if (isDryRun) releaseCommand += ' --dry-run';

    log(`Running: ${releaseCommand}\n`, BLUE);
    execCommand(releaseCommand);
    log('\n━'.repeat(50), BLUE);

    if (isDryRun) {
      log('\n✅ Dry run completed successfully!', GREEN);
      log('\nNo changes were made. Run without --dry-run to perform the actual release.\n', YELLOW);
    } else {
      const mutated = detectMutatedVersions(excludedSnapshot);
      if (mutated.length > 0) {
        log('\n❌ Release aborted: nx release bumped package(s) that will not be', RED);
        log(`   published on ${currentBranch} (release.branches excludes it):`, RED);
        for (const { name, oldVersion, newVersion } of mutated) {
          log(`   - ${name}: ${oldVersion} -> ${newVersion}`, RED);
        }
        log('\nPushing this release would publish downstream packages with', YELLOW);
        log('unresolvable dependency references (see RELEASING.md for the', YELLOW);
        log('original incident — commit f824b398e).', YELLOW);
        log('\nRecover with:', BLUE);
        log(`   git reset --hard ${baseSha}`, YELLOW);
        log(`   for t in $(git tag --points-at HEAD); do git tag -d "$t"; done`, YELLOW);
        log('\nThen either run from a branch the package(s) allow, or revert', BLUE);
        log('the conventional-commit changes that are driving the bump.\n', BLUE);
        exit(1);
      }

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

/**
 * Reads the current on-disk `version` for each package name in `names`.
 * Returns a map of `name -> { path, version }` for packages that exist under
 * `packages/`. Packages not found are silently skipped (they may live
 * elsewhere in the workspace, which this guard does not try to cover).
 */
function snapshotPackageVersions(names, packagesDir = 'packages') {
  if (!names || names.length === 0) return new Map();
  const wanted = new Set(names);
  const snapshot = new Map();
  for (const entry of readdirSync(packagesDir)) {
    const pkgPath = join(packagesDir, entry, 'package.json');
    let stat;
    try { stat = statSync(pkgPath); } catch { continue; }
    if (!stat.isFile()) continue;
    let pkg;
    try { pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')); } catch { continue; }
    if (!pkg.name || !wanted.has(pkg.name)) continue;
    snapshot.set(pkg.name, { path: pkgPath, version: pkg.version });
  }
  return snapshot;
}

/**
 * Compares current on-disk `version` values against the snapshot taken before
 * `nx release` ran. Returns the list of packages whose version changed.
 */
function detectMutatedVersions(snapshot) {
  const mutated = [];
  for (const [name, { path, version: oldVersion }] of snapshot) {
    let pkg;
    try { pkg = JSON.parse(readFileSync(path, 'utf-8')); } catch { continue; }
    if (pkg.version !== oldVersion) {
      mutated.push({ name, oldVersion, newVersion: pkg.version });
    }
  }
  return mutated;
}

main().catch((error) => {
  log(`\n❌ Unexpected error: ${error.message}`, RED);
  exit(1);
});
