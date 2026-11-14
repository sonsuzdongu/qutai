import type { Language } from '../i18n';

/**
 * Bump when the privacy policy or the terms change in substance: everyone is asked to accept
 * again on the next launch.
 */
export const LEGAL_VERSION = 1;
export const LEGAL_UPDATED = '2026-11-14';

export type LegalKind = 'privacy' | 'terms';
export type LegalDocument = { title: string; intro: string; sections: { heading: string; body: string }[] };

const DOCUMENTS: Record<Language, Record<LegalKind, LegalDocument>> = {
  en: {
    privacy: {
      title: 'Privacy Policy',
      intro:
        'Qutai is a web browser with an AI assistant. We built it so your browsing stays on your phone. ' +
        'Qutai has no servers of its own: we do not collect, store or sell your data.',
      sections: [
        {
          heading: 'What stays on your phone',
          body:
            'Your tabs, history, bookmarks, saved pages, downloads, site permissions, the assistant’s memory, ' +
            'its action history and your conversations are stored only on this device. API keys are kept in the ' +
            'phone’s encrypted storage. Incognito tabs write nothing to disk; their conversations are not saved.',
        },
        {
          heading: 'What leaves your phone, and to whom',
          body:
            '• Websites you visit receive what any browser sends them.\n' +
            '• When you use the assistant, your message and the content it needs (the page text, and screenshots ' +
            'when it looks at a page) are sent directly to the AI provider you chose (Anthropic, OpenAI or Google) ' +
            'with your own API key. If web search is on, the provider may run searches for you. Their privacy ' +
            'policies and terms apply to that data.\n' +
            '• If search suggestions are on, what you type in the address bar is sent to your search engine ' +
            '(never from incognito tabs).\n' +
            'Nothing else is sent: Qutai has no analytics, tracking or advertising.',
        },
        {
          heading: 'Passwords and payment details',
          body:
            'The assistant is told never to remember passwords or card numbers. Before it acts on a site you can ' +
            'require your confirmation, and you can block it on sites of your choice.',
        },
        {
          heading: 'Your control',
          body:
            'You can view and delete the assistant’s memory, clear history, cookies and other data in Settings, ' +
            'and remove your API keys at any time. Uninstalling Qutai deletes everything it stored.',
        },
        {
          heading: 'Children',
          body: 'Qutai is not directed at children under 13.',
        },
        {
          heading: 'Changes',
          body: 'If this policy changes, Qutai shows the new version and asks you to accept it before you continue.',
        },
      ],
    },
    terms: {
      title: 'Terms of Use',
      intro: 'By using Qutai you agree to these terms. Please read them together with the Privacy Policy.',
      sections: [
        {
          heading: 'Your AI provider and costs',
          body:
            'The assistant works with your own API key from Anthropic, OpenAI or Google. You are responsible for ' +
            'your account with that provider, its terms and every cost billed to your key.',
        },
        {
          heading: 'The assistant acts on your behalf',
          body:
            'The assistant can read pages, click, type and fill in forms when you ask it to. AI can make ' +
            'mistakes: check its answers, and review purchases, bookings, messages and other important actions ' +
            'before they are completed. You can require confirmation before every action in Settings.',
        },
        {
          heading: 'Acceptable use',
          body:
            'Do not use Qutai to break the law, to break the terms of websites or AI providers, or to harm ' +
            'others, for example by sending spam or collecting other people’s data.',
        },
        {
          heading: 'Websites and content',
          body: 'Websites and their content belong to their owners. Qutai is not responsible for them.',
        },
        {
          heading: 'No warranty',
          body:
            'Qutai is provided “as is”, without warranties. To the extent the law allows, we are not liable for ' +
            'losses arising from its use, including actions taken by the assistant.',
        },
        {
          heading: 'Changes',
          body: 'If these terms change, Qutai shows the new version and asks you to accept it before you continue.',
        },
      ],
    },
  },
  tr: {
    privacy: {
      title: 'Gizlilik Politikası',
      intro:
        'Qutai, yapay zekâ asistanı olan bir web tarayıcısıdır. Gezinmeniz telefonunuzda kalsın diye tasarlandı. ' +
        'Qutai’nin kendi sunucusu yoktur: verilerinizi toplamayız, saklamayız, satmayız.',
      sections: [
        {
          heading: 'Telefonunuzda kalanlar',
          body:
            'Sekmeleriniz, geçmişiniz, yer imleriniz, kaydedilen sayfalar, indirilenler, site izinleri, ' +
            'asistanın hafızası, işlem geçmişi ve sohbetleriniz yalnızca bu cihazda saklanır. API anahtarları ' +
            'telefonun şifreli deposunda tutulur. Gizli sekmeler diske hiçbir şey yazmaz; sohbetleri kaydedilmez.',
        },
        {
          heading: 'Telefonunuzdan çıkanlar ve kime gittiği',
          body:
            '• Ziyaret ettiğiniz siteler, her tarayıcının gönderdiği bilgileri alır.\n' +
            '• Asistanı kullandığınızda mesajınız ve gereken içerik (sayfa metni, sayfaya baktığında ekran ' +
            'görüntüleri) kendi API anahtarınızla doğrudan seçtiğiniz yapay zekâ sağlayıcısına (Anthropic, OpenAI ' +
            'veya Google) gönderilir. Web araması açıksa sağlayıcı sizin için arama yapabilir. Bu veriler için ' +
            'sağlayıcının gizlilik politikası ve koşulları geçerlidir.\n' +
            '• Arama önerileri açıksa adres çubuğuna yazdıklarınız arama motorunuza gönderilir (gizli sekmelerden ' +
            'asla).\n' +
            'Başka hiçbir şey gönderilmez: Qutai’de analitik, izleme veya reklam yoktur.',
        },
        {
          heading: 'Şifreler ve ödeme bilgileri',
          body:
            'Asistana şifreleri ve kart numaralarını asla hatırlamaması söylenir. Bir sitede işlem yapmadan önce ' +
            'onayınızı isteyebilir, seçtiğiniz sitelerde asistanı engelleyebilirsiniz.',
        },
        {
          heading: 'Kontrol sizde',
          body:
            'Asistanın hafızasını Ayarlar’dan görüp silebilir; geçmişi, çerezleri ve diğer verileri temizleyebilir, ' +
            'API anahtarlarınızı istediğiniz an kaldırabilirsiniz. Qutai’yi kaldırmak sakladığı her şeyi siler.',
        },
        {
          heading: 'Çocuklar',
          body: 'Qutai 13 yaşından küçük çocuklara yönelik değildir.',
        },
        {
          heading: 'Değişiklikler',
          body: 'Bu politika değişirse Qutai yeni sürümü gösterir ve devam etmeden önce kabul etmenizi ister.',
        },
      ],
    },
    terms: {
      title: 'Kullanım Koşulları',
      intro: 'Qutai’yi kullanarak bu koşulları kabul etmiş olursunuz. Lütfen Gizlilik Politikası ile birlikte okuyun.',
      sections: [
        {
          heading: 'Yapay zekâ sağlayıcınız ve maliyetler',
          body:
            'Asistan, Anthropic, OpenAI veya Google’dan aldığınız kendi API anahtarınızla çalışır. O sağlayıcıdaki ' +
            'hesabınızdan, koşullarından ve anahtarınıza yansıyan her ücretten siz sorumlusunuz.',
        },
        {
          heading: 'Asistan sizin adınıza işlem yapar',
          body:
            'İstediğinizde asistan sayfaları okuyabilir, tıklayabilir, yazabilir ve form doldurabilir. Yapay zekâ ' +
            'hata yapabilir: yanıtlarını kontrol edin; satın alma, rezervasyon, mesaj ve diğer önemli işlemleri ' +
            'tamamlanmadan önce gözden geçirin. Ayarlar’dan her işlemden önce onay istenmesini seçebilirsiniz.',
        },
        {
          heading: 'Kabul edilebilir kullanım',
          body:
            'Qutai’yi yasaları, sitelerin veya yapay zekâ sağlayıcılarının koşullarını çiğnemek ya da başkalarına ' +
            'zarar vermek için (örneğin istenmeyen ileti göndermek, başkalarının verilerini toplamak) kullanmayın.',
        },
        {
          heading: 'Siteler ve içerik',
          body: 'Siteler ve içerikleri sahiplerine aittir. Qutai bunlardan sorumlu değildir.',
        },
        {
          heading: 'Garanti yoktur',
          body:
            'Qutai “olduğu gibi”, garanti olmaksızın sunulur. Yasaların izin verdiği ölçüde, asistanın yaptığı ' +
            'işlemler dahil, kullanımından doğan kayıplardan sorumlu değiliz.',
        },
        {
          heading: 'Değişiklikler',
          body: 'Bu koşullar değişirse Qutai yeni sürümü gösterir ve devam etmeden önce kabul etmenizi ister.',
        },
      ],
    },
  },
};

export function legalDocument(kind: LegalKind, language: Language): LegalDocument {
  return DOCUMENTS[language][kind];
}
