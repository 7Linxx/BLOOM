import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CycleService } from '../../Core/Services/cycle.service';

interface UserProfile {
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  apodo: string;
  fechaNacimiento: string;
  email: string;
  pesoKg: number | null;
  alturaCm: number | null;
}

interface PrivacyPreferences {
  flow: boolean;
  symptoms: boolean;
  sexualActivity: boolean;
  notes: boolean;
  mood: boolean;
  temperature: boolean;
  weight: boolean;
  contraceptiveMethod: boolean;
}

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css'
})
export class Perfil {
  private readonly cycleService = inject(CycleService);

  private readonly profileKey = 'bloom_user_profile';
  private readonly privacyKey = 'bloom_privacy_preferences';

  profile: UserProfile = this.emptyProfile();

  privacy: PrivacyPreferences = {
    flow: false,
    symptoms: false,
    sexualActivity: false,
    notes: false,
    mood: false,
    temperature: false,
    weight: false,
    contraceptiveMethod: false
  };

  useFixedCycleRanges = false;
  settingsExpanded = false;
  editing = false;
  savedMessage = '';
  errorMessage = '';

  constructor() {
    this.loadProfile();
    this.loadPrivacy();
    this.useFixedCycleRanges = this.cycleService.useFixedCycleRanges();
  }

  get displayName(): string {
    return this.profile.apodo.trim() ||
      this.profile.primerNombre.trim() ||
      'Tu perfil';
  }

  get fullName(): string {
    return [
      this.profile.primerNombre,
      this.profile.segundoNombre,
      this.profile.primerApellido,
      this.profile.segundoApellido
    ].filter(Boolean).join(' ') || 'Completa tu información personal';
  }

  get initials(): string {
    const name = this.displayName.trim();

    return name
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  }

  get age(): number | null {
    if (!this.profile.fechaNacimiento) {
      return null;
    }

    const birthDate = new Date(`${this.profile.fechaNacimiento}T00:00:00`);
    const today = new Date();

    if (Number.isNaN(birthDate.getTime()) || birthDate > today) {
      return null;
    }

    let age = today.getFullYear() - birthDate.getFullYear();

    const hasHadBirthday =
      today.getMonth() > birthDate.getMonth() ||
      (
        today.getMonth() === birthDate.getMonth() &&
        today.getDate() >= birthDate.getDate()
      );

    if (!hasHadBirthday) {
      age--;
    }

    return age;
  }

  get fixedCycleLength(): number {
    return this.cycleService.cycleLength();
  }

  get estimatedCycleLength(): number {
    return this.cycleService.getEstimatedCycleLength(
      this.cycleService.getPeriodStarts()
    );
  }

  get predictionDescription(): string {
    return this.useFixedCycleRanges
      ? 'BLOOM utilizará la duración fija configurada en tu registro.'
      : 'BLOOM calculará la duración usando tus últimas menstruaciones registradas.';
  }

  get privacyItems(): {
    key: keyof PrivacyPreferences;
    title: string;
    description: string;
  }[] {
    return [
      {
        key: 'flow',
        title: 'Tipo e intensidad del flujo',
        description: 'Información sobre tu menstruación y su intensidad.'
      },
      {
        key: 'symptoms',
        title: 'Síntomas',
        description: 'Síntomas físicos y molestias que hayas registrado.'
      },
      {
        key: 'sexualActivity',
        title: 'Actividad sexual',
        description: 'Información sobre actividad sexual registrada.'
      },
      {
        key: 'notes',
        title: 'Notas personales',
        description: 'Notas y observaciones de tu diario.'
      },
      {
        key: 'mood',
        title: 'Estado de ánimo',
        description: 'Estados de ánimo registrados diariamente.'
      },
      {
        key: 'temperature',
        title: 'Temperatura',
        description: 'Mediciones de temperatura que hayas guardado.'
      },
      {
        key: 'weight',
        title: 'Peso',
        description: 'Datos de peso registrados en tu perfil o diario.'
      },
      {
        key: 'contraceptiveMethod',
        title: 'Método anticonceptivo',
        description: 'Métodos anticonceptivos registrados.'
      }
    ];
  }

  saveProfile(): void {
    this.errorMessage = '';
    this.savedMessage = '';

    const nickname = this.profile.apodo.trim();

    if (nickname.length > 30) {
      this.errorMessage = 'El apodo no puede superar los 30 caracteres.';
      return;
    }

    if (
      this.profile.pesoKg !== null &&
      (this.profile.pesoKg <= 0 || this.profile.pesoKg > 500)
    ) {
      this.errorMessage = 'Ingresa un peso válido.';
      return;
    }

    if (
      this.profile.alturaCm !== null &&
      (this.profile.alturaCm < 50 || this.profile.alturaCm > 250)
    ) {
      this.errorMessage = 'Ingresa una altura válida entre 50 y 250 cm.';
      return;
    }

    if (
      this.profile.fechaNacimiento &&
      new Date(`${this.profile.fechaNacimiento}T00:00:00`) > new Date()
    ) {
      this.errorMessage = 'La fecha de nacimiento no puede ser futura.';
      return;
    }

    try {
      localStorage.setItem(
        this.profileKey,
        JSON.stringify(this.profile)
      );

      if (this.profile.pesoKg !== null) {
        this.cycleService.setInitialWeight(this.profile.pesoKg);
      }

      this.savedMessage = 'Tu información se guardó correctamente. ♡';
      this.editing = false;
    } catch {
      this.errorMessage = 'No fue posible guardar los cambios.';
    }
  }

  editProfile(): void {
    this.editing = true;
    this.savedMessage = '';
    this.errorMessage = '';
  }

  cancelEditing(): void {
    this.loadProfile();
    this.editing = false;
    this.savedMessage = '';
    this.errorMessage = '';
  }

  changePredictionPreference(value: boolean): void {
    this.useFixedCycleRanges = value;

    this.cycleService.setFixedCycleRanges(value);

    this.savedMessage = 'Tu preferencia de predicción se actualizó. ♡';
    this.errorMessage = '';
  }

  toggleSettings(): void {
    this.settingsExpanded = !this.settingsExpanded;
  }

  savePrivacyPreferences(): void {
    try {
      localStorage.setItem(
        this.privacyKey,
        JSON.stringify(this.privacy)
      );

      this.savedMessage = 'Tus preferencias de privacidad se guardaron. ♡';
      this.errorMessage = '';
    } catch {
      this.errorMessage = 'No fue posible guardar tus preferencias.';
    }
  }

  private loadProfile(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const saved = localStorage.getItem(this.profileKey);

      if (saved) {
        this.profile = {
          ...this.emptyProfile(),
          ...JSON.parse(saved)
        };
      } else {
        this.profile = this.emptyProfile();
      }
    } catch {
      this.profile = this.emptyProfile();
    }
  }

  private loadPrivacy(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const saved = localStorage.getItem(this.privacyKey);

      if (saved) {
        this.privacy = {
          ...this.privacy,
          ...JSON.parse(saved)
        };
      }
    } catch {
      this.privacy = {
        flow: false,
        symptoms: false,
        sexualActivity: false,
        notes: false,
        mood: false,
        temperature: false,
        weight: false,
        contraceptiveMethod: false
      };
    }
  }

  private emptyProfile(): UserProfile {
    return {
      primerNombre: '',
      segundoNombre: '',
      primerApellido: '',
      segundoApellido: '',
      apodo: '',
      fechaNacimiento: '',
      email: '',
      pesoKg: null,
      alturaCm: null
    };
  }
}
