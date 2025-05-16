import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import * as utils from '../utils';

interface PackageJson {
  packageManager?: string;
  name?: string;
}

export function checkVersionsCommand(program: Command): void {
  program
    .command('check-versions')
    .description('Check for consistent pnpm version across all packages')
    .option('-f, --fix', 'Automatically fix inconsistent versions', false)
    .action(async (options?: { fix?: boolean }) => {
      try {
        const rootDir = utils.getMonorepoRoot();
        const expectedVersion = 'pnpm@10.10.0';
        const inconsistentPackages: { path: string; current: string | null }[] = [];
        
        // Check root package.json
        const rootPackagePath = path.join(rootDir, 'package.json');
        if (fs.existsSync(rootPackagePath)) {
          const rootPackage: PackageJson = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
          if (rootPackage.packageManager !== expectedVersion) {
            inconsistentPackages.push({
              path: rootPackagePath,
              current: rootPackage.packageManager || null
            });
            
            if (options?.fix) {
              rootPackage.packageManager = expectedVersion;
              fs.writeFileSync(
                rootPackagePath,
                JSON.stringify(rootPackage, null, 2) + '\n',
                'utf8'
              );
              console.log(chalk.green(`✓ Updated root package.json to use ${expectedVersion}`));
            }
          }
        }
        
        // Function to check a directory recursively
        const checkDirectory = (dirPath: string, isWorkspace = false) => {
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });
          
          for (const entry of entries) {
            const entryPath = path.join(dirPath, entry.name);
            
            // Skip node_modules and hidden directories
            if (entry.isDirectory() && 
                entry.name !== 'node_modules' && 
                !entry.name.startsWith('.')) {
              
              // Check if this directory has a package.json
              const packageJsonPath = path.join(entryPath, 'package.json');
              if (fs.existsSync(packageJsonPath)) {
                const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                
                // Only check/fix workspace packages or explicitly configured packages
                if (isWorkspace || packageJson.packageManager) {
                  if (packageJson.packageManager !== expectedVersion) {
                    inconsistentPackages.push({
                      path: packageJsonPath,
                      current: packageJson.packageManager || null
                    });
                    
                    if (options?.fix) {
                      packageJson.packageManager = expectedVersion;
                      fs.writeFileSync(
                        packageJsonPath,
                        JSON.stringify(packageJson, null, 2) + '\n',
                        'utf8'
                      );
                      console.log(chalk.green(`✓ Updated ${packageJson.name || packageJsonPath} to use ${expectedVersion}`));
                    }
                  }
                }
                
                // If this is a workspace root, check its subdirectories
                if (isWorkspace) {
                  checkDirectory(entryPath);
                }
              } else if (isWorkspace) {
                // If no package.json but we're in a workspace, check subdirectories
                checkDirectory(entryPath);
              }
            }
          }
        };
        
        // Check packages and tools directories
        checkDirectory(path.join(rootDir, 'packages'), true);
        checkDirectory(path.join(rootDir, 'tools'), true);
        
        // Report results
        if (inconsistentPackages.length === 0) {
          console.log(chalk.green(`✓ All packages use the expected pnpm version: ${expectedVersion}`));
        } else if (!options?.fix) {
          console.log(chalk.yellow(`Found ${inconsistentPackages.length} packages with inconsistent pnpm versions:`));
          inconsistentPackages.forEach(pkg => {
            console.log(chalk.yellow(`  - ${pkg.path.replace(rootDir + '/', '')}: ${pkg.current || 'not specified'} (expected: ${expectedVersion})`));
          });
          console.log(chalk.blue('\nRun with --fix to automatically update all versions.'));
        } else {
          console.log(chalk.green(`✓ Fixed ${inconsistentPackages.length} packages to use ${expectedVersion}`));
        }
        
      } catch (error) {
        console.error(chalk.red(`\nError: ${(error as Error).message}`));
        process.exit(1);
      }
    });
} 
