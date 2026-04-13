export type PaceMode = 'Fast' | 'Normal' | 'Study';

export interface PaceProfile {
  dealMs: [number, number];
  thinkMs: [number, number];
  postActionMs: [number, number];
  streetMs: [number, number];
  showdownMs: [number, number];
  chipMs: [number, number];
}

export const paceProfiles: Record<PaceMode, PaceProfile> = {
  Fast: {
    dealMs: [120, 150],
    thinkMs: [250, 380],
    postActionMs: [120, 160],
    streetMs: [230, 280],
    showdownMs: [350, 520],
    chipMs: [140, 170]
  },
  Normal: {
    dealMs: [130, 170],
    thinkMs: [320, 540],
    postActionMs: [140, 210],
    streetMs: [270, 360],
    showdownMs: [500, 720],
    chipMs: [160, 220]
  },
  Study: {
    dealMs: [160, 180],
    thinkMs: [450, 700],
    postActionMs: [180, 260],
    streetMs: [330, 400],
    showdownMs: [700, 900],
    chipMs: [200, 250]
  }
};

export const jitterInRange = ([min, max]: [number, number]): number => Math.round(min + Math.random() * (max - min));

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
