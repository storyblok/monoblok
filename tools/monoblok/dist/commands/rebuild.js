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
exports.rebuildCommand = rebuildCommand;
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const inquirer_1 = __importDefault(require("inquirer"));
const utils = __importStar(require("../utils"));
function rebuildCommand(program) {
    program
        .command('rebuild')
        .description('Rebuild (remove and re-add) a subtree')
        .argument('<package>', 'Package name to rebuild')
        .option('-y, --yes', 'Automatically answer yes to all prompts', false)
        .action(async (packageName, options) => {
        try {
            // Read the manifest
            const manifest = utils.readManifest();
            // Filter the manifest for the specific package
            const filteredManifest = utils.filterManifestByPackage(manifest, packageName);
            // Validate that we have an entry to process
            utils.validateFilteredManifest(filteredManifest, packageName);
            // If more than one package matches, prompt user to select one
            let selectedEntry;
            const entries = Object.entries(filteredManifest);
            if (entries.length > 1) {
                if (!options?.yes) {
                    const { selection } = await inquirer_1.default.prompt([{
                            type: 'list',
                            name: 'selection',
                            message: 'Multiple packages match. Select the one to rebuild:',
                            choices: entries.map(([name]) => name)
                        }]);
                    selectedEntry = [selection, filteredManifest[selection]];
                }
                else {
                    // If auto-yes, take the first match
                    selectedEntry = entries[0];
                    console.log(chalk_1.default.yellow(`Multiple packages match, automatically selected: ${selectedEntry[0]}`));
                }
            }
            else {
                selectedEntry = entries[0];
            }
            const [name, entry] = selectedEntry;
            const remoteDir = entry.path;
            // Confirm before deletion
            if (!options?.yes) {
                const { confirm } = await inquirer_1.default.prompt([{
                        type: 'confirm',
                        name: 'confirm',
                        message: chalk_1.default.red(`Are you sure you want to rebuild ${name}? This will DELETE and re-add ${remoteDir}`),
                        default: false
                    }]);
                if (!confirm) {
                    console.log('Rebuild cancelled.');
                    return;
                }
            }
            console.log(chalk_1.default.blue(`\nRebuilding ${chalk_1.default.bold(name)}...`));
            // Get normalized name for Git remote
            const remoteName = utils.normalizePackageName(name);
            // Form the GitHub URL
            const repoUrl = `https://github.com/${entry.repo}.git`;
            // Check if the directory exists
            const dirPath = path_1.default.join(utils.getMonorepoRoot(), remoteDir);
            if (fs_1.default.existsSync(dirPath)) {
                // Remove the directory
                await utils.runWithSpinner(`Removing directory ${remoteDir}`, async () => {
                    // Using rimraf-like approach with git
                    await utils.execGit(['rm', '-rf', remoteDir]);
                    // Commit the removal
                    await utils.execGit(['commit', '-m', `Remove ${name} for rebuild`]);
                    await fs_1.default.promises.rm(remoteDir, { recursive: true, force: true });
                });
            }
            // Add the remote if it doesn't exist
            if (!(await utils.remoteExists(remoteName))) {
                await utils.runWithSpinner(`Adding remote '${remoteName}'`, async () => {
                    await utils.execGit(['remote', 'add', remoteName, repoUrl]);
                });
            }
            // Add the subtree
            await utils.runWithSpinner(`Re-adding subtree for ${name}`, async () => {
                await utils.execGit([
                    'subtree',
                    'add',
                    `--prefix=${entry.path}`,
                    remoteName,
                    entry.branch
                ]);
            });
            console.log(chalk_1.default.green(`\nSuccessfully rebuilt ${name}!`));
        }
        catch (error) {
            console.error(chalk_1.default.red(`\nError: ${error.message}`));
            process.exit(1);
        }
    });
}
