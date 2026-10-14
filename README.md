# Vaani — on-device voice agent

Mobile voice assistant for the Computational Intelligence Lab, Department of Aerospace Engineering, IISc Bangalore. Speech recognition and speech synthesis run on the phone. The language model runs in the cloud.

Demo video: *(record on the phone and paste the link here)*

## Architecture

```
Phone (airplane mode still works for these)
  Mic 16 kHz -> Silero VAD -> whisper.rn
  Kokoro / Piper TTS, or an offline system voice
  Models live in the app documents folder, not in the APK

Cloud (fails in airplane mode, on purpose)
  Groq chat completions, Gemini OpenAI-compatible endpoint as fallback
  Open-Meteo for weather

Phone actions
  Clock alarm via SET_ALARM
  Calendar reminder and today's schedule via expo-calendar
```

## Proof it is on-device

1. Download a Whisper model, Silero VAD, and a TTS model on the Models screen.
2. Turn on airplane mode.
3. Speak. The transcript still appears.
4. Tap **Say test lines**. Speech still plays.
5. The assistant reply does not, because that call needs the network.

Audio is not uploaded. The cloud request contains the transcript and the tool result, not the recording.

| Model | Where it runs | Notes |
|---|---|---|
| Whisper small q5_1, base q5_1 | Phone | ggml from ggerganov/whisper.cpp |
| Oriserve Hindi2Hinglish Apex q5_0 | Phone | Community GGML, romanized Hinglish, optional |
| Silero VAD ggml-silero-v6.2.0 | Phone | 885098 bytes, ggml-org/whisper-vad |
| Kokoro int8 multi-lang | Phone | English voice `af_heart` (speaker 3) |
| Piper hi_IN priyamvada int8 | Phone | Devanagari replies |
| Groq or Gemini | Cloud | API key stays in the Android keystore |

## Features

- "What is the weather forecast for Bangalore tomorrow?" speaks an Open-Meteo forecast.
- "Can you set a reminder for my meeting at 5 PM?" creates a 30 minute calendar event with an alarm.
- "Mujhe kal subah 7 baje ka alarm set karna hai." sends a 7:00 alarm to the Clock app.
- "Aaj ka schedule kya hai, aur meri next meeting kab hai?" reads today's events and the next one.

Hinglish replies put Hindi words in Devanagari and leave words like meeting, alarm, reminder, PM, Bangalore, and weather in English letters, so the Hindi voice pronounces Hindi and the English voice pronounces English.

## Latency results

Not measured yet. `adb devices` was empty while this build was prepared, so the README does not invent a phone model, RAM, or timing table. After 20 real turns, copy median and p90 from the Metrics screen.

| Stage | Median | p90 |
|---|---|---|
| Speech end to transcript | | |
| Transcript to first token | | |
| First token to first audio | | |
| Speech end to first audio | | |

Phone model: *(adb shell getprop ro.product.model)*
RAM: *(adb shell cat /proc/meminfo)*
Network: *(Wi-Fi or mobile, noted during the run)*

## Transcription accuracy

The Benchmark screen stores WER and CER per line. Scoring lowercases text, strips punctuation, and picks the better of the Latin reference and the Devanagari alternate. Run it for at least Whisper base and Whisper small.

| Model | Size on phone | Median STT | WER English | WER Hinglish |
|---|---|---|---|---|
| whisper base q5_1 | | | | |
| whisper small q5_1 | | | | |

## Pronunciation

- A whole reply uses one voice, chosen from its first sentence. Devanagari selects Piper `hi_IN` priyamvada. A reply with no Devanagari uses Kokoro `af_heart` when that model is downloaded.
- The default Hinglish setting asks the model to write the entire reply in Devanagari so that Hindi voice pronounces it. Mixed script is still available in Settings.
- Kokoro's Hindi speaker ids (`hf_alpha` is 31) are only a fallback. sherpa-onnx documents English and Chinese lexicons for that package, so Hindi pronunciation is expected from Piper.
- System TTS is the last fallback. Voice names containing "network" or "online" are skipped. Android does not tell expo-speech which voices are offline, so install an offline Hindi voice in system settings before relying on it.

