const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const buildGradle = path.join(root, 'node_modules/react-native-sherpa-onnx/android/build.gradle');
const prebuilt = path.join(root, 'node_modules/react-native-sherpa-onnx/android/prebuilt-download.gradle');

function replace(file, from, to) {
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(to) || !source.includes(from)) return;
  fs.writeFileSync(file, source.replace(from, to));
  console.log(`arm64-only: patched ${path.basename(file)}`);
}

replace(buildGradle, 'abiFilters "arm64-v8a", "armeabi-v7a", "x86", "x86_64"', 'abiFilters "arm64-v8a"');
replace(prebuilt, 'def requiredAbis = ["arm64-v8a", "armeabi-v7a", "x86", "x86_64"]', 'def requiredAbis = ["arm64-v8a"]');
