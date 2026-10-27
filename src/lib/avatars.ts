import lawineImage from '@/assets/Lawine.jpeg';
import ubelImage from '@/assets/Übel.jpeg';
import seinImage from '@/assets/Sein.jpeg';
import serieImage from '@/assets/Serie.jpeg';
import flammeImage from '@/assets/Flamme.jpeg';
import himmelImage from '@/assets/𝖧𝗂𝗆𝗆𝖾𝗅.jpeg';
import landImage from '@/assets/avatar-land.jpeg';
import ubelSecondImage from '@/assets/avatar-ubel-2.jpeg';
import himmelSecondImage from '@/assets/avatar-himmel-2.jpeg';
import starkImage from '@/assets/avatar-stark.jpeg';

export const AVATARS = [
  { key: 'lawine', label: 'Lawine', src: lawineImage },
  { key: 'ubel', label: 'Übel', src: ubelImage },
  { key: 'sein', label: 'Sein', src: seinImage },
  { key: 'serie', label: 'Serie', src: serieImage },
  { key: 'flamme', label: 'Flamme', src: flammeImage },
  { key: 'himmel', label: 'Himmel', src: himmelImage },
  { key: 'land', label: 'Land', src: landImage },
  { key: 'ubel-2', label: 'Übel (second portrait)', src: ubelSecondImage },
  { key: 'himmel-2', label: 'Himmel (second portrait)', src: himmelSecondImage },
  { key: 'stark', label: 'Stark', src: starkImage },
] as const;

