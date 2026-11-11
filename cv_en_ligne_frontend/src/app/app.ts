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
  protected readonly exporting = signal(false);
  protected readonly exportError = signal('');
  protected readonly loginError = signal('');
  protected readonly saveError = signal('');
  protected readonly saveSuccess = signal('');

  protected draft: CvProfile = structuredClone(STARTER_CV);
  protected loginPassword = '';
  protected hobbiesText = '';
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

  protected openEditor(): void {
    this.previousBodyOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.draft = structuredClone(this.cv());
    this.hobbiesText = this.draft.hobbies.join('\n');
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
          this.errorMessage(
            error,
            'La session locale est fermée, mais la déconnexion serveur a échoué.',
          ),
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

    this.cvApi.save(updatedProfile, this.adminToken).subscribe({
      next: (profile) => {
        this.cv.set(profile);
        this.draft = structuredClone(profile);
        this.hobbiesText = profile.hobbies.join('\n');
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

  protected async exportPdf(): Promise<void> {
    const cvElement = this.document.getElementById('cv');

    if (!(cvElement instanceof HTMLElement)) {
      this.exportError.set('Impossible de trouver le CV à exporter.');
      return;
    }

    this.exporting.set(true);
    this.exportError.set('');

    try {
      const { default: html2pdf } = await import('html2pdf.js');
      await html2pdf()
        .set({
          filename: `${this.fileName(this.cv().name)}-cv.pdf`,
          margin: 8,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            windowWidth: 1200,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(cvElement)
        .save();
    } catch (error: unknown) {
      console.error('PDF export failed.', error);
      this.exportError.set('Le téléchargement du PDF a échoué. Réessayez.');
    } finally {
      this.exporting.set(false);
    }
  }

  protected exportWord(): void {
    const profile = this.cv();
    this.exportError.set('');
    const entries = (items: CvEntry[]) =>
      items
        .map(
          (
            item,
          ) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18pt">
            <tr><td style="padding:0 0 4pt;color:#176f70;font-size:10pt;font-weight:bold">${this.escapeHtml(item.period)}</td></tr>
            <tr><td style="padding:0 0 3pt;color:#1a2539;font-size:12pt;font-weight:bold">${this.escapeHtml(item.title)}</td></tr>
            <tr><td style="padding:0 0 8pt;color:#374151;font-size:10pt;font-weight:bold">${this.escapeHtml(item.organization)}</td></tr>
            <tr><td style="color:#374151;font-size:10pt;line-height:1.55">${this.richHtml(item.description)}</td></tr>
          </table>`,
        )
        .join('');
    const section = (number: string, title: string, content: string) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 24pt">
        <tr>
          <td width="38" valign="top" style="width:38px;padding:0 10pt 0 0">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
              <tr><td width="30" height="30" align="center" valign="middle" style="width:30px;height:30px;border:1px solid #176f70;border-radius:50%;color:#176f70;font-size:9pt;font-weight:bold">${number}</td></tr>
            </table>
          </td>
          <td valign="top">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
              <tr><td style="padding:0 0 10pt;border-bottom:1px solid #9baeb8;color:#17364a;font-size:13pt;font-weight:bold">${title}</td></tr>
              <tr><td style="padding:10pt 0 0;color:#374151;font-size:10pt;line-height:1.6">${content}</td></tr>
            </table>
          </td>
        </tr>
      </table>`;
    const achievements = profile.achievements
      .map(
        (item) =>
          `<tr><td style="padding:0 6pt 6pt 0;color:#176f70">✓</td><td style="padding:0 0 6pt;color:#374151">${this.escapeHtml(item)}</td></tr>`,
      )
      .join('');
    const sidebarSection = (title: string, content: string) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18pt">
        <tr><td style="padding:0 0 6pt;border-bottom:1px solid #6d8491;color:#ffffff;font-size:10pt;font-weight:bold">${title}</td></tr>
        <tr><td style="padding:8pt 0 0;color:#f0f5f7;font-size:9pt;line-height:1.6">${content}</td></tr>
      </table>`;
    const sidebarList = (items: string[]) =>
      items.map((item) => `<div style="padding:0 0 6pt">${this.escapeHtml(item)}</div>`).join('');
    const contacts = [
      profile.email && `<div style="padding:0 0 7pt">${this.escapeHtml(profile.email)}</div>`,
      profile.phone && `<div style="padding:0 0 7pt">${this.escapeHtml(profile.phone)}</div>`,
      profile.location && `<div style="padding:0 0 7pt">${this.escapeHtml(profile.location)}</div>`,
      profile.website &&
        `<div style="padding:0 0 7pt"><a href="${this.escapeHtml(profile.website)}" style="color:#f0f5f7">${this.escapeHtml(profile.website)}</a></div>`,
    ]
      .filter(Boolean)
      .join('');
    const resumeSections = [
      section('01', 'Profil', this.richHtml(profile.profile)),
      profile.experience.length &&
        section('02', 'Expérience professionnelle', entries(profile.experience)),
      profile.education.length && section('03', 'Formation', entries(profile.education)),
      profile.achievements.length &&
        section(
          '04',
          'Réalisations',
          `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${achievements}</table>`,
        ),
    ]
      .filter(Boolean)
      .join('');
    const html = `<!doctype html>
      <html><head><meta charset="utf-8"><title>${this.escapeHtml(profile.name)} - CV</title></head>
      <body style="margin:0;padding:24pt;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.5">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:900px;margin:0 auto;border-collapse:collapse;background:#ffffff">
          <tr>
            <td width="28%" valign="top" style="width:28%;padding:28pt 18pt;background:#17364a;color:#f7fafc">
              ${sidebarSection('Contact', contacts)}
              ${profile.languages.length ? sidebarSection('Langues', sidebarList(profile.languages.map((language) => language.name))) : ''}
              ${profile.hobbies.length ? sidebarSection('Centres d’intérêt', sidebarList(profile.hobbies)) : ''}
            </td>
            <td width="72%" valign="top" style="width:72%;padding:32pt 34pt;background:#ffffff">
              <p style="margin:0 0 8pt;color:#176f70;font-size:9pt;font-weight:bold;letter-spacing:2px">CURRICULUM VITAE</p>
              <h1 style="margin:0;color:#101b2e;font-size:28pt;line-height:1.1">${this.escapeHtml(profile.name)}</h1>
              <p style="margin:8pt 0 14pt;color:#374151;font-size:13pt;font-weight:bold">${this.escapeHtml(profile.title)}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 24pt">
                <tr><td width="62" height="3" style="width:62px;height:3px;background:#176f70"></td></tr>
              </table>
              ${resumeSections}
            </td>
          </tr>
        </table>
      </body></html>`;
    const blob = new Blob(['\ufeff', html], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.fileName(profile.name)}-cv.doc`;
    this.document.body.appendChild(link);
    link.click();
    link.remove();
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
    };
    const matchedField = field.match(
      /^(languages|skills|hobbies|education|experience|achievements)/,
    )?.[0];
    const sectionLabels: Record<string, string> = {
      languages: 'Langues',
      skills: 'Compétences',
      hobbies: 'Centres d’intérêt',
      education: 'Formation',
      experience: 'Expérience professionnelle',
      achievements: 'Réalisations',
    };
    const label =
      labels[field] ?? (matchedField ? sectionLabels[matchedField] : undefined) ?? 'Un champ';
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

    return `${label} : vérifiez la valeur saisie.`;
  }
}
