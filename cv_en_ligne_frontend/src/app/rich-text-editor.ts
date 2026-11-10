import {
  AfterViewInit,
  Component,
  ElementRef,
  forwardRef,
  Input,
  SecurityContext,
  ViewChild,
  inject,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-rich-text-editor',
  templateUrl: './rich-text-editor.html',
  styleUrl: './rich-text-editor.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditor),
      multi: true,
    },
  ],
})
export class RichTextEditor implements ControlValueAccessor, AfterViewInit {
  @ViewChild('editor') private editor?: ElementRef<HTMLDivElement>;
  @Input() label = 'Texte enrichi';
  @Input() placeholder = 'Saisissez votre texte…';

  protected readonly sanitizer = inject(DomSanitizer);
  protected disabled = false;
  protected readonly blockTypes = [
    { value: 'p', label: 'Paragraphe' },
    { value: 'h2', label: 'Titre 2' },
    { value: 'h3', label: 'Titre 3' },
  ];

  private value = '';
  private savedSelection: Range | null = null;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngAfterViewInit(): void {
    this.updateEditorContent();
  }

  writeValue(value: string | null): void {
    this.value = value ?? '';
    this.updateEditorContent();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    if (this.editor) {
      this.editor.nativeElement.contentEditable = String(!disabled);
    }
  }

  protected onInput(): void {
    this.value = this.editor?.nativeElement.innerHTML ?? '';
    this.onChange(this.value);
  }

  protected applyCommand(command: string, value?: string): void {
    this.restoreSelection();
    document.execCommand(command, false, value);
    this.onInput();
    this.editor?.nativeElement.focus();
  }

  protected changeBlock(event: Event): void {
    const element = event.target;
    if (!(element instanceof HTMLSelectElement)) {
      return;
    }

    this.restoreSelection();
    this.applyCommand('formatBlock', element.value);
    element.value = 'p';
  }

  protected addLink(): void {
    const url = window.prompt('Adresse du lien (https://… ou mailto:…)');
    if (!url || !/^(https?:\/\/|mailto:)/i.test(url.trim())) {
      return;
    }

    this.restoreSelection();
    document.execCommand('createLink', false, url.trim());
    this.onInput();
    this.editor?.nativeElement.focus();
  }

  protected captureSelection(): void {
    const selection = window.getSelection();

    if (selection?.rangeCount && this.editor?.nativeElement.contains(selection.anchorNode)) {
      this.savedSelection = selection.getRangeAt(0).cloneRange();
    }
  }

  protected saveSelection(event: MouseEvent): void {
    event.preventDefault();
    this.captureSelection();
  }

  protected touchEditor(): void {
    this.onTouched();
  }

  private restoreSelection(): void {
    const selection = window.getSelection();
    if (this.savedSelection && selection) {
      selection.removeAllRanges();
      selection.addRange(this.savedSelection);
      this.savedSelection = null;
    }
  }

  private updateEditorContent(): void {
    if (this.editor) {
      this.editor.nativeElement.innerHTML =
        this.sanitizer.sanitize(SecurityContext.HTML, this.value) ?? '';
      this.editor.nativeElement.contentEditable = String(!this.disabled);
    }
  }
}
