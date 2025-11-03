
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { GeminiService } from './services/gemini.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  private geminiService = inject(GeminiService);

  originalImage = signal<string | null>(null);
  originalFile = signal<File | null>(null);
  editedImage = signal<string | null>(null);
  prompt = signal<string>('Remove the background and make it pure white for a product photo.');
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);
  fileName = signal<string | null>(null);
  
  // Example prompts for user to click
  examplePrompts = [
    'Remove the background',
    'Add a retro, vintage filter',
    'Make the image black and white',
    'Change the lighting to be dramatic and moody',
    'Add a sense of motion blur to the background'
  ];

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      if (!file.type.startsWith('image/')) {
        this.error.set('Please select a valid image file (e.g., PNG, JPG).');
        return;
      }

      this.error.set(null);
      this.originalFile.set(file);
      this.fileName.set(file.name);
      this.editedImage.set(null); // Clear previous edit

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.originalImage.set(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }
  
  onPromptChange(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.prompt.set(input.value);
  }

  setPrompt(example: string): void {
    this.prompt.set(example);
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  async generateEditedImage(): Promise<void> {
    const file = this.originalFile();
    const currentPrompt = this.prompt();

    if (!file || !currentPrompt.trim()) {
      this.error.set('Please upload an image and provide an editing instruction.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.editedImage.set(null);

    try {
      const resultImageUrl = await this.geminiService.editImage(file, currentPrompt);
      this.editedImage.set(resultImageUrl);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      this.error.set(`Generation failed: ${errorMessage}`);
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
