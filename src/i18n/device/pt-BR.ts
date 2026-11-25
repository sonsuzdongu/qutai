import type { DeviceWords } from '../deviceWords';

/** The iPad and Mac forms of the device phrases in src/i18n/pt-BR.ts (see src/i18n/deviceWords.ts). */
export const ptBRDevice: DeviceWords = {
  'neste celular': { tablet: 'neste iPad', mac: 'neste Mac' },
  'Neste celular': { tablet: 'Neste iPad', mac: 'Neste Mac' },
  'neste telefone': { tablet: 'neste iPad', mac: 'neste Mac' },
  'deste celular': { tablet: 'deste iPad', mac: 'deste Mac' },
  'deste telefone': { tablet: 'deste iPad', mac: 'deste Mac' },
  'Este celular': { tablet: 'Este iPad', mac: 'Este Mac' },
  'no celular': { tablet: 'no iPad', mac: 'no Mac' },
  'no próprio celular': { tablet: 'no próprio iPad', mac: 'no próprio Mac' },
  'do celular': { tablet: 'do iPad', mac: 'do Mac' },
  'do próprio celular': { tablet: 'do próprio iPad', mac: 'do próprio Mac' },
  'do telefone': { tablet: 'do iPad', mac: 'do Mac' },
  'o celular': { tablet: 'o iPad', mac: 'o Mac' },
  'O celular': { tablet: 'O iPad', mac: 'O Mac' },
  'o próprio celular': { tablet: 'o próprio iPad', mac: 'o próprio Mac' },
  'o telefone': { tablet: 'o iPad', mac: 'o Mac' },
  'seu celular': { tablet: 'seu iPad', mac: 'seu Mac' },
  'seu telefone': { tablet: 'seu iPad', mac: 'seu Mac' },
  'um celular em inglês': { tablet: 'um iPad em inglês', mac: 'um Mac em inglês' },
  'no celular#other': { tablet: 'no dispositivo', mac: 'no dispositivo' },
  'nesse celular': { tablet: 'nesse dispositivo', mac: 'nesse dispositivo' },
  'outro celular': { tablet: 'outro dispositivo', mac: 'outro dispositivo' },
  'outro telefone': { tablet: 'outro dispositivo', mac: 'outro dispositivo' },
  'qualquer celular': { tablet: 'qualquer dispositivo', mac: 'qualquer dispositivo' },
  'qualquer telefone': { tablet: 'qualquer dispositivo', mac: 'qualquer dispositivo' },
  'um telefone novo': { tablet: 'um dispositivo novo', mac: 'um dispositivo novo' },
  'Todos os celulares': { tablet: 'Todos os dispositivos', mac: 'Todos os dispositivos' },
  // On a Mac the online speech service is on from the start (src/device/voiceOnlineDefault.ts), so the promise to ask
  // first doesn't hold there.
  'neste iPhone': { tablet: 'neste iPad', mac: 'neste Mac' },
  'o Qutai pergunta antes de usá-lo': {
    tablet: 'o Qutai pergunta antes de usá-lo',
    mac: 'no Mac isso sempre acontece, e ele fica ativado a menos que você o desative em Configurações › Assistente › Entrada de voz',
  },
  'Antes de o serviço de fala da Apple ser usado, o Qutai pergunta a você separadamente.': {
    tablet: 'Antes de o serviço de fala da Apple ser usado, o Qutai pergunta a você separadamente.',
    mac: 'No Mac, o serviço de fala on-line da Apple transforma sua fala em texto; você pode desativá-lo em Configurações › Assistente › Entrada de voz.',
  },
};
