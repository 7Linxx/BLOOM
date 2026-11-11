import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { BloomApi, mensajeDeError } from '../../Core/Services/bloom-api.service';
import { Sesion } from '../../Core/Services/sesion.service';
import { Usuaria } from '../../Core/modelos';

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

interface CycleSettings {
  horasSueno: number | null;
  duracionCiclo: number | null;
  duracionMenstruacion: number | null;
}

interface PrivacyPreferences {
  flow: boolean;
  symptoms: boolean;
  emotions: boolean;
  sexualActivity: boolean;
  notes: boolean;
  weight: boolean;
}

interface FormMessage {
  tipo: 'ok' | 'error';
  texto: string;
}

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css'
})
export class Perfil {
  private readonly api = inject(BloomApi);
  private readonly sesion = inject(Sesion);
  private readonly router = inject(Router);

  // Las preferencias de privacidad NO existen en el backend: se siguen guardando solo en este navegador.
  private readonly privacyKey = 'bloom_privacy_preferences';

  private original: UserProfile = this.emptyProfile();

  private duracionFija: number | null = null;

  private duracionEstimada: number | null = null;

  profile: UserProfile = this.emptyProfile();

  cycleSettings: CycleSettings = this.emptyCycleSettings();
  private originalCycleSettings: CycleSettings = this.emptyCycleSettings();
  cycleSettingsMessage: FormMessage | null = null;

  privacy: PrivacyPreferences = this.emptyPrivacy();

  passwordForm = { actual: '', nueva: '', confirmar: '' };
  passwordMessage: FormMessage | null = null;
  changingPassword = false;

  deleteStep: 'closed' | 'confirm' = 'closed';
  deleteText = '';
  deleteMessage: FormMessage | null = null;
  deletingAccount = false;

  useFixedCycleRanges = false;
  settingsExpanded = false;
  editing = false;
  savedMessage = '';
  errorMessage = '';

