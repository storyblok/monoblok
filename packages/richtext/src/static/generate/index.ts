import fs from 'node:fs';
import path from 'pathe';
import { fileURLToPath } from 'node:url';
import { generateRenderMap } from './richtext-render-map';
import { generateElementTypes } from './richtext-element-types';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RENDER_MAP_PATH = path.join(__dirname, '../render-map.generated.ts');
const ELEMENT_TYPES_PATH = path.join(__dirname, '../richtext-element-types.generated.ts');
const TYPES_GEN_PATH = path.join(__dirname, '../../generated/overlay/types.gen.ts');

const renderMaps = generateRenderMap();
fs.writeFileSync(RENDER_MAP_PATH, renderMaps, 'utf-8');
execSync(`pnpm exec oxfmt ${RENDER_MAP_PATH}`, {
  stdio: 'inherit',
});

const elementTypes = generateElementTypes(TYPES_GEN_PATH);
fs.writeFileSync(ELEMENT_TYPES_PATH, elementTypes, 'utf-8');
execSync(`pnpm exec oxfmt ${ELEMENT_TYPES_PATH}`, {
  stdio: 'inherit',
});
