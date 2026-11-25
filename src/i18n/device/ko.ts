import type { DeviceWords } from '../deviceWords';

/** The iPad and Mac forms of the device phrases in src/i18n/ko.ts (see src/i18n/deviceWords.ts). */
export const koDevice: DeviceWords = {
  '이 휴대전화': { tablet: '이 iPad', mac: '이 Mac' },
  '이 휴대폰': { tablet: '이 iPad', mac: '이 Mac' },
  '이 휴대전화는': { tablet: '이 iPad는', mac: '이 Mac은' },
  '이 휴대전화를': { tablet: '이 iPad를', mac: '이 Mac을' },
  '이 iPhone': { tablet: '이 iPad', mac: '이 Mac' },
  '휴대전화': { tablet: 'iPad', mac: 'Mac' },
  '휴대폰': { tablet: 'iPad', mac: 'Mac' },
  '휴대전화가': { tablet: 'iPad가', mac: 'Mac이' },
  '휴대폰이': { tablet: 'iPad가', mac: 'Mac이' },
  '휴대전화로': { tablet: 'iPad로', mac: 'Mac으로' },
  '휴대전화를': { tablet: 'iPad를', mac: 'Mac을' },
  '휴대전화와': { tablet: 'iPad와', mac: 'Mac과' },
  '휴대전화#other': { tablet: '기기', mac: '기기' },
  '그 휴대전화': { tablet: '그 기기', mac: '그 기기' },
  '다른 휴대전화': { tablet: '다른 기기', mac: '다른 기기' },
  '모든 휴대전화': { tablet: '모든 기기', mac: '모든 기기' },
  '새 휴대전화': { tablet: '새 기기', mac: '새 기기' },
  '어느 휴대전화': { tablet: '어느 기기', mac: '어느 기기' },
  // On a Mac the online speech service is on from the start (src/device/voiceOnlineDefault.ts), so the promise to ask
  // first doesn't hold there.
  '이 경우 Qutai가 먼저 묻습니다.': {
    tablet: '이 경우 Qutai가 먼저 묻습니다.',
    mac: 'Mac에서는 항상 이 서비스가 사용되며, 설정 › 어시스턴트 › 음성 입력에서 끄지 않는 한 켜져 있습니다.',
  },
  'Apple의 음성 서비스를 사용하기 전에는 Qutai가 따로 묻습니다.': {
    tablet: 'Apple의 음성 서비스를 사용하기 전에는 Qutai가 따로 묻습니다.',
    mac: 'Mac에서는 Apple의 온라인 음성 서비스가 음성을 텍스트로 변환합니다. 설정 › 어시스턴트 › 음성 입력에서 끌 수 있습니다.',
  },
};
