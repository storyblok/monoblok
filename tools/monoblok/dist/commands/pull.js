"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pullCommand = pullCommand;
const chalk_1 = __importDefault(require("chalk"));
const utils = __importStar(require("../utils"));
function pullCommand(program) {
    program
        .command('pull')
        .description('Pull updates for subtrees')
        .argument('[package]', 'Package name pattern to pull (omit to pull all)')
        .option('-f, --force', 'Force pull even if there are local changes', false)
        .action(async (packageName, options) => {
        try {
            // Read the manifest
            const manifest = utils.readManifest();
            // Filter the manifest if a package name is provided
            const filteredManifest = utils.filterManifestByPackage(manifest, packageName);
            // Validate that we have entries to process
            utils.validateFilteredManifest(filteredManifest, packageName);
            // Process each package
            for (const [name, entry] of Object.entries(filteredManifest)) {
                console.log(chalk_1.default.blue(`\nPulling updates for ${chalk_1.default.bold(name)}...`));
                // Get normalized name for Git remote
                const remoteName = utils.normalizePackageName(name);
                // Check if remote exists
                if (!(await utils.remoteExists(remoteName))) {
                    console.log(chalk_1.default.yellow(`  Remote '${remoteName}' does not exist, skipping...`));
                    continue;
                }
                // Fetch the latest from remote
                await utils.runWithSpinner(`Fetching latest from ${remoteName}`, async () => {
                    await utils.execGit(['fetch', remoteName]);
                });
                // Pull the subtree
                try {
                    const pullArgs = [
                        'subtree',
                        'pull',
                        `--prefix=${entry.path}`,
                        remoteName,
                        entry.branch
                    ];
                    // Add --force if specified
                    if (options?.force) {
                        pullArgs.push('--force');
                    }
                    await utils.runWithSpinner(`Pulling subtree for ${name}`, async () => {
                        await utils.execGit(pullArgs);
                    });
                }
                catch (error) {
                    // If the pull has a conflict, we need to resolve it manually
                    if (error.message.includes('CONFLICT')) {
                        console.error(chalk_1.default.red(`  Failed to pull subtree: ${error.message}`));
                        console.error(chalk_1.default.red(`  Please resolve the conflict manually and try again.`));
                        process.exit(1);
                    }
                    console.error(chalk_1.default.red(`  Failed to pull subtree: ${error.message}`));
                    process.exit(1);
                }
            }
            console.log(chalk_1.default.green('\nAll subtrees have been updated successfully!'));
        }
        catch (error) {
            console.error(chalk_1.default.red(`\nError: ${error.message}`));
            process.exit(1);
        }
    });
}
