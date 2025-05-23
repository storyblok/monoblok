import { Command } from 'commander';
import chalk from 'chalk';
import * as utils from '../../utils';
import licenseChecker from 'license-checker';

const PERMITTED_LICENSES = [
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD-3-Clause',
  'BSD-2-Clause',
  'BlueOak-1.0.0',
  'CC0-1.0',
  '0BSD',
  'CC-BY-4.0',
  'MIT*',
  'WTFPL',
  'MIT-0',
  'Python-2.0',
  'Public Domain',
  'CC-BY-3.0',
  'BSD*',
  'Unlicense',
];

export function checkCommand(program: Command): void {
  program
    .command('check')
    .description('Check dependency licenses for a package')
    .argument('<package>', 'Package name to check')
    .action(async (packageName: string) => {
      try {
        const packagePath = await utils.getPackagePath(packageName);

        licenseChecker.init({
          start: packagePath,
          production: true,
          json: true,
          // @ts-expect-error license-checker types are not updated
          exclude: PERMITTED_LICENSES.join(','),
        }, (err, packages) => {
          if (err) {
            console.error(err);
            process.exit(1);
          }

          // The remaining packages are the ones that have invalid licenses
          const packagesWithInvalidLicenses = Object.entries(packages);

          if (packagesWithInvalidLicenses.length > 0) {
            console.error(chalk.red(`Invalid licenses found for package '${packageName}'`));
            console.error(packagesWithInvalidLicenses);
            process.exit(1);
          }
          else {
            console.log(chalk.green(`All licenses are valid for package '${packageName}'`));
          }
        });
      } catch (error) {
        console.error(chalk.red(`Error checking license for package '${packageName}'`));
        console.error(error);
        process.exit(1);
      }
    });
} 
