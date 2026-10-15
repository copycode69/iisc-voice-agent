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

const whisperContext = path.join(root, 'node_modules/whisper.rn/android/src/main/java/com/rnwhisper/WhisperContext.java');
const fp16Load = `      if (hasFp16) {
        Log.d(NAME, "Loading librnwhisper_v8fp16_va_2.so");
        System.loadLibrary("rnwhisper_v8fp16_va_2");
        loadedLibrary = "rnwhisper_v8fp16_va_2";
      } else {
        Log.d(NAME, "Loading librnwhisper_v8.so");
        System.loadLibrary("rnwhisper_v8");
        loadedLibrary = "rnwhisper_v8";
      }`;
const stableLoad = `      // SIMD builds (v8 and fp16) SIGSEGV in memcpy on this Dimensity phone.
      Log.d(NAME, "Loading librnwhisper.so generic CPU (fp16=" + hasFp16 + ")");
      System.loadLibrary("rnwhisper");
      loadedLibrary = "rnwhisper";`;
replace(whisperContext, fp16Load, stableLoad);
const v8Load = `      // The fp16 library SIGSEGVs in memcpy on Dimensity phones.
      Log.d(NAME, "Loading librnwhisper_v8.so (fp16 detected=" + hasFp16 + ", skipped)");
      System.loadLibrary("rnwhisper_v8");
      loadedLibrary = "rnwhisper_v8";`;
replace(whisperContext, v8Load, stableLoad);

const whisperJsi = path.join(root, 'node_modules/whisper.rn/cpp/jsi/RNWhisperJSI.cpp');
replace(whisperJsi, 'params.single_segment = false;', 'params.single_segment = true;');
replace(
  whisperJsi,
  `                            // Execute transcription
                            rnwhisper::job* job = rnwhisper::job_new(callbackInfo.jobId, mutable_params);`,
  `                            // Default audio context is 30 seconds. A short clip then spends
                            // minutes in the encoder on a CPU without SIMD.
                            int frames = (audioResult.count + 159) / 160;
                            int ctx = ((frames + 255) / 256) * 256;
                            if (ctx < 256) ctx = 256;
                            if (ctx > 768) ctx = 768;
                            mutable_params.audio_ctx = ctx;
                            logInfo("Using audio_ctx=%d for %d samples", ctx, audioResult.count);

                            // Execute transcription
                            rnwhisper::job* job = rnwhisper::job_new(callbackInfo.jobId, mutable_params);`,
);
