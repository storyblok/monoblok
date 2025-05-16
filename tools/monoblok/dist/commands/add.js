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
exports.addCommand = addCommand;
const chalk_1 = __importDefault(require("chalk"));
const utils = __importStar(require("../utils"));
const node_fs_1 = __importDefault(require("node:fs"));
function addCommand(program) {
    program
        .command('add')
        .description('Add subtrees from the manifest')
        .argument('[package]', 'Package name pattern to add (omit to add all)')
        .action(async (packageName) => {
        try {
            // Read the manifest
            const manifest = utils.readManifest();
            // Filter the manifest if a package name is provided
            const filteredManifest = utils.filterManifestByPackage(manifest, packageName);
            // Validate that we have entries to process
            utils.validateFilteredManifest(filteredManifest, packageName);
            // Process each package
            for (const [name, entry] of Object.entries(filteredManifest)) {
                console.log(chalk_1.default.blue(`\nProcessing ${chalk_1.default.bold(name)}...`));
                // Get normalized name for Git remote
                const remoteName = utils.normalizePackageName(name);
                // Form the GitHub URL
                const repoUrl = `https://github.com/${entry.repo}.git`;
                // Add or update the remote
                await utils.runWithSpinner(`Adding/updating remote '${remoteName}'`, async () => {
                    if (await utils.remoteExists(remoteName)) {
                        await utils.execGit(['remote', 'set-url', remoteName, repoUrl]);
                    }
                    else {
                        await utils.execGit(['remote', 'add', remoteName, repoUrl]);
                    }
                });
                // Add the subtree
                try {
                    await utils.runWithSpinner(`Adding subtree for ${name}`, async () => {
                        // Check if the directory already exists
                        if (node_fs_1.default.existsSync(entry.path)) {
                            console.log(chalk_1.default.yellow(`  Directory ${entry.path} already exists, skipping...`));
                            return;
                        }
                        await utils.execGit([
                            'subtree',
                            'add',
                            `--prefix=${entry.path}`,
                            repoUrl,
                            entry.branch
                        ]);
                    });
                }
                catch (error) {
                    // Check if the directory already exists
                    if (error.message.includes('already exists')) {
                        console.log(chalk_1.default.yellow(`  Directory ${entry.path} already exists, skipping...`));
                    }
                    else {
                        throw error;
                    }
                }
            }
            console.log(chalk_1.default.green('\nAll subtrees have been added successfully!'));
        }
        catch (error) {
            console.error(chalk_1.default.red(`\nError: ${error.message}`));
            process.exit(1);
        }
    });
}
