export type FocusSoundType = "none" | "rain" | "cafe" | "nature";

export const FOCUS_SOUNDS: Record<Exclude<FocusSoundType, "none">, string> = {
  rain: "https://cdn.pixabay.com/audio/2022/11/17/audio_c97f7f4ea0.mp3",
  cafe: "https://cdn.pixabay.com/audio/2022/11/17/audio_c97f7f4ea0.mp3",
  nature: "https://cdn.pixabay.com/audio/2022/08/04/audio_2dde668d05.mp3",
};
