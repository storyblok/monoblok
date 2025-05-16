"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMonorepoRoot = getMonorepoRoot;
exports.readManifest = readManifest;
exports.normalizePackageName = normalizePackageName;
exports.execGit = execGit;
exports.remoteExists = remoteExists;
exports.runWithSpinner = runWithSpinner;
exports.filterManifestByPackage = filterManifestByPackage;
exports.validateFilteredManifest = validateFilteredManifest;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const execa_1 = __importDefault(require("execa"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
// Get root directory of the monorepo
function getMonorepoRoot() {
    return process.cwd();
}
// Read and parse the manifest file
function readManifest() {
    const manifestPath = path_1.default.join(getMonorepoRoot(), 'repo-manifest.json');
    if (!fs_1.default.existsSync(manifestPath)) {
        throw new Error(`Manifest file not found at ${manifestPath}`);
    }
    try {
        const manifestContent = fs_1.default.readFileSync(manifestPath, 'utf8');
        return JSON.parse(manifestContent);
    }
    catch (error) {
        throw new Error(`Failed to parse manifest file: ${error.message}`);
    }
}
// Normalize package name for use as remote name
function normalizePackageName(packageName) {
    return packageName.replace(/@/g, '').replace(/\//g, '-').replace(/\./g, '-');
}
// Execute a git command with proper error handling
async function execGit(args, options = {}) {
    try {
        const { stdout } = await (0, execa_1.default)('git', args, {
            cwd: options.cwd || getMonorepoRoot(),
        });
        return stdout;
    }
    catch (error) {
        throw new Error(`Git command failed: ${error.message || 'Unknown error'}`);
    }
}
// Check if a git remote exists
async function remoteExists(remoteName) {
    try {
        const remotes = await execGit(['remote']);
        return remotes.split('\n').includes(remoteName);
    }
    catch (error) {
        return false;
    }
}
// Run a command with a loading spinner
async function runWithSpinner(message, fn) {
    const spinner = (0, ora_1.default)(message).start();
    try {
        const result = await fn();
        spinner.succeed(chalk_1.default.green(`${message} - done`));
        return result;
    }
    catch (error) {
        spinner.fail(chalk_1.default.red(`${message} - failed`));
        throw error;
    }
}
// Filter manifest entries by a package name pattern
function filterManifestByPackage(manifest, packageName) {
    if (!packageName) {
        return manifest;
    }
    const result = {};
    Object.entries(manifest).forEach(([name, entry]) => {
        if (name.includes(packageName)) {
            result[name] = entry;
        }
    });
    return result;
}
// Validate if a filtered manifest has any entries
function validateFilteredManifest(filteredManifest, packageName) {
    if (Object.keys(filteredManifest).length === 0) {
        if (packageName) {
            throw new Error(`No packages matching "${packageName}" found in manifest`);
        }
        else {
            throw new Error('Manifest is empty');
        }
    }
}
