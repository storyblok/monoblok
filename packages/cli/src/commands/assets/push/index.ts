import { getProgram } from '../../../program';
import { colorPalette, commands } from '../../../constants';
import { mapiClient } from '../../../api';
import { konsola, requireAuthentication } from '../../../utils';

import { session } from '../../../session';
import { assetsCommand } from '../command';
import { formatAssetFilename, readAssetFromPath } from './actions';
import chalk from 'chalk';

const program = getProgram();

assetsCommand
  .command('push')
  .description(`Push assets to your space`)
  .option('-f, --from <from>', 'source space id')

  .action(async (options) => {
    // Implement the pull action
    konsola.title(`${commands.ASSETS}`, colorPalette.ASSETS, `Pushing assets...`);

    // Global options
    const verbose = program.opts().verbose;

    // Command options
    const { space, path, from } = assetsCommand.opts();

    const { state, initializeSession } = session();
    await initializeSession();

    if (!requireAuthentication(state, verbose)) {
      return;
    }

    if (!from) {
      // If no source space is provided, use the target space as source
      options.from = space;
    }

    konsola.info(`Attempting to push assets ${chalk.bold('from')} space ${chalk.hex(colorPalette.ASSETS)(options.from || space)} ${chalk.bold('to')} ${chalk.hex(colorPalette.ASSETS)(space)}`);
    konsola.br();

    const { password, region } = state;

    const client = mapiClient({
      token: {
        accessToken: password,
      },
      region,
    });

    client.interceptors.request.use((config) => {
      console.log('Request:', config);

      return config;
    });

    client.interceptors.response.use((response) => {
      console.log('Response:', response);

      return response;
    });

    try {
      const assetToUpload = await readAssetFromPath(path);
      const assetForUpload = formatAssetFilename(assetToUpload);
      console.log(assetForUpload);
      const { data } = await client.assets.upload({
        path: {
          space_id: space!,
        },
        body: {
          filename: assetToUpload.filename!,
          size: assetToUpload.size,
          validate_upload: 1,
        },
      });

      if (data?.post_url && data?.fields) {
        // Create FormData with S3 fields first
        const formData = new FormData();

        // Add all the S3 form fields from the response
        Object.entries(data.fields).forEach(([key, value]) => {
          formData.append(key, value as string);
        });

        // Add the file LAST (required by S3)
        formData.append('file', assetForUpload.blob, assetForUpload.filename);

        // Upload to S3
        const uploadResponse = await fetch(data.post_url, {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          console.error('Upload to S3 failed:', uploadResponse);
          throw new Error(`Upload to S3 failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }

        konsola.ok(`Asset uploaded successfully: ${assetToUpload.filename}`);
      }
      await client.assets.finalize({
        path: {
          space_id: space!,
          signed_response_object_id: data?.id,
        },
      });
    }
    catch (error) {
      console.error(error);
      // handleAPIError('', error as Error, verbose);
    }
  });