  constructor() {
    this.loadProfile();
    this.loadPrivacy();
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

  get fixedCycleLength(): number | string {
    return this.duracionFija ?? '—';
  }

  get estimatedCycleLength(): number | string {
    return this.duracionEstimada ?? '—';
  }

  get predictionDescription(): string {
    return this.useFixedCycleRanges
      ? 'BLOOM utilizará la duración fija configurada en tu registro.'
      : 'BLOOM calculará la duración usando tus últimas menstruaciones registradas.';
  }

  get canDeleteAccount(): boolean {
    return this.deleteText.trim().toUpperCase() === 'ELIMINAR' && !this.deletingAccount;
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
        key: 'emotions',
        title: 'Emociones',
        description: 'Emociones que hayas registrado en tu diario.'
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
        key: 'weight',
        title: 'Peso',
        description: 'Dato de peso registrado en tu perfil.'
      }
    ];
  }

  async saveProfile(): Promise<void> {
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

    try {
      await this.api.actualizarAjustes(this.sesion.idUsuario, {
        apodo: nickname || null,
        peso: this.profile.pesoKg,
        // La altura se edita en cm y el backend la guarda en metros.
        altura: this.profile.alturaCm !== null ? this.profile.alturaCm / 100 : null,
      });
      this.sesion.actualizar({ apodo: nickname || this.original.apodo });

      await this.loadProfile();
      this.savedMessage = 'Tu información se guardó correctamente. ♡';
      this.editing = false;
    } catch (error) {
      this.errorMessage = mensajeDeError(error, 'No fue posible guardar los cambios.');
    }
  }

  editProfile(): void {
    this.editing = true;
    this.savedMessage = '';
    this.errorMessage = '';
  }

  cancelEditing(): void {
    this.profile = { ...this.original };
    this.editing = false;
    this.savedMessage = '';
    this.errorMessage = '';
  }

  async saveCycleSettings(): Promise<void> {
    this.cycleSettingsMessage = null;

    const { horasSueno, duracionCiclo, duracionMenstruacion } = this.cycleSettings;

    if (horasSueno !== null && (horasSueno < 0 || horasSueno > 24)) {
      this.cycleSettingsMessage = { tipo: 'error', texto: 'Las horas de sueño deben estar entre 0 y 24.' };
      return;
    }

    if (duracionCiclo !== null && (duracionCiclo < 15 || duracionCiclo > 60)) {
      this.cycleSettingsMessage = { tipo: 'error', texto: 'La duración del ciclo debe estar entre 15 y 60 días.' };
      return;
    }

    if (duracionMenstruacion !== null && (duracionMenstruacion < 1 || duracionMenstruacion > 15)) {
      this.cycleSettingsMessage = { tipo: 'error', texto: 'La duración de la menstruación debe estar entre 1 y 15 días.' };
      return;
    }

    try {
      await this.api.actualizarAjustes(this.sesion.idUsuario, {
        horasSueno,
        duracionCiclo,
        duracionMenstruacion
      } as any);

      this.originalCycleSettings = { ...this.cycleSettings };
      this.duracionFija = duracionCiclo;
      this.cycleSettingsMessage = { tipo: 'ok', texto: 'Tus datos del ciclo se guardaron. ♡' };
    } catch (error) {
      this.cycleSettingsMessage = {
        tipo: 'error',
        texto: mensajeDeError(error, 'No se pudieron guardar tus datos del ciclo.')
      };
    }
  }

  resetCycleSettings(): void {
    this.cycleSettings = { ...this.originalCycleSettings };
    this.cycleSettingsMessage = null;
  }

  async changePredictionPreference(value: boolean): Promise<void> {
    this.savedMessage = '';
    this.errorMessage = '';
    try {
      await this.api.actualizarAjustes(this.sesion.idUsuario, {
        metodoCalculo: value ? 'MANUAL' : 'AUTOMATICO',
      });
      this.useFixedCycleRanges = value;
      this.sesion.actualizar({ metodoCalculo: value ? 'MANUAL' : 'AUTOMATICO' });
      this.savedMessage = 'Tu preferencia de predicción se actualizó. ♡';
    } catch (error) {
      this.useFixedCycleRanges = !value;
      this.errorMessage = mensajeDeError(error, 'No se pudo cambiar el método de predicción.');
    }
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

      this.savedMessage = 'Tus preferencias de privacidad se guardaron en este navegador. ♡';
      this.errorMessage = '';
    } catch {
      this.errorMessage = 'No fue posible guardar tus preferencias.';
    }
  }

  async changePassword(): Promise<void> {
    this.passwordMessage = null;

    const { actual, nueva, confirmar } = this.passwordForm;

    if (!actual || !nueva || !confirmar) {
      this.passwordMessage = { tipo: 'error', texto: 'Completa los tres campos.' };
      return;
    }

    if (nueva.length < 8) {
      this.passwordMessage = { tipo: 'error', texto: 'La nueva contraseña debe tener al menos 8 caracteres.' };
      return;
    }

    if (nueva === actual) {
      this.passwordMessage = { tipo: 'error', texto: 'La nueva contraseña debe ser diferente a la actual.' };
      return;
    }

    if (nueva !== confirmar) {
      this.passwordMessage = { tipo: 'error', texto: 'La confirmación no coincide con la nueva contraseña.' };
      return;
    }

    this.changingPassword = true;

    try {
      await (this.api as any).cambiarContrasenia(this.sesion.idUsuario, actual, nueva);
      this.passwordForm = { actual: '', nueva: '', confirmar: '' };
      this.passwordMessage = { tipo: 'ok', texto: 'Tu contraseña se actualizó. ♡' };
    } catch (error) {
      this.passwordMessage = {
        tipo: 'error',
        texto: mensajeDeError(error, 'No se pudo cambiar tu contraseña.')
      };
    } finally {
      this.changingPassword = false;
    }
  }

  logout(): void {
    (this.sesion as any).cerrar();
    this.router.navigate(['/']);
  }

  openDelete(): void {
    this.deleteStep = 'confirm';
    this.deleteText = '';
    this.deleteMessage = null;
  }

  cancelDelete(): void {
    this.deleteStep = 'closed';
    this.deleteText = '';
    this.deleteMessage = null;
  }

  async deleteAccount(): Promise<void> {
    if (!this.canDeleteAccount) {
      return;
    }

    this.deleteMessage = null;
    this.deletingAccount = true;

    try {
      await (this.api as any).eliminarUsuaria(this.sesion.idUsuario);

      try {
        localStorage.removeItem(this.privacyKey);
      } catch {
        // si el navegador no deja borrar, no importa: la cuenta ya no existe
      }

      this.logout();
    } catch (error) {
      this.deleteMessage = {
        tipo: 'error',
        texto: mensajeDeError(error, 'No se pudo eliminar tu cuenta.')
      };
    } finally {
      this.deletingAccount = false;
    }
  }

  private async loadProfile(): Promise<void> {
    try {
      const idUsuario = this.sesion.idUsuario;
      const usuaria = await this.api.verUsuaria(idUsuario);
      this.original = this.aPerfil(usuaria);
      this.profile = { ...this.original };

      const ajustes: any = await this.api.verAjustes(idUsuario);
      this.useFixedCycleRanges = ajustes.metodoCalculo === 'MANUAL';
      this.duracionFija = ajustes.duracionCiclo;

      this.originalCycleSettings = {
        horasSueno: ajustes.horasSueno ?? null,
        duracionCiclo: ajustes.duracionCiclo ?? null,
        duracionMenstruacion: ajustes.duracionMenstruacion ?? null
      };
      this.cycleSettings = { ...this.originalCycleSettings };

      // Duración "automática": promedio real de los ciclos (MongoDB) o, si no hay, la del ciclo actual.
      try {
        const estadistica = await this.api.verEstadisticas(idUsuario);
        this.duracionEstimada = estadistica.promedioDuracionCiclo !== null
          ? Math.round(estadistica.promedioDuracionCiclo)
          : null;
      } catch {
        this.duracionEstimada = null;
      }
      if (this.duracionEstimada === null) {
        this.duracionEstimada = (await this.api.verCicloActual(idUsuario))?.duracionEstimada ?? null;
      }
    } catch (error) {
      this.errorMessage = mensajeDeError(error, 'No se pudo cargar tu información.');
    }
  }

  private aPerfil(usuaria: Usuaria): UserProfile {
    return {
      primerNombre: usuaria.primerNombre ?? '',
      segundoNombre: usuaria.segundoNombre ?? '',
      primerApellido: usuaria.primerApellido ?? '',
      segundoApellido: usuaria.segundoApellido ?? '',
      apodo: usuaria.apodo ?? '',
      fechaNacimiento: usuaria.fechaNacimiento ?? '',
      email: usuaria.correoElectronico ?? '',
      pesoKg: usuaria.peso,
      alturaCm: usuaria.altura !== null ? Math.round(usuaria.altura * 100) : null
    };
  }

  private loadPrivacy(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const saved = localStorage.getItem(this.privacyKey);

      if (saved) {
        const data = JSON.parse(saved);
        const limpio = this.emptyPrivacy();

        // Solo se toman las opciones que existen hoy (las viejas de ánimo, temperatura y anticonceptivo se ignoran).
        for (const clave of Object.keys(limpio) as (keyof PrivacyPreferences)[]) {
          if (typeof data[clave] === 'boolean') {
            limpio[clave] = data[clave];
          }
        }

        this.privacy = limpio;
      }
    } catch {
      this.privacy = this.emptyPrivacy();
    }
  }

  private emptyPrivacy(): PrivacyPreferences {
    return {
      flow: false,
      symptoms: false,
      emotions: false,
      sexualActivity: false,
      notes: false,
      weight: false
    };
  }

  private emptyCycleSettings(): CycleSettings {
    return {
      horasSueno: null,
      duracionCiclo: null,
      duracionMenstruacion: null
    };
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
