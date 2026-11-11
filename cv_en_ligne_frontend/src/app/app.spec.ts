import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { App } from './app';
import { CvApiService } from './cv-api.service';
import { STARTER_CV } from './cv-profile';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: CvApiService,
          useValue: {
            load: () => of(STARTER_CV),
            login: () => of({ token: 'test-token', expires_in: 28800 }),
            logout: () => of({ message: 'Session fermée.' }),
            save: () => of(STARTER_CV),
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the CV profile returned by the API', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(STARTER_CV.name);
    expect(compiled.textContent).toContain('Profil');
  });

  it('should show languages without levels or a skills section', async () => {
    TestBed.overrideProvider(CvApiService, {
      useValue: {
        load: () =>
          of({
            ...STARTER_CV,
            languages: [{ name: 'Français', level: 80 }],
            skills: [{ name: 'SQL', level: 80 }],
          }),
        login: () => of({ token: 'test-token', expires_in: 28800 }),
        logout: () => of({ message: 'Session fermée.' }),
        save: () => of(STARTER_CV),
      },
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Français');
    expect(compiled.textContent).not.toContain('80%');
    expect(compiled.textContent).not.toContain('Compétences');
    expect(compiled.querySelector('.meter-track')).toBeNull();
  });

  it('should hide CV editing fields until the administrator signs in', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('.topbar .button-quiet')?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('.login-form')).not.toBeNull();
    expect(compiled.querySelector('app-rich-text-editor')).toBeNull();

    const password = compiled.querySelector<HTMLInputElement>('[name="loginPassword"]');
    expect(password).not.toBeNull();
    password!.value = 'test-password';
    password!.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    compiled.querySelector<HTMLFormElement>('.login-form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.querySelector('.login-form')).toBeNull();
    expect(compiled.querySelector('app-rich-text-editor')).not.toBeNull();
    expect(compiled.querySelector('[aria-label="Mise en forme du texte"]')).not.toBeNull();
    expect(compiled.querySelector('[name="photo"]')).toBeNull();
  });
});
