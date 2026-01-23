#!/usr/bin/env bash
set -euo pipefail

output_path="${1:-placeholder.png}"

node -e 'const fs=require("fs");const path=require("path");const out=process.argv[1];const png="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/xcAAwMCAO1YqXcAAAAASUVORK5CYII=";fs.writeFileSync(path.resolve(process.cwd(),out),Buffer.from(png,"base64"));console.log(`created ${out}`);' "${output_path}"
