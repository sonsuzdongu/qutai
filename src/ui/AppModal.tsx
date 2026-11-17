import { Modal, type ModalProps } from 'react-native';

/**
 * iOS shows a Modal only in the orientations it lists, and React Native's default is portrait alone: opening one
 * with the phone on its side would turn the whole app back to portrait. Every Modal in Qutai is this one, which
 * allows them all (the Info.plist still limits it: no upside-down on an iPhone). Android ignores the list.
 * docs/landscape.md; `npm run test:layout` checks that no other file imports Modal from react-native.
 */
export const MODAL_ORIENTATIONS: ModalProps['supportedOrientations'] = [
  'portrait',
  'portrait-upside-down',
  'landscape-left',
  'landscape-right',
];

export function AppModal(props: ModalProps) {
  return <Modal supportedOrientations={MODAL_ORIENTATIONS} {...props} />;
}