## Design decisions

- Expo SDK 54 and React Native 0.81, same generation as a sibling app that already builds on this PC, so the Gradle and NDK caches are reused. The APK is `arm64-v8a` only.
- whisper.rn 0.5.5 for on-device Whisper. Realtime capture uses its `AudioPcmStreamAdapter` and Silero VAD, which needs `@fugood/react-native-audio-pcm-stream`.
- `maxLen` is left at the whisper.cpp default. In this build it means "maximum segment length in characters", and setting it to 1 would split every character.
- react-native-sherpa-onnx 0.4.4 for neural TTS. Archives are extracted with its `extractArchive` helper.
- Groq's deprecations page lists `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` as shut down on 16 August 2026 for free and developer-tier usage. Enterprise committed-spend contracts are not listed as affected. The fast default is `openai/gpt-oss-20b`, with `reasoning_effort` set to `low`. Quality options are `openai/gpt-oss-120b` and `qwen/qwen3.6-27b` (Qwen thinking disabled).
- Streaming uses `expo/fetch` because React Native's fetch does not expose a response body stream.

## Fixes after the first phone test

- Speech no longer restarts the player for every sentence, so the first syllable is not clipped, and the next sentence starts when the current one finishes instead of after an extra silent gap.
- Times and decimals such as 28.4 and 5.30 p.m. stay in one spoken chunk.
- Groq reasoning models are asked for low or no thinking, and reasoning text is not spoken.
- A reply stays on one voice. Hinglish can be full Devanagari (the default, best for the Hindi voice) or the older mixed script.
- Tapping the mic while a reply is in progress stops the audio, the text, and the model request.
- Weather and calendar tools still run when the provider omits a tool-call finish reason. The schedule includes every calendar. Temperatures are whole degrees.

## How to build and run

Phone: USB debugging on. This PC: Node, JDK 17, Android SDK with NDK 27.1.12297006.

```powershell
cd C:\Users\LENOVO\Desktop\iisc-voice-agent
npm install
npx expo prebuild -p android
npx expo run:android --variant release
```

The release build is signed with the debug keystore so it installs over USB. Copy the APK into `release/` if you want a file to attach to a GitHub release. That folder is git-ignored.

`react-native-sherpa-onnx` builds every CPU type unless told otherwise. `scripts/limit-sherpa-abis.js` keeps only `arm64-v8a`, and `postinstall` runs it. This PC does not have room for the x86 native build.

Put the Groq or Gemini key in Settings. It is stored with expo-secure-store and is not logged.

## Project structure

```
src/screens     Main, Settings, Models, Benchmark, Metrics, About
src/audio       whisper.rn realtime microphone session
src/stt         load, warm up, and transcribe
src/tts         Kokoro/Piper, system voice, sentence chunker
src/llm         system prompt, SSE stream, tool loop
src/tools       weather, alarm, reminder, schedule
src/models      URLs and the phone downloader
src/metrics     latency store, WER/CER
```

## Limitations

- Latency and accuracy tables are empty until the app is run on the phone.
- Android's alarm intent sets the next occurrence of a clock time. A date that is not that next occurrence is reported back to the model instead of being silently ignored.
- Some phone skins still show the Clock app even when `SKIP_UI` is set.
- Streaming speech recognition and an on-device language model are not in this build.

## Credits and licenses

This app is MIT. Whisper.cpp is MIT. The Oriserve Apex model is Apache 2.0; the GGML file used here is the community conversion `Marquestra/Whisper-Hindi2Hinglish-Apex-GGML`. sherpa-onnx, Kokoro, and Piper voices keep their upstream licenses. Weather data is from Open-Meteo. Silero VAD is from the Silero project, packaged as ggml by ggml-org.

## Demo script

See `docs/DEMO.md`.
