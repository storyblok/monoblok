import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTypes } from './richtext-type';
import { generateRenderMap } from './richtext-render-map';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RENDER_MAP_PATH = path.join(__dirname, '../render-map.generated.ts');
const TYPES_PATH = path.join(__dirname, '../types.generated.ts');

const types = generateTypes();
const renderMaps = generateRenderMap();

fs.writeFileSync(TYPES_PATH, types, 'utf-8');
fs.writeFileSync(RENDER_MAP_PATH, renderMaps, 'utf-8');
