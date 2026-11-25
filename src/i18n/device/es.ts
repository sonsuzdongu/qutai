import type { DeviceWords } from '../deviceWords';

/** The iPad and Mac forms of the device phrases in src/i18n/es.ts (see src/i18n/deviceWords.ts). */
export const esDevice: DeviceWords = {
  'este teléfono': { tablet: 'este iPad', mac: 'este Mac' },
  'Este teléfono': { tablet: 'Este iPad', mac: 'Este Mac' },
  'este iPhone': { tablet: 'este iPad', mac: 'este Mac' },
  'el teléfono': { tablet: 'el iPad', mac: 'el Mac' },
  'El teléfono': { tablet: 'El iPad', mac: 'El Mac' },
  'el propio teléfono': { tablet: 'el propio iPad', mac: 'el propio Mac' },
  'del teléfono': { tablet: 'del iPad', mac: 'del Mac' },
  'tu teléfono': { tablet: 'tu iPad', mac: 'tu Mac' },
  'su teléfono': { tablet: 'su iPad', mac: 'su Mac' },
  'el teléfono#other': { tablet: 'el dispositivo', mac: 'el dispositivo' },
  'ese teléfono': { tablet: 'ese dispositivo', mac: 'ese dispositivo' },
  'otro teléfono': { tablet: 'otro dispositivo', mac: 'otro dispositivo' },
  'cualquier teléfono': { tablet: 'cualquier dispositivo', mac: 'cualquier dispositivo' },
  'un teléfono nuevo': { tablet: 'un dispositivo nuevo', mac: 'un dispositivo nuevo' },
  'todos los teléfonos': { tablet: 'todos los dispositivos', mac: 'todos los dispositivos' },
  'un teléfono en inglés': { tablet: 'un iPad configurado en inglés', mac: 'un Mac configurado en inglés' },
  // On a Mac the online speech service is on from the start (src/device/voiceOnlineDefault.ts), so the promise to ask
  // first doesn't hold there.
  'Qutai te pregunta antes de usarlo': {
    tablet: 'Qutai te pregunta antes de usarlo',
    mac: 'en un Mac siempre es así, y está activado salvo que lo desactives en Configuración › Asistente › Entrada de voz',
  },
  'Antes de usar el servicio de voz de Apple, Qutai te lo pregunta aparte.': {
    tablet: 'Antes de usar el servicio de voz de Apple, Qutai te lo pregunta aparte.',
    mac: 'En un Mac, el servicio de voz en línea de Apple convierte tu voz en texto; puedes desactivarlo en Configuración › Asistente › Entrada de voz.',
  },
};
