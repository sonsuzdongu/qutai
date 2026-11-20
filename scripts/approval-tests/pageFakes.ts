// What the real page script answers for the gate queries (src/browser/pageScript.ts), for the fake tabs in these tests:
// the gates refuse an answer of the wrong shape (src/agent/pageFacts.ts), so the fakes give whole answers.
import type { PressFacts } from '../../src/agent/outwardApproval.ts';
import type { PressContext } from '../../src/agent/pressContext.ts';

export function pressContextOf(over: Partial<PressContext> = {}): PressContext {
  return {
    label: 'Continue',
    tag: 'button',
    type: 'submit',
    role: '',
    link: false,
    toggle: false,
    switchLike: false,
    field: false,
    disabled: false,
    submitsForm: false,
    inForm: false,
    cardOnPage: false,
    payFrame: false,
    formCard: false,
    paymentChoice: false,
    checkoutPath: false,
    total: false,
    amountInLabel: false,
    inDialog: false,
    alertDialog: false,
    dialogText: '',
    dangerStyle: false,
    accountPath: false,
    signupPath: false,
    heading: '',
    formPasswords: 0,
    formNewPassword: false,
    formCurrentPassword: false,
    formContact: false,
    formFields: 0,
    text: '',
    ...over,
  };
}

/** pressComposed for a press that sends nothing the assistant typed. */
export function nothingComposed(label = 'Continue'): PressFacts {
  return { label, tag: 'button', type: 'submit', role: '', field: false, link: false, toggle: false, fields: [] };
}
