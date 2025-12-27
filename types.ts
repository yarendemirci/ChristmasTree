
export interface HandState {
  pinchDistance: number;
  isOpen: boolean;
  isPinching: boolean;
  active: boolean;
  rotationSpeed: number; // Angular velocity of the index finger
}

export enum TreeMode {
  MERRY = 'MERRY',
  SILENT = 'SILENT'
}
