export const LUX_THRESHOLDS = [
    { label: 'dark',        min: 0,    max: 100,  color: '#1a1a2e' },
    { label: 'dim',         min: 100,  max: 500,  color: '#f5a623' },
    { label: 'moderate',    min: 500,  max: 2000, color: '#f8d347' },
    { label: 'bright',      min: 2000, max: 3000, color: '#ffe680' },
    { label: 'very bright', min: 3000, max: 4095, color: '#fff9c4' },
  ] as const;