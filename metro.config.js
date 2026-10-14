const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);
const whisperRoot = path.join(__dirname, 'node_modules/whisper.rn/src');

// whisper.rn 0.5.5 has an exports map that Metro cannot resolve to a file.
// Point every whisper.rn import at the package's TypeScript source.
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'whisper.rn' || moduleName.startsWith('whisper.rn/')) {
    const sub = moduleName === 'whisper.rn' ? 'index.ts' : moduleName.slice('whisper.rn/'.length);
    const candidates = [
      path.join(whisperRoot, sub),
      path.join(whisperRoot, `${sub}.ts`),
      path.join(whisperRoot, `${sub}.tsx`),
      path.join(whisperRoot, sub, 'index.ts'),
    ];
    const filePath = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (filePath) return { type: 'sourceFile', filePath };
  }
  if (typeof upstream === 'function') {
    return upstream(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
