import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  SecurityContext,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { CvApiService } from './cv-api.service';
import { CvEntry, CvProfile, STARTER_CV } from './cv-profile';
import { RichTextEditor } from './rich-text-editor';

@Component({
  selector: 'app-root',
  imports: [FormsModule, RichTextEditor],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnDestroy, OnInit {
  protected readonly cv = signal<CvProfile>(structuredClone(STARTER_CV));
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly editing = signal(false);
  protected readonly authenticated = signal(false);
  protected readonly loggingIn = signal(false);
  protected readonly saving = signal(false);
  protected readonly loginError = signal('');
  protected readonly saveError = signal('');
  protected readonly saveSuccess = signal('');

  protected draft: CvProfile = structuredClone(STARTER_CV);
  protected loginPassword = '';
  protected hobbiesText = '';
  protected selectedPhoto: File | null = null;
  private adminToken = '';
  private previousBodyOverflow = '';

  constructor(
    private readonly cvApi: CvApiService,
    private readonly sanitizer: DomSanitizer,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {}

  ngOnInit(): void {
    this.cvApi.load().subscribe({
      next: (profile) => {
        this.cv.set(profile);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(
          this.errorMessage(
            error,
            'Impossible de joindre le serveur. Le CV affiché est un exemple non enregistré.',
          ),
        );
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.document.body.style.overflow = this.previousBodyOverflow;
  }

  protected initials(): string {
    return this.cv()
      .name.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toLocaleUpperCase())
      .join('');
  }

  protected openEditor(): void {
    this.previousBodyOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.draft = structuredClone(this.cv());
    this.hobbiesText = this.draft.hobbies.join('\n');
    this.selectedPhoto = null;
    this.saveError.set('');
    this.saveSuccess.set('');
    this.loginError.set('');
    this.editing.set(true);
  }

  protected closeEditor(): void {
    this.editing.set(false);
    this.loginPassword = '';
    this.document.body.style.overflow = this.previousBodyOverflow;
  }

  protected loginAdmin(): void {
    this.loggingIn.set(true);
    this.loginError.set('');

    this.cvApi.login(this.loginPassword).subscribe({
      next: (session) => {
        this.adminToken = session.token;
        this.authenticated.set(true);
        this.loginPassword = '';
        this.loggingIn.set(false);
      },
      error: (error: unknown) => {
        this.loggingIn.set(false);
        this.loginError.set(
          this.errorMessage(error, 'Impossible de vérifier le mot de passe administrateur.'),
        );
      },
    });
  }

  protected logoutAdmin(): void {
    const token = this.adminToken;
    this.adminToken = '';
    this.authenticated.set(false);
    this.saveError.set('');

    this.cvApi.logout(token).subscribe({
      next: () => this.closeEditor(),
      error: (error: unknown) => {
        this.loginError.set(
          this.errorMessage(error, 'La session locale est fermée, mais la déconnexion serveur a échoué.'),
        );
      },
    });
  }

  protected addExperience(): void {
    this.draft.experience.push(this.emptyEntry());
  }

  protected removeExperience(index: number): void {
    this.draft.experience.splice(index, 1);
  }

  protected addEducation(): void {
    this.draft.education.push(this.emptyEntry());
  }

  protected removeEducation(index: number): void {
    this.draft.education.splice(index, 1);
  }

  protected addLanguage(): void {
    this.draft.languages.push({ name: '' });
  }

  protected removeLanguage(index: number): void {
    this.draft.languages.splice(index, 1);
  }

  protected addAchievement(): void {
    this.draft.achievements.push('');
  }

  protected removeAchievement(index: number): void {
    this.draft.achievements.splice(index, 1);
  }

  protected selectPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedPhoto = input.files?.[0] ?? null;
  }

  protected saveCv(): void {
    this.saving.set(true);
    this.saveError.set('');
    this.saveSuccess.set('');

    const updatedProfile: CvProfile = {
      ...this.draft,
      languages: this.draft.languages.map(({ name }) => ({ name })),
      hobbies: this.hobbiesText
        .split(/\r?\n/)
        .map((hobby) => hobby.trim())
        .filter(Boolean),
    };

    this.cvApi.save(updatedProfile, this.adminToken, this.selectedPhoto ?? undefined).subscribe({
      next: (profile) => {
        this.cv.set(profile);
        this.draft = structuredClone(profile);
        this.hobbiesText = profile.hobbies.join('\n');
        this.selectedPhoto = null;
        this.saving.set(false);
        this.saveSuccess.set('Votre CV a été enregistré.');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.adminToken = '';
          this.authenticated.set(false);
          this.loginError.set('Votre session a expiré. Reconnectez-vous pour continuer.');
        } else {
          this.saveError.set(
            this.errorMessage(error, 'Une erreur est survenue pendant l’enregistrement.'),
          );
        }
      },
    });
  }

  protected exportPdf(): void {
    window.print();
  }

  protected exportWord(): void {
    const profile = this.cv();
    const entries = (items: CvEntry[]) =>
      items
        .map(
          (item) => `<article>
            <p style="color:#2463c4;font-weight:bold">${this.escapeHtml(item.period)}</p>
            <h3>${this.escapeHtml(item.title)}</h3>
            <p><strong>${this.escapeHtml(item.organization)}</strong></p>
            <div>${this.richHtml(item.description)}</div>
          </article>`,
        )
        .join('');
    const list = (items: string[]) =>
      items.map((item) => `<li>${this.escapeHtml(item)}</li>`).join('');
    const html = `<!doctype html>
      <html><head><meta charset="utf-8"><title>${this.escapeHtml(profile.name)} - CV</title>
      <style>body{font-family:Arial,sans-serif;color:#17233c;line-height:1.55}
      h1,h2{color:#1753a6}h2{border-bottom:1px solid #1753a6;padding-bottom:5px}
      article{margin:18px 0}main{max-width:760px;margin:auto}</style></head>
      <body><main><h1>${this.escapeHtml(profile.name)}</h1>
      <h2>${this.escapeHtml(profile.title)}</h2><div>${this.richHtml(profile.profile)}</div>
      <p>${this.escapeHtml(profile.email ?? '')} · ${this.escapeHtml(profile.phone ?? '')}
      · ${this.escapeHtml(profile.location ?? '')}</p>
      <h2>Expérience</h2>${entries(profile.experience)}
      <h2>Formation</h2>${entries(profile.education)}
      <h2>Langues</h2><ul>${list(profile.languages.map((language) => language.name))}</ul>
      <h2>Centres d’intérêt</h2><ul>${list(profile.hobbies)}</ul>
      <h2>Réalisations</h2><ul>${list(profile.achievements)}</ul></main></body></html>`;
    const blob = new Blob(['\ufeff', html], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.fileName(profile.name)}-cv.doc`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private emptyEntry(): CvEntry {
    return { period: '', title: '', organization: '', description: '' };
  }

  private fileName(name: string): string {
    return (
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'mon'
    );
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character];
    });
  }

  private richHtml(value: string): string {
    return this.sanitizer.sanitize(SecurityContext.HTML, value) ?? '';
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const validationErrors = error.error?.errors;
      if (validationErrors && typeof validationErrors === 'object') {
        const [field, messages] = Object.entries(validationErrors)[0] ?? [];
        const message = Array.isArray(messages) ? String(messages[0] ?? '') : '';

        if (field && message) {
          return this.validationMessage(field, message);
        }
      }

      if (typeof error.error?.message === 'string') {
        return error.error.message;
      }

      if (error.status === 0) {
        return fallback;
      }

      return `Erreur du serveur (${error.status}) : ${error.message}`;
    }

    return fallback;
  }

  private validationMessage(field: string, message: string): string {
    const labels: Record<string, string> = {
      name: 'Nom',
      title: 'Métier',
      profile: 'Présentation',
      email: 'Adresse e-mail',
      phone: 'Téléphone',
      location: 'Ville et pays',
      website: 'Site web',
      photo_url: 'Photo',
      photo: 'Photo',
    };
    const matchedField = field.match(/^(languages|skills|hobbies|education|experience|achievements)/)?.[0];
    const sectionLabels: Record<string, string> = {
      languages: 'Langues',
      skills: 'Compétences',
      hobbies: 'Centres d’intérêt',
      education: 'Formation',
      experience: 'Expérience professionnelle',
      achievements: 'Réalisations',
    };
    const label = labels[field] ?? (matchedField ? sectionLabels[matchedField] : undefined) ?? 'Un champ';
    const maxLength = message.match(/not be greater than (\d+) characters?/i);

    if (maxLength) {
      return `${label} : le texte dépasse la limite de ${maxLength[1]} caractères.`;
    }

    if (message.toLowerCase().includes('required')) {
      return `${label} : ce champ est obligatoire.`;
    }

    if (message.toLowerCase().includes('valid url')) {
      return `${label} : veuillez saisir une adresse URL valide.`;
    }

    if (field === 'photo' && (message.toLowerCase().includes('image') || message.toLowerCase().includes('mimes'))) {
      return 'Photo : sélectionnez une image JPG, PNG ou WebP de 5 Mo maximum.';
    }

    return `${label} : vérifiez la valeur saisie.`;
  }
}
