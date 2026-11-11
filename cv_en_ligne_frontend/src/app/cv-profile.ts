export interface CvSkill {
  name: string;
  level: number;
}

export interface CvLanguage {
  name: string;
  level?: number;
}

export interface CvEntry {
  period: string;
  title: string;
  organization: string;
  description: string;
}

export interface CvProfile {
  id?: number;
  name: string;
  title: string;
  profile: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  website: string | null;
  photo_url: string | null;
  languages: CvLanguage[];
  skills: CvSkill[];
  hobbies: string[];
  education: CvEntry[];
  experience: CvEntry[];
  achievements: string[];
}

export const STARTER_CV: CvProfile = {
  name: 'Votre nom',
  title: 'Votre métier',
  profile: 'Ajoutez ici une courte présentation de votre parcours et de vos objectifs professionnels.',
  email: 'votre.email@exemple.com',
  phone: '',
  location: 'Votre ville',
  website: '',
  photo_url: '',
  languages: [],
  skills: [],
  hobbies: [],
  education: [],
  experience: [],
  achievements: [],
};
