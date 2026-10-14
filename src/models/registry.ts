/**
 * Models are downloaded on the phone. URLs were checked against Hugging Face
 * and the sherpa-onnx tts-models release. expectedBytes is set only when a
 * published exact size was available; otherwise the downloader compares the
 * file to the server Content-Length.
 */
export type ModelKind = 'stt' | 'vad' | 'tts';

export type SttLanguageMap = {
  auto: string;
  en: string;
  hinglish: string;
};

export type ModelSpec = {
  id: string;
  kind: ModelKind;
  title: string;
  detail: string;
  url: string;
  filename: string;
  /** tar.bz2 archives are extracted with sherpa-onnx after download. */
  archive: boolean;
  expectedBytes?: number;
  recommended: boolean;
  /** Whisper language codes. Apex emits romanized Hinglish, so Hinglish mode stays on auto. */
  languages?: SttLanguageMap;
};

export const MODELS: ModelSpec[] = [
  {
    id: 'whisper-small-q5',
    kind: 'stt',
    title: 'Whisper small q5_1',
    detail: 'Multilingual, about 181 MiB. Default quality candidate.',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin',
    filename: 'ggml-small-q5_1.bin',
    archive: false,
    recommended: true,
    languages: { auto: 'auto', en: 'en', hinglish: 'hi' },
  },
  {
    id: 'whisper-base-q5',
    kind: 'stt',
    title: 'Whisper base q5_1',
    detail: 'Multilingual, about 57 MiB. Fastest candidate for a low-RAM phone.',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin',
    filename: 'ggml-base-q5_1.bin',
    archive: false,
    recommended: true,
    languages: { auto: 'auto', en: 'en', hinglish: 'hi' },
  },
  {
    id: 'whisper-apex-q5',
    kind: 'stt',
    title: 'Hindi2Hinglish Apex q5_0',
    detail: 'Oriserve large-v3-turbo fine-tune, community GGML, about 547 MB. Outputs romanized Hinglish.',
    url: 'https://huggingface.co/Marquestra/Whisper-Hindi2Hinglish-Apex-GGML/resolve/main/ggml-apex-hinglish-q5_0.bin',
    filename: 'ggml-apex-hinglish-q5_0.bin',
    archive: false,
    recommended: false,
    languages: { auto: 'auto', en: 'en', hinglish: 'auto' },
  },
  {
    id: 'silero-vad',
    kind: 'vad',
    title: 'Silero VAD',
    detail: 'Required by whisper.rn. 885098 bytes.',
    url: 'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin',
    filename: 'ggml-silero-v6.2.0.bin',
    archive: false,
    expectedBytes: 885098,
    recommended: true,
  },
  {
    id: 'kokoro-int8',
    kind: 'tts',
    title: 'Kokoro multi-lang int8',
    detail: 'English voice af_heart (sid 3). Hindi speaker ids exist, but sherpa documents English and Chinese lexicons only.',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-multi-lang-v1_0.tar.bz2',
    filename: 'kokoro-int8-multi-lang-v1_0.tar.bz2',
    archive: true,
    recommended: true,
  },
  {
    id: 'piper-hi-priyamvada',
    kind: 'tts',
    title: 'Piper Hindi priyamvada int8',
    detail: 'hi_IN female voice. Used when the reply contains Devanagari.',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-hi_IN-priyamvada-medium-int8.tar.bz2',
    filename: 'vits-piper-hi_IN-priyamvada-medium-int8.tar.bz2',
    archive: true,
    recommended: true,
  },
  {
    id: 'piper-en-lessac',
    kind: 'tts',
    title: 'Piper English lessac int8',
    detail: 'Fallback English voice if Kokoro is not downloaded.',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-lessac-medium-int8.tar.bz2',
    filename: 'vits-piper-en_US-lessac-medium-int8.tar.bz2',
    archive: true,
    recommended: false,
  },
];

export function modelById(id: string): ModelSpec | undefined {
  return MODELS.find((model) => model.id === id);
}

export const KOKORO_EN_SID = 3;
export const KOKORO_HI_SID = 31;
