
import { Injectable } from '@angular/core';
import { GoogleGenAI } from "@google/genai";

declare var process: any;

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    if (typeof process === 'undefined' || !process.env?.API_KEY) {
      console.error("CRITICAL: API_KEY environment variable not found. The application will not function.");
      // In a real app, you might want to show a global error message to the user.
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // The result is "data:image/jpeg;base64,....", we need to remove the prefix.
        resolve(result.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  }

  public async editImage(file: File, userPrompt: string): Promise<string> {
    const imageBase64 = await this.fileToBase64(file);
    const mimeType = file.type;

    // Step 1: Describe the image using Gemini Vision.
    const description = await this.describeImage(imageBase64, mimeType);

    // Step 2: Create a new, detailed prompt for image generation.
    const finalPrompt = await this.createNewPrompt(description, userPrompt);
    console.log('Final generated prompt:', finalPrompt);

    // Step 3: Generate the new image using the new prompt.
    const newImageBase64 = await this.generateImage(finalPrompt, mimeType);

    return `data:${mimeType};base64,${newImageBase64}`;
  }

  private async describeImage(imageBase64: string, mimeType: string): Promise<string> {
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType,
      },
    };
    const textPart = {
      text: 'Describe this image in a photorealistic style for an image generation AI. Be descriptive about objects, colors, lighting, and the overall composition. Do not mention that you are describing an image.'
    };
    
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
      });
      return response.text;
    } catch (e) {
      console.error('Error describing image:', e);
      throw new Error('Could not analyze the uploaded image.');
    }
  }

  private async createNewPrompt(description: string, editInstruction: string): Promise<string> {
    const prompt = `Based on the following image description, create a new, detailed prompt for an image generation AI that incorporates the requested edit.

Original Description: "${description}"

Requested Edit: "${editInstruction}"

Generate a single, cohesive, and highly detailed prompt that I can pass to an image generation model. The new prompt should describe the final desired image in a photorealistic style. Only output the new prompt.`;
    
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text;
    } catch (e) {
      console.error('Error creating new prompt:', e);
      throw new Error('Could not formulate the edit request for the AI.');
    }
  }

  private async generateImage(prompt: string, originalMimeType: string): Promise<string> {
    try {
      const response = await this.ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: originalMimeType.startsWith('image/') ? originalMimeType : 'image/png',
          aspectRatio: '1:1', // For consistency in this app
        },
      });

      if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error('The AI did not return an image. The prompt may be unsafe.');
      }
      return response.generatedImages[0].image.imageBytes;
    } catch (e) {
      console.error('Error generating image:', e);
      throw new Error('Could not generate the new image. The prompt may have been rejected for safety reasons.');
    }
  }
}
