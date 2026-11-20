import type { LegalTranslation } from '../documents';

/**
 * German translation of the privacy policy and terms of both builds, machine-translated from English on 20 Nov 2026
 * and not yet reviewed by a native speaker or a lawyer. The English version prevails.
 */
export const de: LegalTranslation = {
  openSource: {
    privacy: {
      title: 'Datenschutzerklärung',
      intro:
        'Qutai ist ein Webbrowser mit einem KI-Assistenten. Wir haben ihn so gebaut, dass Ihr Surfen auf Ihrem ' +
        'Telefon bleibt. Qutai hat keine eigenen Server: Wir erheben, speichern und verkaufen Ihre Daten nicht.',
      sections: [
        {
          heading: 'Was auf Ihrem Telefon bleibt',
          body:
            'Ihre Tabs, Ihr Verlauf, Ihre Lesezeichen, gespeicherten Seiten, Downloads und Website-Berechtigungen, ' +
            'das Gedächtnis des Assistenten (einschließlich Ihrer Antworten auf die optionalen Einrichtungsfragen ' +
            'und des Adressformulars), Ihre eigenen Anweisungen, der Aktionsverlauf des Assistenten und Ihre ' +
            'Unterhaltungen werden nur auf diesem Gerät gespeichert. API-Schlüssel werden im verschlüsselten ' +
            'Speicher des Telefons aufbewahrt. Inkognito-Tabs speichern nichts auf dem Telefon außer Dateien, die Sie aus ihnen ' +
            'herunterladen; ihre Unterhaltungen werden nicht gespeichert.',
        },
        {
          heading: 'Was Ihr Telefon verlässt, und an wen',
          body:
            '• Websites, die Sie besuchen, erhalten, was jeder Browser ihnen sendet, sowie die Angaben, die der ' +
            'Assistent auf Ihren Wunsch dort eingibt (etwa Ihren Namen oder Ihre Adresse in einem Formular).\n• ' +
            'Wenn Sie den Assistenten nutzen, geht jede Anfrage mit Ihrem eigenen API-Schlüssel an den KI-Dienst, ' +
            'den Sie eingerichtet haben: direkt an Anthropic, OpenAI oder Google; an OpenRouter, das sie an den ' +
            'Anbieter des von Ihnen gewählten Modells weiterleitet; oder an einen OpenAI-kompatiblen Server, ' +
            'dessen Adresse Sie eingegeben haben. Eine Anfrage enthält Ihre Nachricht, die bisherige Unterhaltung, ' +
            'die Inhalte, die der Assistent benötigt (den Seitentext, Screenshots, wenn er sich eine Seite ' +
            'ansieht, Dateien und Bilder, die Sie anhängen, das Ergebnis eines Skripts, das Sie auf einer Seite ' +
            'zugelassen haben, und, wenn Sie nach Cookies fragen, deren Namen, Websites und Einstellungen, nie ' +
            'ihre Werte), Ihre eigenen Anweisungen und, solange das Gedächtnis eingeschaltet ist, Ihre ' +
            'Gedächtniseinträge (verborgene Einträge, etwa Ausweisnummern, nur als Bezeichnung). Ihre Kalendertermine und Ihr Standort werden nur gesendet, wenn Sie dies jedes Mal ' +
            'bestätigen, es sei denn, Sie haben dafür „Nicht mehr fragen“ gewählt (das können Sie ' +
            'unter Einstellungen › Assistent › „Ohne Nachfrage erlaubt“ rückgängig machen); in ' +
            'Unterhaltungen mit Inkognito-Tabs werden sie nie verwendet. Wenn die ' +
            'Websuche eingeschaltet ist, kann der Dienst für Sie Suchen durchführen. Für diese Daten gelten die ' +
            'Datenschutzerklärung und die Bedingungen dieses Dienstes.\n• Wenn Suchvorschläge eingeschaltet sind, ' +
            'wird das, was Sie in die Adressleiste eingeben, an Ihre Suchmaschine gesendet (nie aus ' +
            'Inkognito-Tabs).\n• Wenn Sie bei der Einrichtung auf „Meinen Standort verwenden“ tippen, wird Ihre ' +
            'ungefähre Position an den Adressdienst des Telefons gesendet (auf einem iPhone an den von Apple, auf ' +
            'Android meist an den von Google), um den Namen des Ortes zu ermitteln. Nur der Ortsname wird ' +
            'gespeichert.\n• Wenn Sie mit dem Assistenten sprechen und das Telefon diese Sprache nicht auf dem ' +
            'Gerät selbst erkennen kann, geht die Audioaufnahme an den Sprachdienst des Telefons (den von Apple ' +
            'oder Google), und zwar nur, nachdem Sie einmal in Qutai zugestimmt haben, und nie in Unterhaltungen ' +
            'mit Inkognito-Tabs. Qutai und der KI-Dienst erhalten nur den Text.\n• Wenn der Assistent Ihnen ' +
            'Optionen als Karten zeigt, werden deren Bilder von den Websites (oder deren Bildservern) geladen, die ' +
            'sie zeigen, ohne Ihre Cookies, auch für Optionen, die Sie nicht öffnen; in Unterhaltungen mit ' +
            'Inkognito-Tabs nur, wenn Sie auf „Bilder anzeigen“ tippen.\n• Solange „Werbung und Tracker ' +
            'blockieren“ eingeschaltet ist, werden die von Ihnen gewählten Filterlisten von ihren Herausgebern ' +
            '(etwa EasyList und AdGuard) heruntergeladen und alle paar Tage aktualisiert. Diese Anfragen enthalten ' +
            'nichts über Ihr Surfen.\nSonst wird nichts gesendet: Qutai enthält keine Analysen, kein Tracking und ' +
            'keine Werbung.',
        },
        {
          heading: 'Ihre Kontakte',
          body:
            'Wenn Sie es erlauben, kann der Assistent eine Person, die Sie nennen (zum Beispiel „Ruf Thomas an“), ' +
            'in den Kontakten Ihres Telefons finden. Qutai sucht nur nach Namen, die Sie selbst nennen, und zwar ' +
            'auf Ihrem Telefon; Ihr Adressbuch wird nie hochgeladen oder aufgelistet. Der KI-Dienst erhält nur die ' +
            'passenden Namen und die Art der Nummern oder Adressen, die jeweils vorhanden sind (etwa „Mobil“ oder ' +
            '„E-Mail (Arbeit)“), nie die Nummern oder Adressen selbst: Diese sehen Sie auf der Schaltfläche oder ' +
            'im Entwurf, und Sie rufen selbst an oder senden selbst. Nummern und Adressen aus Ihren Kontakten ' +
            'werden nicht mit Ihren Unterhaltungen, dem Gedächtnis des Assistenten oder Ihren Backups gespeichert. ' +
            'In Unterhaltungen mit Inkognito-Tabs werden Kontakte nicht verwendet. Sie können die Berechtigung in ' +
            'den Einstellungen ändern.',
        },
        {
          heading: 'Passwörter und Zahlungsdaten',
          body:
            'Qutai lässt nicht zu, dass das Gedächtnis des Assistenten Passwörter, Kartennummern, ' +
            'Kartenprüfnummern, Ablaufdaten von Karten, Einmalcodes oder Kontonummern (IBAN) speichert. ' +
            'Personalausweis- und Reisepassnummern können nur unter Identität oder Reisen gespeichert werden; sie ' +
            'sind vor dem KI-Dienst verborgen, der nur eine Bezeichnung sieht, und Qutai gibt die Nummer selbst ' +
            'auf einer Website ein, nachdem Sie bestätigt haben. Bevor der Assistent Ihre gespeicherten ' +
            'persönlichen Angaben zum ersten Mal auf einer Website eingibt, fragt Qutai Sie (dies können Sie für ' +
            'jede Website ändern). Sie können außerdem verlangen, dass vor jeder Aktion Ihre Bestätigung eingeholt ' +
            'wird, und den Assistenten auf Websites Ihrer Wahl sperren.',
        },
        {
          heading: 'Ihre Kontrolle',
          body:
            'Sie können das Gedächtnis des Assistenten einsehen und löschen, Verlauf, Cookies und andere Daten in ' +
            'den Einstellungen löschen und Ihre API-Schlüssel jederzeit entfernen. Wenn Sie Qutai deinstallieren, wird alles gelöscht, was die App gespeichert hat, außer ' +
            'Dateien, die Sie außerhalb der App gespeichert haben, etwa Downloads im Download-Ordner ' +
            'von Android und Bilder, die Sie in Ihren Fotos gespeichert haben.',
        },
        {
          heading: 'Kinder',
          body: 'Qutai richtet sich nicht an Kinder unter 13 Jahren.',
        },
        {
          heading: 'Änderungen',
          body:
            'Wenn sich diese Erklärung ändert, zeigt Qutai die neue Fassung an und bittet Sie, sie zu akzeptieren, ' +
            'bevor Sie fortfahren. Weichen diese Übersetzung und die englische Fassung voneinander ab, ist die ' +
            'englische Fassung maßgeblich.',
        },
      ],
    },
    terms: {
      title: 'Nutzungsbedingungen',
      intro:
        'Mit der Nutzung von Qutai stimmen Sie diesen Bedingungen zu. Bitte lesen Sie sie zusammen mit der ' +
        'Datenschutzerklärung.',
      sections: [
        {
          heading: 'Ihr KI-Anbieter und die Kosten',
          body:
            'Der Assistent arbeitet mit Ihrem eigenen API-Schlüssel von Anthropic, OpenAI, Google oder OpenRouter ' +
            'oder mit einem OpenAI-kompatiblen Server, den Sie einrichten. Sie sind verantwortlich für Ihr Konto ' +
            'bei diesem Dienst, dessen Bedingungen und alle Kosten, die über Ihren Schlüssel abgerechnet werden.',
        },
        {
          heading: 'Der Assistent handelt in Ihrem Auftrag',
          body:
            'Der Assistent kann Seiten lesen, klicken, tippen und Formulare ausfüllen, wenn Sie ihn darum bitten. ' +
            'KI kann Fehler machen: Prüfen Sie seine Antworten, und kontrollieren Sie Käufe, Buchungen, ' +
            'Nachrichten und andere wichtige Aktionen, bevor sie abgeschlossen werden. In den Einstellungen können ' +
            'Sie festlegen, dass vor jeder Aktion eine Bestätigung erforderlich ist.',
        },
        {
          heading: 'Zulässige Nutzung',
          body:
            'Verwenden Sie Qutai nicht, um gegen Gesetze oder die Bedingungen von Websites oder KI-Anbietern zu ' +
            'verstoßen oder um anderen zu schaden, zum Beispiel durch das Versenden von Spam oder das Sammeln von ' +
            'Daten anderer Personen.',
        },
        {
          heading: 'Websites und Inhalte',
          body: 'Websites und ihre Inhalte gehören ihren Eigentümern. Qutai ist nicht für sie verantwortlich.',
        },
        {
          heading: 'Keine Gewährleistung',
          body:
            'Qutai wird „wie besehen“ und ohne Gewährleistung bereitgestellt. Soweit gesetzlich zulässig, haften ' +
            'wir nicht für Schäden, die aus seiner Nutzung entstehen, einschließlich der vom Assistenten ' +
            'ausgeführten Aktionen.',
        },
        {
          heading: 'Änderungen',
          body:
            'Wenn sich diese Bedingungen ändern, zeigt Qutai die neue Fassung an und bittet Sie, sie zu ' +
            'akzeptieren, bevor Sie fortfahren. Weichen diese Übersetzung und die englische Fassung voneinander ' +
            'ab, ist die englische Fassung maßgeblich.',
        },
      ],
    },
  },
  pro: {
    privacy: {
      title: 'Datenschutzerklärung',
      intro:
        'Qutai ist ein Webbrowser mit einem KI-Assistenten. Wir haben ihn so gebaut, dass Ihr Surfen auf Ihrem ' +
        'Telefon bleibt. Qutais eigener Server wird nur für Ihr Qutai-Konto verwendet (Anmeldung, Qutai Credits, ' +
        'Käufe in der App und Backups) und nur, wenn Sie sich dafür entscheiden. Wir verkaufen Ihre Daten nicht, ' +
        'und Qutai enthält keine Analysen, kein Tracking und keine Werbung.',
      sections: [
        {
          heading: 'Wer wir sind',
          body:
            'Qutai wird von Osman Yuksel („wir“) entwickelt, der Verantwortlicher für die in dieser Erklärung ' +
            'beschriebenen Daten ist. Bei Fragen zu Ihrem Datenschutz oder um eine Kopie oder die Löschung dessen ' +
            'zu verlangen, was Qutais Server über Sie speichert, schreiben Sie an osmanyuksel@gmail.com.',
        },
        {
          heading: 'Was auf Ihrem Telefon bleibt',
          body:
            'Ihre Tabs, Ihr Verlauf, Ihre Lesezeichen, gespeicherten Seiten, Downloads und Website-Berechtigungen, ' +
            'das Gedächtnis des Assistenten, sein Aktionsverlauf und Ihre Unterhaltungen werden nur auf diesem ' +
            'Gerät gespeichert, auch wenn Sie angemeldet sind, es sei denn, Sie sichern sie in Ihrem Qutai-Konto ' +
            '(siehe unten). API-Schlüssel und Ihre Anmeldung werden im verschlüsselten Speicher des Telefons ' +
            'aufbewahrt. Inkognito-Tabs speichern nichts auf dem Telefon außer Dateien, die Sie aus ihnen ' +
            'herunterladen; ihre Unterhaltungen werden nicht gespeichert.',
        },
        {
          heading: 'Was Ihr Telefon verlässt, und an wen',
          body:
            '• Websites, die Sie besuchen, erhalten, was jeder Browser ihnen sendet, sowie die Angaben, die der ' +
            'Assistent auf Ihren Wunsch dort eingibt (etwa Ihren Namen oder Ihre Adresse in einem Formular).\n• ' +
            'Mit Ihrem eigenen API-Schlüssel gehen Ihre Nachricht und die Inhalte, die der Assistent benötigt (der ' +
            'Seitentext, Screenshots, wenn er sich eine Seite ansieht, Dateien und Bilder, die Sie anhängen, das ' +
            'Ergebnis eines Skripts, das Sie auf einer Seite zugelassen haben, wenn Sie nach Cookies fragen, deren ' +
            'Namen, Websites und Einstellungen, aber nie ihre Werte, Ihr Gedächtnis und Ihre eigenen Anweisungen), ' +
            'direkt an den von Ihnen gewählten KI-Anbieter (Anthropic, OpenAI, Google, OpenRouter oder Ihren ' +
            'eigenen Server). Qutais Server ist nicht beteiligt. Ihre Kalendertermine und Ihr Standort werden nur gesendet, wenn Sie dies jedes Mal ' +
            'bestätigen, es sei denn, Sie haben dafür „Nicht mehr fragen“ gewählt (das können Sie ' +
            'unter Einstellungen › Assistent › „Ohne Nachfrage erlaubt“ rückgängig machen); in ' +
            'Unterhaltungen mit Inkognito-Tabs werden sie nie verwendet.\n• Mit Qutai Credits gehen dieselben Inhalte zuerst an ' +
            'Qutais Server, der sie unter Qutais eigenem Konto an den KI-Anbieter (Anthropic, OpenAI oder Google) ' +
            'weiterleitet und die Antwort zurücksendet. Qutais Server speichert oder protokolliert diese Inhalte ' +
            'nicht. Die App fragt nach, bevor Sie Qutai Credits zum ersten Mal verwenden.\n• Wenn die Websuche ' +
            'eingeschaltet ist, kann der KI-Anbieter für Sie Suchen durchführen. Für das, was die Anbieter ' +
            'erhalten, gelten deren Datenschutzerklärungen und Bedingungen.\n• Wenn Suchvorschläge eingeschaltet ' +
            'sind, wird das, was Sie in die Adressleiste eingeben, an Ihre Suchmaschine gesendet (nie aus ' +
            'Inkognito-Tabs).\n• Wenn Sie bei der Einrichtung auf „Meinen Standort verwenden“ tippen, wird Ihre ' +
            'ungefähre Position an den Adressdienst des Telefons gesendet (auf einem iPhone an den von Apple, auf ' +
            'Android meist an den von Google), um den Namen des Ortes zu ermitteln. Nur der Ortsname wird ' +
            'gespeichert.\n• Wenn Sie mit dem Assistenten sprechen und das Telefon diese Sprache nicht auf dem ' +
            'Gerät selbst erkennen kann, geht die Audioaufnahme an den Sprachdienst des Telefons (den von Apple ' +
            'oder Google), und zwar nur, nachdem Sie einmal in Qutai zugestimmt haben, und nie in Unterhaltungen ' +
            'mit Inkognito-Tabs. Qutai und der KI-Dienst erhalten nur den Text.\n• Wenn der Assistent Ihnen ' +
            'Optionen als Karten zeigt, werden deren Bilder von den Websites (oder deren Bildservern) geladen, die ' +
            'sie zeigen, ohne Ihre Cookies, auch für Optionen, die Sie nicht öffnen; in Unterhaltungen mit ' +
            'Inkognito-Tabs nur, wenn Sie auf „Bilder anzeigen“ tippen.\n• Solange „Werbung und Tracker ' +
            'blockieren“ eingeschaltet ist, werden die von Ihnen gewählten Filterlisten von ihren Herausgebern ' +
            '(etwa EasyList und AdGuard) heruntergeladen und alle paar Tage aktualisiert. Diese Anfragen enthalten ' +
            'nichts über Ihr Surfen.',
        },
        {
          heading: 'Ihr Qutai-Konto',
          body:
            'Ein Konto ist freiwillig; Sie benötigen es nur für Qutai Credits, Käufe in der App und Backups in ' +
            'Ihrem Konto. Sie melden sich mit Apple, mit Google oder mit Ihrer E-Mail-Adresse an. Bei E-Mail ' +
            'senden wir über unseren E-Mail-Dienst (Mailjet) eine Nachricht mit einem Einmalcode und einem Link an ' +
            'die von Ihnen eingegebene Adresse; der Code gilt 10 Minuten und nur auf dem Telefon, das ihn ' +
            'angefordert hat, und um Missbrauch zu verhindern, zählt der Server, wie viele Codes an jede Adresse ' +
            'und jedes Telefon gesendet werden. Qutais Server speichert: eine Kontonummer; die Anmeldemethoden des ' +
            'Kontos (Apple, Google, E-Mail) und die zugehörigen E-Mail-Adressen (bei Apple kann dies eine private ' +
            'Relay-Adresse sein); wann das Konto erstellt und zuletzt verwendet wurde; Ihre angemeldeten Geräte ' +
            '(eine zufällige Geräte-ID, nicht die Kennungen Ihres Telefons); und Ihre Credits: das Guthaben, Käufe ' +
            'und gutgeschriebene Credits sowie für jede Anfrage an den Assistenten das Modell, die Anzahl der ' +
            'Tokens, die Kosten und den Zeitpunkt. Ihre Nachrichten, Seiten oder Antworten speichert er nicht.',
        },
        {
          heading: 'Backups in Ihrem Qutai-Konto',
          body:
            'Nur wenn Sie es wählen (Einstellungen › Backup), speichert Qutais Server Ihre Backup-Datei: dieselben ' +
            'Daten wie ein Backup, das Sie exportieren (Lesezeichen, Verlauf, das Gedächtnis des Assistenten, ' +
            'gespeicherte Aufgaben, Website-Einstellungen und Präferenzen; offene Tabs, Unterhaltungen, ' +
            'Aktivitäten und KI-Schlüssel nur, wenn Sie sie einschließen). Sie wird auf Ihrem Telefon mit einem ' +
            'von Ihnen gewählten Passwort verschlüsselt, bevor sie gesendet wird; Qutai kann sie nicht lesen und ' +
            'das Passwort nicht wiederherstellen, das nur auf Ihrem Telefon gespeichert ist. Mit jedem Backup ' +
            'speichert der Server außerdem, wann es erstellt wurde, seine Größe, die App-Version und die Art des ' +
            'Telefons (zum Beispiel „iPhone · iOS 26“). Die neuesten Backups werden aufbewahrt (derzeit 3), ältere ' +
            'werden gelöscht; Sie können sie jederzeit löschen, und wenn Sie Ihr Konto löschen, werden sie ' +
            'mitgelöscht.',
        },
        {
          heading: 'Käufe in der App',
          body:
            'Qutai Credits und alles andere, was in der App verkauft wird, werden über den App Store oder Google ' +
            'Play gekauft; Ihre Zahlungsdaten bleiben bei Apple oder Google und erreichen Qutai nie. Ein ' +
            'Zahlungsdienst (RevenueCat) erhält Ihre Qutai-Kontonummer und den Kaufbeleg des Stores, damit der ' +
            'Kauf bestätigt, Ihrem Konto gutgeschrieben und auf einem anderen Telefon wiederhergestellt werden ' +
            'kann. Qutai speichert zu jedem Kauf einen Datensatz (Store, Transaktion, Produkt, Credits, gezahlter ' +
            'Preis und Daten), den wir nach Steuerrecht aufbewahren müssen, auch nach der Löschung des Kontos, ' +
            'dann ohne Verbindung zu Ihnen. Erstattungen werden von Apple oder Google nach deren eigenen Regeln ' +
            'abgewickelt.',
        },
        {
          heading: 'Qutais Server und wer sonst Daten verarbeitet',
          body:
            'Qutais Server läuft auf Cloudflare, wo auch die Backups gespeichert werden. Wie jeder Server sieht er ' +
            'bei jeder Anfrage Ihre IP-Adresse; er verwendet sie nur, um zu begrenzen, wie viele Anfragen gestellt ' +
            'werden können, und Qutais eigene Protokolle enthalten nie Ihre IP-Adresse, E-Mail-Adresse, ' +
            'Nachrichten, Seiten oder Anmelde-Tokens (sie enthalten eine Anfrage-ID, Ihre Kontonummer, was ' +
            'angefordert wurde, wie lange es gedauert hat und, bei Anfragen an den Assistenten, das Modell, die ' +
            'Tokens und die Kosten). Die Unternehmen, die Daten für Qutai verarbeiten, ' +
            'jeweils nach ihrer eigenen Datenschutzerklärung, sind: Cloudflare (der Server), Apple und Google ' +
            '(Anmeldung und die Stores), Mailjet (Anmelde-E-Mails), RevenueCat (Käufe) und, bei Qutai Credits, ' +
            'Anthropic, OpenAI und Google (die KI). Wir geben Ihre Daten an niemanden sonst weiter, außer wenn das ' +
            'Gesetz es verlangt (zum Beispiel ein Gerichtsbeschluss) oder um Qutai und seine Nutzer vor Betrug und ' +
            'Missbrauch zu schützen.',
        },
        {
          heading: 'Speicherdauer',
          body:
            'Auf Ihrem Telefon: bis Sie die Daten löschen oder Qutai deinstallieren. Auf Qutais Server: Ihr Konto, ' +
            'seine Anmeldemethoden, Geräte und der Credit-Verlauf, bis Sie das Konto löschen; Backups wie oben ' +
            'beschrieben; Anmeldecodes, bis sie verwendet werden oder ablaufen; Kaufdatensätze so lange, wie das ' +
            'Steuerrecht es verlangt, nach der Löschung des Kontos ohne Verbindung zu Ihnen.',
        },
        {
          heading: 'Ihre Kontakte',
          body:
            'Wenn Sie es erlauben, kann der Assistent eine Person, die Sie nennen (zum Beispiel „Ruf Thomas an“), ' +
            'in den Kontakten Ihres Telefons finden. Qutai sucht nur nach Namen, die Sie selbst nennen, und zwar ' +
            'auf Ihrem Telefon; Ihr Adressbuch wird nie hochgeladen oder aufgelistet. Der KI-Dienst erhält nur die ' +
            'passenden Namen und die Art der Nummern oder Adressen, die jeweils vorhanden sind (etwa „Mobil“ oder ' +
            '„E-Mail (Arbeit)“), nie die Nummern oder Adressen selbst: Diese sehen Sie auf der Schaltfläche oder ' +
            'im Entwurf, und Sie rufen selbst an oder senden selbst. Nummern und Adressen aus Ihren Kontakten ' +
            'werden nicht mit Ihren Unterhaltungen, dem Gedächtnis des Assistenten oder Ihren Backups gespeichert. ' +
            'In Unterhaltungen mit Inkognito-Tabs werden Kontakte nicht verwendet. Sie können die Berechtigung in ' +
            'den Einstellungen ändern.',
        },
        {
          heading: 'Passwörter und Zahlungsdaten',
          body:
            'Qutai lässt nicht zu, dass das Gedächtnis des Assistenten Passwörter, Kartennummern, ' +
            'Kartenprüfnummern, Ablaufdaten von Karten, Einmalcodes oder Kontonummern (IBAN) speichert. ' +
            'Personalausweis- und Reisepassnummern können nur unter Identität oder Reisen gespeichert werden; sie ' +
            'sind vor dem KI-Dienst verborgen, der nur eine Bezeichnung sieht, und Qutai gibt die Nummer selbst ' +
            'auf einer Website ein, nachdem Sie bestätigt haben. Bevor der Assistent Ihre gespeicherten ' +
            'persönlichen Angaben zum ersten Mal auf einer Website eingibt, fragt Qutai Sie (dies können Sie für ' +
            'jede Website ändern). Sie können außerdem verlangen, dass vor jeder Aktion Ihre Bestätigung eingeholt ' +
            'wird, und den Assistenten auf Websites Ihrer Wahl sperren.',
        },
        {
          heading: 'Ihre Kontrolle',
          body:
            'Sie können das Gedächtnis des Assistenten einsehen und löschen, Verlauf, Cookies und andere Daten in ' +
            'den Einstellungen löschen und Ihre API-Schlüssel jederzeit entfernen. Ihre Backups auf Qutais Server ' +
            'können Sie unter Einstellungen › Backup löschen. Unter Einstellungen › Konto können Sie die Nutzung ' +
            'von Qutai Credits beenden, sich abmelden oder Ihr Konto löschen: Dadurch werden das Konto, sein ' +
            'Guthaben und sein Verlauf von Qutais Server entfernt (Kaufdatensätze bleiben ohne Verbindung zu Ihnen ' +
            'erhalten, wie oben beschrieben), und der Zahlungsdienst wird gebeten, seinen Datensatz über Sie zu ' +
            'löschen. Sie können auch an osmanyuksel@gmail.com schreiben, um eine Kopie dessen, was Qutais Server ' +
            'über Sie speichert (Auskunft), oder dessen Berichtigung oder Löschung zu verlangen. Wenn Sie Qutai deinstallieren, wird alles gelöscht, was die App auf dem Telefon ' +
            'gespeichert hat, außer Dateien, die Sie außerhalb der App gespeichert haben, etwa ' +
            'Downloads im Download-Ordner von Android und Bilder, die Sie in Ihren Fotos gespeichert ' +
            'haben.',
        },
        {
          heading: 'Sicherheit',
          body:
            'Verbindungen zu Qutais Server verwenden HTTPS. Anmelde-Tokens werden auf dem Server nur in gehashter ' +
            'Form und auf Ihrem Telefon in dessen verschlüsseltem Speicher aufbewahrt, und Backups werden auf ' +
            'Ihrem Telefon verschlüsselt, bevor sie gesendet werden.',
        },
        {
          heading: 'Kinder',
          body:
            'Qutai richtet sich nicht an Kinder unter 13 Jahren, und wir erheben wissentlich keine Daten von ' +
            'ihnen. In manchen Ländern müssen Sie älter sein (zum Beispiel 16), um selbst in diese Erklärung ' +
            'einzuwilligen; unterhalb dieses Alters muss ein Elternteil oder Erziehungsberechtigter für Sie ' +
            'einwilligen.',
        },
        {
          heading: 'Änderungen',
          body:
            'Wenn sich diese Erklärung ändert, zeigt Qutai die neue Fassung an und bittet Sie, sie zu akzeptieren, ' +
            'bevor Sie fortfahren. Weichen diese Übersetzung und die englische Fassung voneinander ab, ist die ' +
            'englische Fassung maßgeblich.',
        },
      ],
    },
    terms: {
      title: 'Nutzungsbedingungen',
      intro:
        'Mit der Nutzung von Qutai stimmen Sie diesen Bedingungen zu. Bitte lesen Sie sie zusammen mit der ' +
        'Datenschutzerklärung.',
      sections: [
        {
          heading: 'Zwei Wege, den Assistenten zu nutzen',
          body:
            '• Ihr eigener API-Schlüssel: Sie sind verantwortlich für Ihr Konto bei diesem Anbieter, dessen ' +
            'Bedingungen und alle Kosten, die über Ihren Schlüssel abgerechnet werden.\n• Qutai Credits: Die ' +
            'Anfragen des Assistenten laufen über Qutais Server und werden mit Credits aus Ihrem Qutai-Konto ' +
            'bezahlt. Um sie zu nutzen, benötigen Sie ein Konto.',
        },
        {
          heading: 'Qutai Credits',
          body:
            'Credits werden in der App über den App Store oder Google Play zu dem vom Store angezeigten Preis ' +
            'gekauft und Ihrem Qutai-Konto gutgeschrieben, sobald der Kauf bestätigt ist. Mit ihnen werden nur die ' +
            'Anfragen des Assistenten in Qutai bezahlt, zu den für jedes Modell angezeigten Credit-Preisen; was ' +
            'jede Antwort gekostet hat, wird darunter angezeigt. Eine Anfrage reserviert zunächst den ' +
            'Höchstbetrag, den sie kosten könnte, und gibt zurück, was sie nicht verbraucht hat. Credits gehören ' +
            'zu Ihrem Qutai-Konto, können auf jedem Telefon verwendet werden, auf dem Sie sich anmelden, können ' +
            'nicht übertragen oder in Geld umgetauscht werden und werden nicht erstattet, außer wenn das Gesetz ' +
            'oder die Erstattungsregeln des Stores dies verlangen; Erstattungen werden von Apple oder Google ' +
            'abgewickelt. Wird ein Kauf erstattet, werden seine Credits zurückgebucht, wodurch das Guthaben ' +
            'negativ werden kann, bis Sie es aufladen. Modelle, Credit-Preise und Limits können sich ändern; die ' +
            'aktuellen werden in der App angezeigt, bevor Sie sie verwenden. Qutai Credits können für ' +
            'Wartungsarbeiten pausiert werden oder zeitweise nicht verfügbar sein.',
        },
        {
          heading: 'Ihr Konto',
          body:
            'Halten Sie Ihre Anmeldung (Apple, Google oder Ihre E-Mail) sicher; was mit Ihrem Konto geschieht, ' +
            'liegt in Ihrer Verantwortung. Wir können ein Konto sperren, das gegen diese Bedingungen verstößt. ' +
            'Wenn Sie Ihr Konto löschen, verfallen die verbleibenden Credits.',
        },
        {
          heading: 'Der Assistent handelt in Ihrem Auftrag',
          body:
            'Der Assistent kann Seiten lesen, klicken, tippen und Formulare ausfüllen, wenn Sie ihn darum bitten. ' +
            'KI kann Fehler machen: Prüfen Sie seine Antworten, und kontrollieren Sie Käufe, Buchungen, ' +
            'Nachrichten und andere wichtige Aktionen, bevor sie abgeschlossen werden. In den Einstellungen können ' +
            'Sie festlegen, dass vor jeder Aktion eine Bestätigung erforderlich ist.',
        },
        {
          heading: 'Zulässige Nutzung',
          body:
            'Verwenden Sie Qutai oder Qutai Credits nicht, um gegen Gesetze oder die Bedingungen von Websites oder ' +
            'KI-Anbietern zu verstoßen, um anderen zu schaden (zum Beispiel durch das Versenden von Spam oder das ' +
            'Sammeln von Daten anderer Personen) oder um Qutais Server zu missbrauchen oder zu überlasten.',
        },
        {
          heading: 'Websites und Inhalte',
          body: 'Websites und ihre Inhalte gehören ihren Eigentümern. Qutai ist nicht für sie verantwortlich.',
        },
        {
          heading: 'Keine Gewährleistung',
          body:
            'Qutai wird „wie besehen“ und ohne Gewährleistung bereitgestellt. Soweit gesetzlich zulässig, haften ' +
            'wir nicht für Schäden, die aus seiner Nutzung entstehen, einschließlich der vom Assistenten ' +
            'ausgeführten Aktionen.',
        },
        {
          heading: 'Änderungen',
          body:
            'Wenn sich diese Bedingungen ändern, zeigt Qutai die neue Fassung an und bittet Sie, sie zu ' +
            'akzeptieren, bevor Sie fortfahren. Weichen diese Übersetzung und die englische Fassung voneinander ' +
            'ab, ist die englische Fassung maßgeblich.',
        },
      ],
    },
  },
};
