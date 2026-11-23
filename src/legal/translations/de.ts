import type { LegalTranslation } from '../documents';

/**
 * German translation of the privacy policy and terms of both builds, machine-translated from English on 20 Nov 2026
 * and not yet reviewed by a native speaker or a lawyer. The sections added on 21 Nov 2026 (the protective
 * clauses) are machine-translated too and not reviewed either. The English version prevails.
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
            'ungefähre Position an den Adressdienst des Telefons gesendet {{ios:(den von Apple)|android:(meist den von Google)}}, um den Namen des Ortes zu ermitteln. Nur der Ortsname wird ' +
            'gespeichert.\n• Wenn Sie mit dem Assistenten sprechen und das Telefon diese Sprache nicht auf dem ' +
            'Gerät selbst erkennen kann, geht die Audioaufnahme an den Sprachdienst des Telefons {{ios:(den von Apple)|android:(meist den von Google)}}, und zwar nur, nachdem Sie einmal in Qutai zugestimmt haben, und nie in Unterhaltungen ' +
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
          heading: 'Blockieren, Seitenstile, Skripte und Apps',
          body:
            'Das Blockieren von Werbung, Trackern und Videowerbung geschieht auf Ihrem Telefon: Die Filterlisten ' +
            'werden auf das Telefon heruntergeladen (siehe oben), und die Anfragen jeder Seite werden dort mit ihnen ' +
            'abgeglichen, sodass nichts über die Seiten, die Sie besuchen, an die Herausgeber der Listen geht. ' +
            '„Cookie-Banner ausblenden“ blendet nur die Banner aus; es akzeptiert oder lehnt nie Cookies für Sie ab. ' +
            'Ihre eigenen Regeln, behaltenen Stile und behaltenen Skripte werden nur auf dem Telefon gespeichert und, ' +
            'wenn Sie eines erstellen, in Ihrer Backup-Datei, verschlüsselt mit Ihrem Passwort. Wenn der Assistent ' +
            'einen Stil oder ein Skript schreibt, erhält der KI-Dienst wie bei jeder Frage Ihre Anfrage und die ' +
            'Seiteninhalte, die er benötigt, und auch das Ergebnis eines von Ihnen zugelassenen Skripts geht an ihn; ' +
            'Qutai lehnt Skripte ab, die auf Cookies zugreifen, und das Ergebnis eines Skripts wird nie im Gedächtnis ' +
            'des Assistenten, in Backups oder im Aktionsverlauf gespeichert. Apps in Qutai werden nur auf dem Telefon ' +
            'gespeichert und, wenn Sie sie einschließen, in Ihrer Backup-Datei. Wenn Sie Qutai bitten, eine App zu ' +
            'erstellen oder zu reparieren, gehen ihr Code und ihre Fehlermeldungen an den KI-Dienst; was Sie in einer ' +
            'App speichern, nie. Apps können nicht auf das Internet zugreifen und keine Websites oder deren Cookies ' +
            'sehen.',
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
            'Dateien, die Sie außerhalb der App gespeichert haben, etwa {{ios:Dateien in der Dateien-App|android:Downloads im Download-Ordner von Android}} und Bilder, die Sie in Ihren Fotos gespeichert haben.',
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
            'oder mit einem OpenAI-kompatiblen Server, den Sie einrichten. Die Nutzung ist eine Vereinbarung zwischen ' +
            'Ihnen und diesem Dienst: Es gelten dessen Bedingungen, Datenschutzerklärung und Preise, und Sie sind ' +
            'verantwortlich für Ihr Konto dort und alle Kosten, die über Ihren Schlüssel abgerechnet werden. Qutai ' +
            'ist nicht Partei dieser Vereinbarung und kann diese Kosten nicht erstatten.',
        },
        {
          heading: 'Qutai ist ein Browser',
          body:
            'Qutai zeigt Websites an, die andere betreiben. Wir kontrollieren, prüfen oder befürworten weder Websites ' +
            'noch ihre Inhalte oder die Produkte und Dienstleistungen, die sie anbieten, und wir sind nicht für sie ' +
            'verantwortlich. Websites und ihre Inhalte gehören ihren Eigentümern. Wenn Sie eine Website nutzen, ' +
            'gelten deren eigene Bedingungen und das Gesetz, und Sie sind dafür verantwortlich, sie einzuhalten. ' +
            'Links, Suchergebnisse und Vorschläge, auch die des Assistenten, sind keine Empfehlungen von uns.',
        },
        {
          heading: 'Der Assistent handelt in Ihrem Auftrag',
          body:
            'Der Assistent kann Seiten lesen, klicken, tippen, Formulare ausfüllen und Beiträge, Nachrichten und ' +
            'Bestellungen vorbereiten, wenn Sie ihn darum bitten. Bevor er auf einer Website Text veröffentlicht oder ' +
            'absendet, bittet Qutai um Ihre Zustimmung. Das Abschließen einer Zahlung ist ausgeschaltet, bis Sie ' +
            '„Assistent darf Zahlungen abschließen“ unter Einstellungen › Assistent einschalten; auch dann muss jede ' +
            'Zahlung in Qutais eigenem Dialog, der den Gesamtbetrag zeigt, von Ihnen bestätigt werden. KI kann Fehler ' +
            'machen: Prüfen Sie, was Sie bestätigen, und kontrollieren Sie Käufe, Buchungen, Zahlungen, Beiträge, ' +
            'Nachrichten, Löschungen, Kontoänderungen und andere wichtige Aktionen, bevor sie abgeschlossen werden. ' +
            'Sie sind für die Aktionen verantwortlich, die Sie verlangen oder bestätigen, als hätten Sie sie selbst ' +
            'ausgeführt. Ihre Käufe und sonstigen Geschäfte mit Websites, Verkäufern und anderen Personen bestehen ' +
            'zwischen Ihnen und diesen: Qutai ist daran nicht beteiligt und wickelt Ihre Zahlungen an sie nie ab. In ' +
            'den Einstellungen können Sie festlegen, dass vor jeder Aktion eine Bestätigung erforderlich ist, und den ' +
            'Assistenten auf Websites Ihrer Wahl sperren.',
        },
        {
          heading: 'KI-Antworten',
          body:
            'Antworten, Zusammenfassungen, Übersetzungen und alles andere, was die KI schreibt, können falsch, ' +
            'unvollständig oder veraltet sein. Sie sind keine fachliche Beratung, etwa keine medizinische, ' +
            'rechtliche, finanzielle oder steuerliche Beratung: Wenden Sie sich in solchen Fragen an eine ' +
            'qualifizierte Fachperson. Prüfen Sie wichtige Informationen, bevor Sie sich darauf verlassen.',
        },
        {
          heading: 'Blockieren von Werbung und Trackern',
          body:
            'Das Blockieren von Werbung und Trackern, das Ausblenden von Cookie-Bannern und das Blockieren von ' +
            'Videowerbung sind Funktionen, die Sie wählen: Sie können jede davon unter Einstellungen › Datenschutz ' +
            'und Sicherheit ausschalten und das Blockieren für eine einzelne Website in deren Menü ausschalten ' +
            '(„Videowerbung blockieren“ ist aus, bis Sie es einschalten). Das Blockieren wirkt nur in den Seiten, die ' +
            'Sie auf Ihrem Telefon öffnen; die Websites selbst verändert es nicht. Die Filterlisten werden von ' +
            'Dritten unter deren eigenen Lizenzen erstellt (zum Beispiel EasyList unter GPLv3 oder CC BY-SA 3.0 und ' +
            'AdGuard unter GPLv3); Ihr Telefon lädt sie von ihren Herausgebern herunter, und die Einstellungen zeigen ' +
            'die Startseite und die Lizenz jeder Liste. Wir garantieren nicht, was blockiert wird und was nicht: ' +
            'Listen können zu viel oder zu wenig blockieren, und eine Website kann danach nicht mehr richtig ' +
            'funktionieren, weniger anzeigen oder Sie bitten, das Blockieren auszuschalten. Ob Sie auf einer Website ' +
            'blockieren, entscheiden Sie, und für Ihren Besuch gelten die Bedingungen dieser Website.',
        },
        {
          heading: 'Seitenstile und Skripte',
          body:
            'Sie können den Assistenten bitten, das Aussehen einer Seite zu ändern (ein Stil) oder ein Skript auf ' +
            'einer Seite auszuführen, diese für eine Website behalten und sie selbst schreiben, bearbeiten, ' +
            'importieren und exportieren. Skripte sind ausgeschaltet, bis Sie sie unter Einstellungen › Assistent ' +
            'einschalten. Qutai zeigt jeden Stil und jedes Skript, das der Assistent schreibt, und führt es erst aus, ' +
            'nachdem Sie es bestätigt haben; importierte Skripte bleiben ausgeschaltet, bis Sie sie bestätigen. Stile ' +
            'und Skripte wirken nur in Seiten, die Sie öffnen, auf Ihrem Telefon. Qutai lehnt manchen riskanten Code ' +
            'ab, prüft aber keinen Code, den Sie schreiben, bearbeiten oder importieren, und kann nicht garantieren, ' +
            'was Code bewirkt: Ein Skript läuft mit Ihrer Anmeldung auf dieser Website, kann die Seite verändern oder ' +
            'unbrauchbar machen und kann Ihr Konto dort beeinträchtigen. Bestätigen Sie nur, was Sie verstehen und ' +
            'dem Sie vertrauen. Sie sind für die Stile und Skripte verantwortlich, die Sie bestätigen, behalten, ' +
            'importieren oder teilen.',
        },
        {
          heading: 'Apps in Qutai',
          body:
            'Apps in Qutai werden auf Ihren Wunsch von der KI geschrieben. Sie laufen abgeschottet vom Internet und ' +
            'von Websites, werden von uns aber weder getestet noch geprüft und kommen ohne Gewährleistung: Eine App ' +
            'kann Fehler enthalten oder die in ihr gespeicherten Daten verlieren; exportieren oder sichern Sie daher ' +
            'alles Wichtige. Apps, die Sie aus einer Datei importieren, können von jedem stammen und werden von uns ' +
            'nicht geprüft; Qutai zeigt Ihnen, was eine importierte App ist und was sie nutzen darf, bevor Sie sie ' +
            'einschalten. Sie sind für die Apps verantwortlich, die Sie einschalten, und für die Apps, die Sie mit ' +
            'anderen teilen.',
        },
        {
          heading: 'Downloads und Installieren von Dateien',
          body:
            'Sie entscheiden, was Sie herunterladen, öffnen und installieren. Qutai warnt Sie, bevor es Dateien ' +
            'herunterlädt, die Code installieren oder ausführen können, durchsucht Dateien aber nicht nach Viren oder ' +
            'anderer Schadsoftware. {{ios:Qutai selbst installiert nie etwas. Heruntergeladene Dateien können|android:Das Öffnen einer heruntergeladenen App (einer APK-Datei) übergibt diese an das Installationsprogramm des Systems; Qutai selbst installiert nie etwas. Dateien und Apps von außerhalb von Google Play können}} Ihrem Telefon oder Ihren Daten schaden; sie ' +
            'herunterzuladen, zu öffnen und zu installieren liegt in Ihrer Verantwortung, ebenso wie die Berechtigung ' +
            'dazu.',
        },
        {
          heading: 'Zulässige Nutzung',
          body:
            'Verwenden Sie Qutai, den Assistenten, Stile, Skripte oder Apps nicht, um:\n' +
            '• gegen Gesetze oder die Rechte anderer zu verstoßen, etwa deren Privatsphäre, Urheberrechte oder ' +
            'Marken;\n' +
            '• gegen die Bedingungen von Websites oder KI-Anbietern zu verstoßen;\n' +
            '• Passwörter, Zugangskontrollen, Bezahlschranken, Kopierschutz (DRM) oder andere technische ' +
            'Schutzmaßnahmen zu umgehen;\n' +
            '• personenbezogene Daten anderer rechtswidrig zu sammeln, zu verfolgen oder zu veröffentlichen;\n' +
            '• Spam zu versenden, gefälschte Konten oder Bewertungen zu erstellen, automatisiert massenhaft zu posten ' +
            'oder zu handeln oder Websites zu überlasten;\n' +
            '• jemanden zu täuschen oder zu betrügen oder Schadsoftware zu verbreiten.',
        },
        {
          heading: 'Keine Gewährleistung und Haftungsbeschränkungen',
          body:
            'Qutai wird „wie besehen“ und „wie verfügbar“ bereitgestellt. Wir arbeiten daran, dass es nützlich und ' +
            'sicher ist, versprechen aber nicht, dass es immer funktioniert, fehlerfrei ist, blockiert, was Sie ' +
            'erwarten, oder mit jeder Website funktioniert, und wir übernehmen keine Gewährleistung über die ' +
            'gesetzlich vorgeschriebene hinaus. Soweit gesetzlich zulässig, haften wir nicht für Schäden, die durch ' +
            'Websites und ihre Inhalte, durch andere Personen, durch die Dienste von KI-Anbietern, durch ' +
            'Filterlisten, durch Stile, Skripte und Apps, die Sie bestätigen oder importieren, oder durch Aktionen, ' +
            'die Sie verlangt oder bestätigt haben, verursacht werden, und auch nicht für mittelbare Schäden wie ' +
            'entgangenen Gewinn. Nichts in diesen Bedingungen beschränkt die Haftung für Vorsatz oder grobe ' +
            'Fahrlässigkeit, für Tod oder Körperverletzung oder eine andere Haftung, die nach dem Gesetz nicht ' +
            'beschränkt oder ausgeschlossen werden darf.',
        },
        {
          heading: 'Ihre Rechte als Verbraucher',
          body:
            'Wenn Sie Qutai als Verbraucher nutzen, behalten Sie alle Rechte, die das Recht Ihres Wohnorts ' +
            'Verbrauchern gewährt und auf die nicht vertraglich verzichtet werden kann, etwa Ihre Rechte nach ' +
            'türkischem Verbraucherrecht (Gesetz Nr. 6502 über den Verbraucherschutz) und nach dem Verbraucherrecht ' +
            'der Europäischen Union und des Europäischen Wirtschaftsraums. Nichts in diesen Bedingungen beschränkt ' +
            'diese Rechte oder schließt sie aus; wo eine Bestimmung ihnen widerspricht, gelten diese Rechte.',
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
        'Qutai ist ein Webbrowser mit einem KI-Assistenten. Wir haben ihn so gebaut, dass Ihr Surfen auf Ihrem Telefon ' +
        'bleibt. Qutais eigener Server wird nur für Ihr Qutai-Konto verwendet (Anmeldung, Qutai Credits, Käufe in der App ' +
        'und Backups) und nur, wenn Sie sich dafür entscheiden. Wir verkaufen Ihre Daten nicht, und Qutai enthält kein ' +
        'Tracking und keine Werbung; anonyme Nutzungsstatistiken werden nur gesendet, wenn Sie es erlauben.',
      sections: [
        {
          heading: 'Wer wir sind',
          body:
            'Qutai wird als Open Source entwickelt. Das Qutai-Team („wir“) ist Verantwortlicher für die in dieser Erklärung ' +
            'beschriebenen Daten ist. Bei Fragen zu Ihrem Datenschutz oder um eine Kopie oder die Löschung dessen ' +
            'zu verlangen, was Qutais Server über Sie speichert, schreiben Sie an qutai@sonsuzdongu.com.',
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
            'ungefähre Position an den Adressdienst des Telefons gesendet {{ios:(den von Apple)|android:(meist den von Google)}}, um den Namen des Ortes zu ermitteln. Nur der Ortsname wird ' +
            'gespeichert.\n• Wenn Sie mit dem Assistenten sprechen und das Telefon diese Sprache nicht auf dem ' +
            'Gerät selbst erkennen kann, geht die Audioaufnahme an den Sprachdienst des Telefons {{ios:(den von Apple)|android:(meist den von Google)}}, und zwar nur, nachdem Sie einmal in Qutai zugestimmt haben, und nie in Unterhaltungen ' +
            'mit Inkognito-Tabs. Qutai und der KI-Dienst erhalten nur den Text.\n• Wenn der Assistent Ihnen ' +
            'Optionen als Karten zeigt, werden deren Bilder von den Websites (oder deren Bildservern) geladen, die ' +
            'sie zeigen, ohne Ihre Cookies, auch für Optionen, die Sie nicht öffnen; in Unterhaltungen mit ' +
            'Inkognito-Tabs nur, wenn Sie auf „Bilder anzeigen“ tippen.\n• Solange „Werbung und Tracker ' +
            'blockieren“ eingeschaltet ist, werden die von Ihnen gewählten Filterlisten von ihren Herausgebern ' +
            '(etwa EasyList und AdGuard) heruntergeladen und alle paar Tage aktualisiert. Diese Anfragen enthalten ' +
            'nichts über Ihr Surfen.\n• ' +
            'Wenn Sie eine Antwort oder eine App melden (⋮ › Melden), geht die Meldung an Qutais Server: der Grund, Ihre Notiz, der Text der Antwort oder Name und Code der App nur, wenn Sie „Mitsenden“ angehakt lassen, ob die Antwort von Qutai Credits oder Ihrem eigenen Schlüssel kam, die App-Version, das System des Telefons und die Sprache der App sowie Ihr Konto, wenn Sie angemeldet sind. Meldungen werden 180 Tage aufbewahrt und nur verwendet, um schädliche Antworten und Apps zu finden und zu beheben.',
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
            'Telefons {{ios:(zum Beispiel „iPhone · iOS 26“)|android:(zum Beispiel „Android 16“)}}. Die neuesten Backups werden aufbewahrt (derzeit 3), ältere ' +
            'werden gelöscht; Sie können sie jederzeit löschen, und wenn Sie Ihr Konto löschen, werden sie ' +
            'mitgelöscht.',
        },
        {
          heading: 'Käufe in der App',
          body:
            'Qutai Credits und alles andere, was in der App verkauft wird, werden über {{ios:den App Store|android:Google Play}} gekauft; Ihre Zahlungsdaten bleiben bei {{ios:Apple|android:Google}} und erreichen Qutai nie. Ein ' +
            'Zahlungsdienst (RevenueCat) erhält Ihre Qutai-Kontonummer und den Kaufbeleg des Stores, damit der ' +
            'Kauf bestätigt, Ihrem Konto gutgeschrieben und auf einem anderen Telefon wiederhergestellt werden ' +
            'kann. Qutai speichert zu jedem Kauf einen Datensatz (Store, Transaktion, Produkt, Credits, gezahlter ' +
            'Preis und Daten), den wir nach Steuerrecht aufbewahren müssen, auch nach der Löschung des Kontos, ' +
            'dann ohne Verbindung zu Ihnen. Erstattungen werden von {{ios:Apple|android:Google}} nach deren eigenen Regeln ' +
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
            'jeweils nach ihrer eigenen Datenschutzerklärung, sind: Cloudflare (der Server), {{ios:Apple (Anmeldung und der App Store), Google (Anmeldung)|android:Google (Anmeldung und Google Play), Apple (Anmeldung)}}, Mailjet (Anmelde-E-Mails), RevenueCat (Käufe) und, bei Qutai Credits, ' +
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
          heading: 'Anonyme Nutzungsstatistiken (nur wenn Sie es erlauben)',
          body:
            'Qutai fragt Sie einmal, ob es anonyme Nutzungsstatistiken senden darf. Nichts wird gesendet, solange Sie nicht ' +
            'auf „Erlauben“ tippen, und Sie können Ihre Antwort jederzeit unter Einstellungen › Datenschutz und Sicherheit ' +
            'ändern. Wenn Sie es erlauben, sendet die App wenige feste Angaben an den Server von Qutai: welche Funktionen ' +
            'genutzt werden, dass die Einrichtung abgeschlossen wurde, dass eine Aufgabe des Assistenten abgeschlossen wurde ' +
            'oder gescheitert ist (nur mit der Art des Fehlers, etwa ein Netzwerkfehler) und dass der Bildschirm zum Kauf von ' +
            'Credits geöffnet wurde, zusammen mit der App-Version, {{ios:dass es ein iPhone ist|android:dass es Android ' +
            'ist|web:der Art des Telefons}}, der Sprache der App und einer Zufallszahl, die dafür auf Ihrem Telefon erzeugt ' +
            'wird. Diese Zahl ist nicht mit Ihrem Konto, Ihrer Anmeldung oder einer anderen Kennung verknüpft und wird ' +
            'gelöscht, wenn Sie die Einstellung ausschalten; der Server speichert nur eine gekürzte, verschlüsselte Form ' +
            'davon. Aus Inkognito-Tabs und -Unterhaltungen wird nichts gesendet, und niemals Webadressen, Seiteninhalte, ' +
            'Suchen, was Sie schreiben, oder das Gedächtnis des Assistenten. Qutai verwendet keine Werbe-ID und verfolgt Sie ' +
            'nicht über Apps oder Websites hinweg. Die Statistiken werden bei Cloudflare gespeichert und drei Monate ' +
            'aufbewahrt.',
        },
        {
          heading: 'Prüfung von Anfragen und Schutz vor Missbrauch',
          body:
            'Um Qutai Credits vor Missbrauch zu schützen, bittet die App bei der Anmeldung und wenn der Assistent Qutai ' +
            'Credits nutzt {{ios:den App-Attest-Dienst von Apple|android:den Integritätsdienst von Google Play|web:auf einem ' +
            'iPhone den App-Attest-Dienst von Apple, auf Android den Integritätsdienst von Google Play}} zu bestätigen, dass ' +
            'die Anfrage von der echten Qutai-App auf einem echten Gerät kommt, und sendet diese Bestätigung an den Server ' +
            'von Qutai. {{ios:Apple erhält einen dafür auf Ihrem Telefon erzeugten Schlüssel und eine Prüfsumme der Anfrage; ' +
            'der Server von Qutai speichert den öffentlichen Teil des Schlüssels und einen Zähler, nicht mit Ihrem Konto ' +
            'verknüpft, und löscht sie nach 180 Tagen ohne Nutzung.|android:Google erhält eine Prüfsumme der Anfrage und ' +
            'prüft die App und das Gerät; der Server von Qutai speichert nur das Ergebnis, zusammen mit Ihrer Anmeldesitzung, ' +
            'höchstens eine Stunde.|web:Apple oder Google erhält eine Prüfsumme der Anfrage; der Server von Qutai speichert ' +
            'nur, was er für die Prüfung braucht, nicht mit Ihrem Konto verknüpft.}} Die Prüfung umfasst nie den Inhalt Ihrer ' +
            'Anfragen. Der Server von Qutai zählt außerdem pro Tag, wie viele Anfragen von seinen Grenzen abgelehnt wurden ' +
            'oder diese Prüfung nicht bestanden haben, und für jedes Konto, wie oft das geschah; diese Zählungen werden 30 ' +
            'Tage aufbewahrt. Ein Konto kann zur Prüfung durch eine Person bei Qutai markiert werden (etwa nach vielen ' +
            'abgelehnten Anfragen oder der Erstattung bereits verbrauchter Credits); eine Markierung sperrt für sich allein ' +
            'nichts und wird mit dem Konto gelöscht.',
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
          heading: 'Blockieren, Seitenstile, Skripte und Apps',
          body:
            'Das Blockieren von Werbung, Trackern und Videowerbung geschieht auf Ihrem Telefon: Die Filterlisten ' +
            'werden auf das Telefon heruntergeladen (siehe oben), und die Anfragen jeder Seite werden dort mit ihnen ' +
            'abgeglichen, sodass nichts über die Seiten, die Sie besuchen, an die Herausgeber der Listen oder an ' +
            'Qutai geht. „Cookie-Banner ausblenden“ blendet nur die Banner aus; es akzeptiert oder lehnt nie Cookies ' +
            'für Sie ab. Ihre eigenen Regeln, behaltenen Stile und behaltenen Skripte werden nur auf dem Telefon ' +
            'gespeichert und, wenn Sie eines erstellen, in Ihren Backups (der Datei, die Sie exportieren, oder dem ' +
            'Backup in Ihrem Qutai-Konto), verschlüsselt mit Ihrem Passwort. Wenn der Assistent einen Stil oder ein ' +
            'Skript schreibt, erhält der KI-Dienst wie bei jeder Frage Ihre Anfrage und die Seiteninhalte, die er ' +
            'benötigt, und auch das Ergebnis eines von Ihnen zugelassenen Skripts geht an ihn; Qutai lehnt Skripte ' +
            'ab, die auf Cookies zugreifen, und das Ergebnis eines Skripts wird nie im Gedächtnis des Assistenten, in ' +
            'Backups oder im Aktionsverlauf gespeichert. Apps in Qutai werden nur auf dem Telefon gespeichert und, ' +
            'wenn Sie sie einschließen, in Ihren Backups. Wenn Sie Qutai bitten, eine App zu erstellen oder zu ' +
            'reparieren, gehen ihr Code und ihre Fehlermeldungen an den KI-Dienst; was Sie in einer App speichern, ' +
            'nie. Apps können nicht auf das Internet zugreifen und keine Websites oder deren Cookies sehen.',
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
            'löschen. Sie können auch an qutai@sonsuzdongu.com schreiben, um eine Kopie dessen, was Qutais Server ' +
            'über Sie speichert (Auskunft), oder dessen Berichtigung oder Löschung zu verlangen. Wenn Sie Qutai deinstallieren, wird alles gelöscht, was die App auf dem Telefon ' +
            'gespeichert hat, außer Dateien, die Sie außerhalb der App gespeichert haben, etwa {{ios:Dateien in der Dateien-App|android:Downloads im Download-Ordner von Android}} und Bilder, die Sie in Ihren Fotos gespeichert ' +
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
            '• Ihr eigener API-Schlüssel: Die Nutzung ist eine Vereinbarung zwischen Ihnen und diesem Anbieter. Es ' +
            'gelten dessen Bedingungen, Datenschutzerklärung und Preise, und Sie sind verantwortlich für Ihr Konto ' +
            'dort und alle Kosten, die über Ihren Schlüssel abgerechnet werden; Qutai ist nicht Partei dieser ' +
            'Vereinbarung und kann diese Kosten nicht erstatten.\n' +
            '• Qutai Credits: Die Anfragen des Assistenten laufen über Qutais Server und werden mit Credits aus Ihrem ' +
            'Qutai-Konto bezahlt. Um sie zu nutzen, benötigen Sie ein Konto.',
        },
        {
          heading: 'Qutai Credits',
          body:
            'Credits werden in der App über {{ios:den App Store|android:Google Play}} zu dem vom Store angezeigten Preis ' +
            'gekauft und Ihrem Qutai-Konto gutgeschrieben, sobald der Kauf bestätigt ist. Mit ihnen werden nur die ' +
            'Anfragen des Assistenten in Qutai bezahlt, zu den für jedes Modell angezeigten Credit-Preisen; was ' +
            'jede Antwort gekostet hat, wird darunter angezeigt. Eine Anfrage reserviert zunächst den ' +
            'Höchstbetrag, den sie kosten könnte, und gibt zurück, was sie nicht verbraucht hat. Credits gehören ' +
            'zu Ihrem Qutai-Konto, können auf jedem Telefon verwendet werden, auf dem Sie sich anmelden, können ' +
            'nicht übertragen oder in Geld umgetauscht werden und werden nicht erstattet, außer wenn das Gesetz ' +
            'oder die Erstattungsregeln des Stores dies verlangen; Erstattungen werden von {{ios:Apple|android:Google}} ' +
            'abgewickelt. Wird ein Kauf erstattet, werden seine Credits zurückgebucht, wodurch das Guthaben ' +
            'negativ werden kann, bis Sie es aufladen. Credits verfallen nicht. Modelle, Credit-Preise und Limits können sich ändern; die ' +
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
          heading: 'Qutai ist ein Browser',
          body:
            'Qutai zeigt Websites an, die andere betreiben. Wir kontrollieren, prüfen oder befürworten weder Websites ' +
            'noch ihre Inhalte oder die Produkte und Dienstleistungen, die sie anbieten, und wir sind nicht für sie ' +
            'verantwortlich. Websites und ihre Inhalte gehören ihren Eigentümern. Wenn Sie eine Website nutzen, ' +
            'gelten deren eigene Bedingungen und das Gesetz, und Sie sind dafür verantwortlich, sie einzuhalten. ' +
            'Links, Suchergebnisse und Vorschläge, auch die des Assistenten, sind keine Empfehlungen von uns.',
        },
        {
          heading: 'Der Assistent handelt in Ihrem Auftrag',
          body:
            'Der Assistent kann Seiten lesen, klicken, tippen, Formulare ausfüllen und Beiträge, Nachrichten und ' +
            'Bestellungen vorbereiten, wenn Sie ihn darum bitten. Bevor er auf einer Website Text veröffentlicht oder ' +
            'absendet, bittet Qutai um Ihre Zustimmung. Das Abschließen einer Zahlung ist ausgeschaltet, bis Sie ' +
            '„Assistent darf Zahlungen abschließen“ unter Einstellungen › Assistent einschalten; auch dann muss jede ' +
            'Zahlung in Qutais eigenem Dialog, der den Gesamtbetrag zeigt, von Ihnen bestätigt werden. KI kann Fehler ' +
            'machen: Prüfen Sie, was Sie bestätigen, und kontrollieren Sie Käufe, Buchungen, Zahlungen, Beiträge, ' +
            'Nachrichten, Löschungen, Kontoänderungen und andere wichtige Aktionen, bevor sie abgeschlossen werden. ' +
            'Sie sind für die Aktionen verantwortlich, die Sie verlangen oder bestätigen, als hätten Sie sie selbst ' +
            'ausgeführt. Ihre Käufe und sonstigen Geschäfte mit Websites, Verkäufern und anderen Personen bestehen ' +
            'zwischen Ihnen und diesen: Qutai ist daran nicht beteiligt und wickelt Ihre Zahlungen an sie nie ab. In ' +
            'den Einstellungen können Sie festlegen, dass vor jeder Aktion eine Bestätigung erforderlich ist, und den ' +
            'Assistenten auf Websites Ihrer Wahl sperren.',
        },
        {
          heading: 'KI-Antworten',
          body:
            'Antworten, Zusammenfassungen, Übersetzungen und alles andere, was die KI schreibt, können falsch, ' +
            'unvollständig oder veraltet sein. Sie sind keine fachliche Beratung, etwa keine medizinische, ' +
            'rechtliche, finanzielle oder steuerliche Beratung: Wenden Sie sich in solchen Fragen an eine ' +
            'qualifizierte Fachperson. Prüfen Sie wichtige Informationen, bevor Sie sich darauf verlassen.',
        },
        {
          heading: 'Blockieren von Werbung und Trackern',
          body:
            'Das Blockieren von Werbung und Trackern, das Ausblenden von Cookie-Bannern und das Blockieren von ' +
            'Videowerbung sind Funktionen, die Sie wählen: Sie können jede davon unter Einstellungen › Datenschutz ' +
            'und Sicherheit ausschalten und das Blockieren für eine einzelne Website in deren Menü ausschalten ' +
            '(„Videowerbung blockieren“ ist aus, bis Sie es einschalten). Das Blockieren wirkt nur in den Seiten, die ' +
            'Sie auf Ihrem Telefon öffnen; die Websites selbst verändert es nicht. Die Filterlisten werden von ' +
            'Dritten unter deren eigenen Lizenzen erstellt (zum Beispiel EasyList unter GPLv3 oder CC BY-SA 3.0 und ' +
            'AdGuard unter GPLv3); Ihr Telefon lädt sie von ihren Herausgebern herunter, und die Einstellungen zeigen ' +
            'die Startseite und die Lizenz jeder Liste. Wir garantieren nicht, was blockiert wird und was nicht: ' +
            'Listen können zu viel oder zu wenig blockieren, und eine Website kann danach nicht mehr richtig ' +
            'funktionieren, weniger anzeigen oder Sie bitten, das Blockieren auszuschalten. Ob Sie auf einer Website ' +
            'blockieren, entscheiden Sie, und für Ihren Besuch gelten die Bedingungen dieser Website.',
        },
        {
          heading: 'Seitenstile und Skripte',
          body:
            'Sie können den Assistenten bitten, das Aussehen einer Seite zu ändern (ein Stil) oder ein Skript auf ' +
            'einer Seite auszuführen, diese für eine Website behalten und sie selbst schreiben, bearbeiten, ' +
            'importieren und exportieren. Skripte sind ausgeschaltet, bis Sie sie unter Einstellungen › Assistent ' +
            'einschalten. Qutai zeigt jeden Stil und jedes Skript, das der Assistent schreibt, und führt es erst aus, ' +
            'nachdem Sie es bestätigt haben; importierte Skripte bleiben ausgeschaltet, bis Sie sie bestätigen. Stile ' +
            'und Skripte wirken nur in Seiten, die Sie öffnen, auf Ihrem Telefon. Qutai lehnt manchen riskanten Code ' +
            'ab, prüft aber keinen Code, den Sie schreiben, bearbeiten oder importieren, und kann nicht garantieren, ' +
            'was Code bewirkt: Ein Skript läuft mit Ihrer Anmeldung auf dieser Website, kann die Seite verändern oder ' +
            'unbrauchbar machen und kann Ihr Konto dort beeinträchtigen. Bestätigen Sie nur, was Sie verstehen und ' +
            'dem Sie vertrauen. Sie sind für die Stile und Skripte verantwortlich, die Sie bestätigen, behalten, ' +
            'importieren oder teilen.',
        },
        {
          heading: 'Apps in Qutai',
          body:
            'Apps in Qutai werden auf Ihren Wunsch von der KI geschrieben. Sie laufen abgeschottet vom Internet und ' +
            'von Websites, werden von uns aber weder getestet noch geprüft und kommen ohne Gewährleistung: Eine App ' +
            'kann Fehler enthalten oder die in ihr gespeicherten Daten verlieren; exportieren oder sichern Sie daher ' +
            'alles Wichtige. Apps, die Sie aus einer Datei importieren, können von jedem stammen und werden von uns ' +
            'nicht geprüft; Qutai zeigt Ihnen, was eine importierte App ist und was sie nutzen darf, bevor Sie sie ' +
            'einschalten. Sie sind für die Apps verantwortlich, die Sie einschalten, und für die Apps, die Sie mit ' +
            'anderen teilen.',
        },
        {
          heading: 'Downloads und Installieren von Dateien',
          body:
            'Sie entscheiden, was Sie herunterladen, öffnen und installieren. Qutai warnt Sie, bevor es Dateien ' +
            'herunterlädt, die Code installieren oder ausführen können, durchsucht Dateien aber nicht nach Viren oder ' +
            'anderer Schadsoftware. {{ios:Qutai selbst installiert nie etwas. Heruntergeladene Dateien können|android:Das Öffnen einer heruntergeladenen App (einer APK-Datei) übergibt diese an das Installationsprogramm des Systems; Qutai selbst installiert nie etwas. Dateien und Apps von außerhalb von Google Play können}} Ihrem Telefon oder Ihren Daten schaden; sie ' +
            'herunterzuladen, zu öffnen und zu installieren liegt in Ihrer Verantwortung, ebenso wie die Berechtigung ' +
            'dazu.',
        },
        {
          heading: 'Zulässige Nutzung',
          body:
            'Verwenden Sie Qutai, Qutai Credits, den Assistenten, Stile, Skripte oder Apps nicht, um:\n' +
            '• gegen Gesetze oder die Rechte anderer zu verstoßen, etwa deren Privatsphäre, Urheberrechte oder ' +
            'Marken;\n' +
            '• gegen die Bedingungen von Websites oder KI-Anbietern zu verstoßen;\n' +
            '• Passwörter, Zugangskontrollen, Bezahlschranken, Kopierschutz (DRM) oder andere technische ' +
            'Schutzmaßnahmen zu umgehen;\n' +
            '• personenbezogene Daten anderer rechtswidrig zu sammeln, zu verfolgen oder zu veröffentlichen;\n' +
            '• Spam zu versenden, gefälschte Konten oder Bewertungen zu erstellen, automatisiert massenhaft zu posten ' +
            'oder zu handeln oder Websites zu überlasten;\n' +
            '• jemanden zu täuschen oder zu betrügen oder Schadsoftware zu verbreiten;\n' +
            '• Qutais Server zu missbrauchen, anzugreifen oder zu überlasten.\n' +
            'Wir können ein Konto sperren, das auf diese Weise genutzt wird.',
        },
        {
          heading: 'Keine Gewährleistung und Haftungsbeschränkungen',
          body:
            'Qutai wird „wie besehen“ und „wie verfügbar“ bereitgestellt. Wir arbeiten daran, dass es nützlich und ' +
            'sicher ist, versprechen aber nicht, dass es immer funktioniert, fehlerfrei ist, blockiert, was Sie ' +
            'erwarten, oder mit jeder Website funktioniert, und wir übernehmen keine Gewährleistung über die ' +
            'gesetzlich vorgeschriebene hinaus. Soweit gesetzlich zulässig, haften wir nicht für Schäden, die durch ' +
            'Websites und ihre Inhalte, durch andere Personen, durch die Dienste von KI-Anbietern, durch ' +
            'Filterlisten, durch Stile, Skripte und Apps, die Sie bestätigen oder importieren, oder durch Aktionen, ' +
            'die Sie verlangt oder bestätigt haben, verursacht werden, und auch nicht für mittelbare Schäden wie ' +
            'entgangenen Gewinn. Nichts in diesen Bedingungen beschränkt die Haftung für Vorsatz oder grobe ' +
            'Fahrlässigkeit, für Tod oder Körperverletzung oder eine andere Haftung, die nach dem Gesetz nicht ' +
            'beschränkt oder ausgeschlossen werden darf.',
        },
        {
          heading: 'Ihre Rechte als Verbraucher',
          body:
            'Wenn Sie Qutai als Verbraucher nutzen, behalten Sie alle Rechte, die das Recht Ihres Wohnorts ' +
            'Verbrauchern gewährt und auf die nicht vertraglich verzichtet werden kann, etwa Ihre Rechte nach ' +
            'türkischem Verbraucherrecht (Gesetz Nr. 6502 über den Verbraucherschutz) und nach dem Verbraucherrecht ' +
            'der Europäischen Union und des Europäischen Wirtschaftsraums. Nichts in diesen Bedingungen beschränkt ' +
            'diese Rechte oder schließt sie aus; wo eine Bestimmung ihnen widerspricht, gelten diese Rechte.',
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
